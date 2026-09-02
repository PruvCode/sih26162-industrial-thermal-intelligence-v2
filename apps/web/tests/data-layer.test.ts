/**
 * Data-layer tests.
 *
 * These guard the contract between the FastAPI wire format and the domain
 * models, plus the filtering, pagination and error behaviour the UI depends on.
 *
 * They are written as invariants, not snapshots. The two failures that would
 * hurt most — a mapper that swaps latitude with longitude, and an error model
 * that collapses "not found" into "server broken" — are both covered.
 */

import { describe, it, expect } from 'vitest';
import { ApiError, codeFromStatus, parseErrorPayload } from '@/lib/api/errors';
import { buildUrl, toQueryString, isApiConfigured } from '@/lib/api/http';
import { acqToIso, confidenceToNumber, mapEvidence, mapHistory, mapThermalEvent, satelliteName } from '@/lib/api/mappers';
import type { BackendThermalEvent } from '@/lib/api/dto';
import { demoProvider } from '@/lib/api/providers/demo';
import { apiProvider } from '@/lib/api/providers/api';
import { listEvents, provenance } from '@/features/events/eventService';
import { getDataset } from '@/data/dataset';

const backendEvent = (overrides: Partial<BackendThermalEvent> = {}): BackendThermalEvent => ({
  id: 'b7f0e2c4-1111-4a00-8000-000000000001',
  latitude: 22.8046,
  longitude: 86.2029,
  frp: 42.5,
  brightness: 341.2,
  scan: 0.45,
  track: 0.51,
  satellite: 'N',
  instrument: 'VIIRS',
  confidence: 'high',
  daynight: 'D',
  version: '2.0NRT',
  acq_date: '2026-08-30T00:00:00',
  acq_time: '0735',
  source_url: null,
  created_at: '2026-08-30T08:00:00',
  updated_at: '2026-08-30T08:00:00',
  ...overrides,
});

