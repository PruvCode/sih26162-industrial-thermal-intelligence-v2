/**
 * Dataset contract tests.
 *
 * These guard the properties the UI depends on, not the exact random values.
 * The generator is seeded, so counts are stable — but the assertions below are
 * written as invariants because a future dataset change should not require
 * editing a magic number in three places.
 */

import { describe, it, expect } from 'vitest';
import {
  getDataset,
  getEventHistory,
  getEventEvidence,
  DATA_PROVENANCE,
  WINDOW_DAYS,
  DEMO_REFERENCE_DATE,
} from '@/data/dataset';
import {
  applyExplorerFilters,
  buildIntelligenceReport,
  eventClass,
  eventConfidence,
  eventPriorityScore,
  getAnalyticsView,
  getEventDetail,
  getPersistentSources,
  getRegionalDensity,
  getWatchtowerDigest,
  eventActiveDays,
  matchesQuery,
} from '@/data/derive';
import { eventsToGeoJSON, intensityNorm } from '@/lib/adapters/geojson';
import { INDIA_CONTEXT_BOUNDS } from '@/data/regions';
import type { ThermalClass } from '@/types/event';

const VALID_CLASSES: ThermalClass[] = [
  'industrial_fire',
  'persistent_thermal_source',
  'natural_wildfire',
  'other',
];

