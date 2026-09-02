/**
 * API PROVIDER — talks to the FastAPI service.
 *
 * Every method maps to a real backend endpoint under `/api/v1` (see
 * docs/api/API_CONTRACT.md). The four views that previously threw
 * `NOT_IMPLEMENTED` now call real endpoints:
 *
 *   getPersistentSources -> GET /api/v1/persistent-sources
 *   getWatchtower        -> GET /api/v1/watchtower
 *   getDensity           -> GET /api/v1/analytics/density
 *   getReport            -> GET /api/v1/events/{id}/report
 *
 * One known contract gap remains: the backend's `/watchtower` is count-based
 * (it returns aggregates, not the underlying event objects), so the live
 * provider populates the digest `totals` but leaves the event/source lists
 * empty. `getReport` returns `null` on 404 (unknown id), matching the demo
 * provider's contract.
 */

import { applyExplorerFilters, buildAnomalyStory, eventPriorityBand } from '@/data/derive';
import type { Evidence, HistoricalObservation, ThermalEvent } from '@/types/event';
import type { AnalyticsView, EventDetail } from '@/types/intelligence';
import type {
  BackendAnalyticsSummary,
  BackendDensityResponse,
  BackendEventReport,
  BackendEvidenceResponse,
  BackendPersistentSourcesResponse,
  BackendThermalEvent,
  BackendThermalEventList,
  BackendWatchtower,
} from '../dto';
import { ApiError } from '../errors';
import { apiGet } from '../http';
import {
  mapDensity,
  mapEventReport,
  mapEvidence,
  mapHistory,
  mapPersistentSources,
  mapThermalEvent,
  mapThermalEvents,
  mapWatchtower,
} from '../mappers';
import type { DataProvider } from '../provider';

/** The backend rejects `page_size` above this. */
const MAX_PAGE_SIZE = 100;

function emptyAnalytics(): AnalyticsView {
  return {
    windowDays: 0,
    period: { start: '', end: '' },
    totals: { events: 0, sources: 0, persistentSources: 0, industrialShare: 0, requiresReview: 0 },
    byClass: [],
    byPriority: [],
    byState: [],
    byDay: [],
    bySatellite: [],
    topSources: [],
  };
}

function confidenceBandOf(value: number): EventDetail['confidenceBand'] {
  if (value >= 0.75) return 'high';
  if (value >= 0.45) return 'moderate';
  return 'uncertain';
}

export const apiProvider: DataProvider = {
  source: 'live',

  /**
   * Filters the backend supports go to the server; the rest are applied here.
   *
   * The backend accepts bbox, date range and pagination. It has no notion of
   * classification, priority band, state, persistence free-text search or sort
   * order yet, so those are applied to the returned page. That is correct while
   * a page is small, and it is the first thing to move server-side once those
   * filters exist — see the API contract.
   */
  async listEvents(filters = {}) {
    const pageSize = Math.min(filters.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = filters.offset ?? 0;
    const page = Math.floor(offset / pageSize) + 1;
    const bbox = filters.bbox;

    const response = await apiGet<BackendThermalEventList>('/events', {
      query: {
        lon_min: bbox?.[0],
        lat_min: bbox?.[1],
        lon_max: bbox?.[2],
        lat_max: bbox?.[3],
        date_from: filters.startDate,
        date_to: filters.endDate,
        page,
        page_size: pageSize,
      },
    });

    return applyExplorerFilters(mapThermalEvents(response.items ?? []), filters);
  },

  async getEvent(eventId) {
    const [dto, history] = await Promise.all([
      apiGet<BackendThermalEvent>(`/events/${eventId}`),
      apiGet<unknown>(`/events/${eventId}/history`).catch(() => []),
    ]);

    const event: ThermalEvent = mapThermalEvent(dto);
    const mappedHistory: HistoricalObservation[] = mapHistory(history, eventId);

    return {
      event,
      // The backend has no persistent-source endpoint yet.
      source: null,
      history: mappedHistory,
      // Evidence is a separate request so the panel opens fast.
      evidence: null,
      priorityBand: eventPriorityBand(event),
      confidenceBand: confidenceBandOf(event.classification?.confidence ?? 0),
      story: buildAnomalyStory(event, null),
      breadcrumb: [event.satellite, event.instrument].filter(Boolean),
    } satisfies EventDetail;
  },

  async getEvidence(eventId): Promise<Evidence | null> {
    const dto = await apiGet<BackendEvidenceResponse>(`/events/${eventId}/evidence`);
    return dto ? mapEvidence(dto) : null;
  },

  async getHistory(eventId) {
    return mapHistory(await apiGet<unknown>(`/events/${eventId}/history`), eventId);
  },

  /**
   * Partial mapping, deliberately.
   *
   * The backend summary supplies totals, class breakdown and a daily series.
   * It cannot supply priority bands, states, satellites or ranked sources, so
   * those arrays come back empty and the Analytics page renders what it can.
   * Filling them in requires the endpoints in the API contract.
   */
  async getAnalytics(): Promise<AnalyticsView> {
    let summary: BackendAnalyticsSummary;
    try {
      summary = await apiGet<BackendAnalyticsSummary>('/analytics/summary');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') return emptyAnalytics();
      throw error;
    }

    const base = emptyAnalytics();
    const breakdown = summary.classification_breakdown ?? [];
    const points = summary.time_series?.points ?? [];

    return {
      ...base,
      totals: {
        events: summary.total_events ?? 0,
        sources: summary.total_sites ?? 0,
        persistentSources: (summary.top_hotspots ?? []).length,
        industrialShare: 0,
        requiresReview: summary.high_risk_events ?? 0,
      },
      byClass: breakdown.map((b) => ({
        class: (b.category ?? 'other') as AnalyticsView['byClass'][number]['class'],
        count: b.count ?? 0,
        avgConfidence: 0,
        share: (b.percentage ?? 0) / 100,
      })),
      byDay: points.map((p) => ({
        date: p.date,
        count: p.count ?? 0,
        industrial: 0,
      })),
    };
  },

  async getPersistentSources() {
    const dto = await apiGet<BackendPersistentSourcesResponse>('/persistent-sources');
    return mapPersistentSources(dto);
  },

  async getWatchtower() {
    const dto = await apiGet<BackendWatchtower>('/watchtower');
    return mapWatchtower(dto);
  },

  async getDensity() {
    const dto = await apiGet<BackendDensityResponse>('/analytics/density');
    return mapDensity(dto);
  },

  async getReport(eventId: string) {
    try {
      const dto = await apiGet<BackendEventReport>(`/events/${eventId}/report`);
      return dto ? mapEventReport(dto) : null;
    } catch (error) {
      // An unknown id returns 404 — the demo provider returns null for the same.
      if (error instanceof ApiError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  },
};