describe('wire to domain mappers', () => {
  it('maps geometry as [longitude, latitude], not [latitude, longitude]', () => {
    const event = mapThermalEvent(backendEvent());
    expect(event.geometry.type).toBe('Point');
    expect(event.geometry.coordinates).toEqual([86.2029, 22.8046]);
  });

  it('converts categorical FIRMS confidence to a 0..1 number', () => {
    expect(confidenceToNumber('high')).toBe(0.9);
    expect(confidenceToNumber('medium')).toBe(0.6);
    expect(confidenceToNumber('low')).toBe(0.3);
    // Already-numeric confidence (ML output) passes through.
    expect(confidenceToNumber('0.42')).toBeCloseTo(0.42);
    expect(confidenceToNumber(0.42)).toBeCloseTo(0.42);
    expect(confidenceToNumber(null)).toBe(0);
    expect(confidenceToNumber(undefined)).toBe(0);
    // Unknown category degrades to the middle rather than 0.
    expect(confidenceToNumber('unknown-category')).toBe(0.5);
  });

  it('clamps numeric confidence into 0..1', () => {
    expect(confidenceToNumber(1.5)).toBe(1);
    expect(confidenceToNumber(-0.2)).toBe(0);
  });

  it('expands FIRMS satellite codes to the display names the UI uses', () => {
    expect(satelliteName('N')).toBe('Suomi-NPP');
    expect(satelliteName('A')).toBe('Aqua');
    expect(satelliteName('T')).toBe('Terra');
    expect(satelliteName('NOAA-20')).toBe('NOAA-20');
    expect(satelliteName(null)).toBe('Unknown');
  });

  it('merges acq_date and acq_time into one ISO instant', () => {
    const iso = acqToIso('2026-08-30T00:00:00', '0735');
    expect(iso).toBe('2026-08-30T07:35:00.000Z');
  });

  it('falls back to a valid instant when the date is missing', () => {
    expect(() => new Date(acqToIso(null, null))).not.toThrow();
    expect(acqToIso(null, undefined)).toBe(new Date(0).toISOString());
  });

  it('tolerates a backend row with every optional field null', () => {
    const event = mapThermalEvent(
      backendEvent({ frp: null, brightness: null, satellite: null, instrument: null, confidence: null, acq_date: null })
    );
    expect(event.brightness).toBe(0);
    expect(event.frp).toBeUndefined();
    expect(event.satellite).toBe('Unknown');
    expect(event.confidence).toBe(0);
  });

  it('splits evidence into supporting and contradicting factors', () => {
    const evidence = mapEvidence({
      event_id: 'b7f0e2c4-1111-4a00-8000-000000000001',
      classification_label: 'industrial_fire',
      classification_confidence: 0.88,
      reasoning_summary: 'consistent with an industrial source',
      generated_at: '2026-08-30T08:00:00',
      nearby_sites: [],
      components: [
        { component_type: 'spatial_proximity', label: 'Near steel plant', description: '1.2 km', value: 1.2, unit: 'km', weight: 0.4 },
        { component_type: 'historical_pattern', label: 'Not seasonal', description: 'no crop cycle', value: null, unit: null, weight: -0.25 },
      ],
    });

    expect(evidence.positiveFactors).toHaveLength(1);
    expect(evidence.negativeFactors).toHaveLength(1);
    expect(evidence.negativeFactors[0].weight).toBe(-0.25);
  });

  it('orders shap features by absolute contribution', () => {
    const evidence = mapEvidence({
      event_id: 'x',
      classification_label: 'industrial_fire',
      classification_confidence: 0.9,
      reasoning_summary: '',
      generated_at: '2026-08-30T08:00:00',
      nearby_sites: [],
      components: [
        { component_type: 'a', label: 'small', description: '', value: null, unit: null, weight: 0.05 },
        { component_type: 'b', label: 'large negative', description: '', value: null, unit: null, weight: -0.8 },
        { component_type: 'c', label: 'large positive', description: '', value: null, unit: null, weight: 0.6 },
      ],
    });

    expect(evidence.shapSummary.topFeatures.map((f) => f.feature)).toEqual(['large negative', 'large positive', 'small']);
  });

  it('survives a malformed history payload without throwing', () => {
    expect(mapHistory(null, 'evt-1')).toEqual([]);
    expect(mapHistory('not an array', 'evt-1')).toEqual([]);

    const rows = mapHistory([{}, { latitude: 20, longitude: 78 }], 'evt-1');
    expect(rows).toHaveLength(2);
    // Missing coordinates degrade to 0 rather than NaN reaching the map.
    expect(rows[0].geometry.coordinates).toEqual([0, 0]);
    expect(rows[0].eventId).toBe('evt-1');
  });
});

describe('error model', () => {
  it('maps status codes to stable error codes', () => {
    expect(codeFromStatus(404)).toBe('NOT_FOUND');
    expect(codeFromStatus(422)).toBe('UNPROCESSABLE');
    expect(codeFromStatus(429)).toBe('RATE_LIMITED');
    expect(codeFromStatus(503)).toBe('SERVICE_UNAVAILABLE');
    expect(codeFromStatus(599)).toBe('INTERNAL');
    expect(codeFromStatus(418)).toBe('BAD_REQUEST');
  });

  it('reads all three FastAPI error shapes', () => {
    expect(parseErrorPayload({ success: false, error: { code: 'EVENT_NOT_FOUND', message: 'nope' } })).toEqual({
      code: 'EVENT_NOT_FOUND',
      message: 'nope',
      details: undefined,
    });

    expect(parseErrorPayload({ detail: 'Event not found' })).toEqual({ message: 'Event not found' });

    const validation = parseErrorPayload({
      detail: [{ loc: ['query', 'page_size'], msg: 'ensure this value is less than 100', type: 'value_error' }],
    });
    expect(validation.message).toContain('page_size');
  });

  it('returns a user-safe message and never leaks server text', () => {
    const error = new ApiError({ status: 500, message: 'psycopg2.ProgrammingError: relation "events" does not exist' });
    expect(error.userMessage).toBe('Something went wrong on our side.');
    expect(error.userMessage).not.toContain('psycopg2');
  });

  it('treats transport failures as retryable and missing records as not', () => {
    expect(new ApiError({ status: 0, code: 'TIMEOUT' }).retryable).toBe(true);
    expect(new ApiError({ status: 0, code: 'NETWORK_ERROR' }).retryable).toBe(true);
    expect(new ApiError({ status: 503 }).retryable).toBe(true);
    expect(new ApiError({ status: 404 }).retryable).toBe(false);
    expect(new ApiError({ status: 400 }).retryable).toBe(false);
  });
});