describe('seeded dataset', () => {
  const ds = getDataset();

  it('generates a dataset inside the 2,000–5,000 event target', () => {
    expect(ds.events.length).toBeGreaterThanOrEqual(2000);
    expect(ds.events.length).toBeLessThanOrEqual(5000);
  });

  it('is deterministic across calls', () => {
    expect(getDataset().events.length).toBe(ds.events.length);
    expect(getDataset().events[0]?.id).toBe(ds.events[0]?.id);
  });

  it('assigns every event a valid thermal class', () => {
    for (const e of ds.events) {
      expect(VALID_CLASSES).toContain(eventClass(e));
    }
  });

  it('places every event inside the India context bounds', () => {
    const [w, s, eBound, n] = INDIA_CONTEXT_BOUNDS;
    for (const e of ds.events) {
      const [lng, lat] = e.geometry.coordinates as [number, number];
      expect(lng).toBeGreaterThanOrEqual(w);
      expect(lng).toBeLessThanOrEqual(eBound);
      expect(lat).toBeGreaterThanOrEqual(s);
      expect(lat).toBeLessThanOrEqual(n);
    }
  });

  it('keeps confidence and priority inside their ranges', () => {
    for (const e of ds.events) {
      const c = eventConfidence(e);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      const p = eventPriorityScore(e);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it('carries provenance metadata', () => {
    expect(DATA_PROVENANCE.dataType).toBe('DEMO');
    expect(DATA_PROVENANCE.primarySource).toBeTruthy();
    expect(WINDOW_DAYS).toBeGreaterThan(0);
    expect(Date.parse(DEMO_REFERENCE_DATE)).not.toBeNaN();
  });
});

describe('derived views', () => {
  const ds = getDataset();

  it('summarises the same events the map renders', () => {
    const view = getAnalyticsView();
    expect(view.totals.events).toBe(ds.events.length);
    expect(view.byClass.reduce((a, b) => a + b.count, 0)).toBe(ds.events.length);
  });

  it('ranks persistent sources by activity', () => {
    const sources = getPersistentSources(8);
    expect(sources.length).toBeGreaterThan(0);
    for (let i = 1; i < sources.length; i += 1) {
      const prev = sources[i - 1]!;
      const cur = sources[i]!;
      const ordered =
        prev.activeDays > cur.activeDays ||
        (prev.activeDays === cur.activeDays && prev.detectionCount >= cur.detectionCount);
      expect(ordered).toBe(true);
    }
  });

  it('bins regional density without losing events', () => {
    const cells = getRegionalDensity(0.6);
    const total = cells.reduce((a, c) => a + c.count, 0);
    expect(total).toBe(ds.events.length);
  });

  it('builds a watchtower digest over the observation window', () => {
    const digest = getWatchtowerDigest(Date.parse(DEMO_REFERENCE_DATE));
    expect(digest.windowDays).toBe(WINDOW_DAYS);
    expect(digest.newEvents.length).toBeGreaterThan(0);
    expect(digest.priorityEvents.length).toBeGreaterThan(0);
    expect(digest.totals.events).toBe(ds.events.length);
  });
});

describe('filters and search', () => {
  const ds = getDataset();

  it('filters by class', () => {
    const out = applyExplorerFilters(ds.events, { classes: ['industrial_fire'] });
    expect(out.length).toBeGreaterThan(0);
    for (const e of out) expect(eventClass(e)).toBe('industrial_fire');
  });

  it('filters by minimum confidence, expressed as a percentage', () => {
    const out = applyExplorerFilters(ds.events, { minConfidence: 80 });
    expect(out.length).toBeGreaterThan(0);
    for (const e of out) expect(eventConfidence(e) * 100).toBeGreaterThanOrEqual(80);
    // 100% is unreachable, so the strictest filter must yield nothing.
    expect(applyExplorerFilters(ds.events, { minConfidence: 100 }).length).toBe(0);
  });

  it('filters by minimum persistence', () => {
    const out = applyExplorerFilters(ds.events, { minPersistence: 10 });
    for (const e of out) expect(eventActiveDays(e)).toBeGreaterThanOrEqual(10);
  });

  it('sorts by priority descending', () => {
    const out = applyExplorerFilters(ds.events, { sort: 'priority' });
    for (let i = 1; i < Math.min(out.length, 50); i += 1) {
      expect(eventPriorityScore(out[i - 1]!)).toBeGreaterThanOrEqual(eventPriorityScore(out[i]!));
    }
  });

  it('matches an event id with or without punctuation', () => {
    const e = ds.events[0]!;
    expect(matchesQuery(e, e.id)).toBe(true);
    expect(matchesQuery(e, e.id.replace(/[^0-9]/g, ''))).toBe(true);
    expect(matchesQuery(e, 'zzzzz-no-such-place')).toBe(false);
  });
});

describe('investigation', () => {
  const ds = getDataset();

  it('returns detail, history and evidence for an event', () => {
    const e = ds.events[0]!;
    const detail = getEventDetail(e.id);
    expect(detail).not.toBeNull();
    expect(detail!.event.id).toBe(e.id);
    expect(detail!.story.sentences.length).toBeGreaterThan(0);
    expect(detail!.breadcrumb.length).toBeGreaterThan(0);
    expect(Array.isArray(getEventHistory(e.id))).toBe(true);
    expect(getEventEvidence(e.id)).not.toBeUndefined();
  });

  it('returns null for an unknown event', () => {
    expect(getEventDetail('evt_999999')).toBeNull();
    expect(buildIntelligenceReport('evt_999999')).toBeNull();
  });

  it('builds an exportable report that agrees with the event', () => {
    const e = ds.events[0]!;
    const report = buildIntelligenceReport(e.id);
    expect(report).not.toBeNull();
    expect(report!.eventId).toBe(e.id);
    expect(report!.classification).toBe(eventClass(e));
    expect(report!.confidence).toBeCloseTo(eventConfidence(e), 5);
    expect(report!.provenance.dataType).toBe(DATA_PROVENANCE.dataType);
  });
});

describe('geojson adapter', () => {
  const ds = getDataset();

  it('promotes id to a top-level feature property for setFeatureState', () => {
    const fc = eventsToGeoJSON(ds.events.slice(0, 25));
    expect(fc.features.length).toBe(25);
    for (const f of fc.features) {
      expect(typeof f.id).toBe('string');
      expect(f.properties.id).toBe(f.id);
    }
  });

  it('normalises intensity into 0..1 on a log scale', () => {
    for (const e of ds.events.slice(0, 100)) {
      const v = intensityNorm(e);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Monotonic: more radiative power must never map to a smaller value.
    const a = intensityNorm({ ...ds.events[0]!, frp: 1 });
    const b = intensityNorm({ ...ds.events[0]!, frp: 50 });
    expect(b).toBeGreaterThan(a);
  });
});