describe('http transport', () => {
  it('prefixes every path with /api/v1', () => {
    expect(buildUrl('/events')).toBe('/api/v1/events');
    expect(buildUrl('events')).toBe('/api/v1/events');
  });

  it('drops empty query values and comma-joins arrays', () => {
    const qs = toQueryString({
      page: 1,
      limit: undefined,
      satellite: null,
      confidence: '',
      classes: ['industrial_fire', 'natural_wildfire'],
      empty: [],
    });
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('1');
    expect(params.has('limit')).toBe(false);
    expect(params.has('satellite')).toBe(false);
    expect(params.has('confidence')).toBe(false);
    expect(params.get('classes')).toBe('industrial_fire,natural_wildfire');
    expect(params.has('empty')).toBe(false);
  });

  it('is unconfigured when no API URL is set', () => {
    // Guards the default: a fresh clone must run on demo data.
    expect(isApiConfigured()).toBe(false);
  });
});

describe('demo provider', () => {
  it('returns the full seeded dataset with no filters', async () => {
    const events = await demoProvider.listEvents();
    expect(events).toHaveLength(getDataset().events.length);
  });

  it('filters by classification', async () => {
    const all = await demoProvider.listEvents();
    const industrial = await demoProvider.listEvents({ classes: ['industrial_fire'] });
    expect(industrial.length).toBeGreaterThan(0);
    expect(industrial.length).toBeLessThan(all.length);
    for (const event of industrial) {
      expect((event.classification?.class ?? 'other')).toBe('industrial_fire');
    }
  });

  it('sorts by priority descending', async () => {
    const events = await demoProvider.listEvents({ sort: 'priority' });
    const scores = events.map((e) => e.priorityScore ?? 0);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
  });

  it('matches a free-text query on event id digits', async () => {
    const target = (await demoProvider.listEvents())[0];
    const digits = target.id.replace(/\D/g, '');
    const found = await demoProvider.listEvents({ query: digits });
    expect(found.map((e) => e.id)).toContain(target.id);
  });

  it('treats minConfidence as a percentage', async () => {
    const strict = await demoProvider.listEvents({ minConfidence: 95 });
    const loose = await demoProvider.listEvents({ minConfidence: 0 });
    expect(strict.length).toBeLessThanOrEqual(loose.length);
    for (const event of strict) {
      expect((event.classification?.confidence ?? 0) * 100).toBeGreaterThanOrEqual(95);
    }
  });

  it('returns null for an unknown event id instead of throwing', async () => {
    await expect(demoProvider.getEvent('does-not-exist')).resolves.toBeNull();
  });

  it('honours the persistent source limit', async () => {
    expect(await demoProvider.getPersistentSources(5)).toHaveLength(5);
    expect((await demoProvider.getPersistentSources(3)).length).toBeLessThanOrEqual(3);
  });

  it('reports analytics totals that agree with the dataset', async () => {
    const analytics = await demoProvider.getAnalytics();
    expect(analytics.totals.events).toBe(getDataset().events.length);
  });
});

describe('api provider', () => {
  // These views have no backend endpoint yet. They must fail loudly and name
  // the endpoint to build, rather than quietly serving seeded numbers.
  it('refuses to fake views the backend cannot serve', async () => {
    for (const call of [
      () => apiProvider.getWatchtower(),
      () => apiProvider.getDensity(),
      () => apiProvider.getPersistentSources(),
      () => apiProvider.getReport('any'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(ApiError);
      await expect(call()).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    }
  });
});

describe('service envelope', () => {
  it('labels demo data as demo', async () => {
    const envelope = await listEvents();
    expect(envelope.source).toBe('demo');
    expect(envelope.data.length).toBeGreaterThan(0);
  });

  it('reports provenance honestly', () => {
    expect(provenance().isLive).toBe(false);
    expect(provenance().primarySource).toBeTruthy();
  });
});
