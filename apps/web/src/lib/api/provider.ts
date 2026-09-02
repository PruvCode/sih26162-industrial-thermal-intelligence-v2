/**
 * THE DATA BOUNDARY.
 *
 * Every read the UI performs goes through a `DataProvider`. There are two
 * implementations — one backed by the seeded demo dataset, one backed by the
 * FastAPI service — and the UI cannot tell them apart.
 *
 * That is the whole point of this phase: today the app runs on demo data
 * because no backend is deployed. Tomorrow it runs on real data because
 * `NEXT_PUBLIC_API_URL` is set. No component changes either way.
 *
 * This file holds only the CONTRACT and the selection. Implementations live in
 * `providers/`. Note those import `DataProvider` with `import type` — a runtime
 * import here would create a circular dependency.
 */

import type { ExplorerFilters } from '@/data/derive';
import type { Evidence, HistoricalObservation, ThermalEvent } from '@/types/event';
import type {
  AnalyticsView,
  DensityCell,
  EventDetail,
  IntelligenceReport,
  PersistentSource,
  WatchtowerDigest,
} from '@/types/intelligence';

/** Which backend answered. Surfaced in the UI so provenance is never a guess. */
export type DataSource = 'demo' | 'live';

export interface DataProvider {
  readonly source: DataSource;

  listEvents(filters?: ExplorerFilters): Promise<ThermalEvent[]>;

  getEvent(eventId: string): Promise<EventDetail | null>;

  getEvidence(eventId: string): Promise<Evidence | null>;

  getHistory(eventId: string): Promise<HistoricalObservation[]>;

  getAnalytics(): Promise<AnalyticsView>;

  /** Ranked persistent thermal sources. */
  getPersistentSources(limit?: number): Promise<PersistentSource[]>;

  getWatchtower(): Promise<WatchtowerDigest>;

  /** Regional density grid for the thermal heatmap. */
  getDensity(): Promise<DensityCell[]>;

  /** The exportable investigation report for one event. */
  getReport(eventId: string): Promise<IntelligenceReport | null>;
}

import { demoProvider } from './providers/demo';
import { apiProvider } from './providers/api';

export function providerFor(source: DataSource): DataProvider {
  return source === 'live' ? apiProvider : demoProvider;
}

/**
 * Demo is the default.
 *
 * A fresh clone with no `NEXT_PUBLIC_API_URL` must show a working product, not
 * a wall of failed fetches. Going live is opt-in, explicit, and reversible.
 */
let active: DataProvider = demoProvider;

export function setActiveProvider(provider: DataProvider): void {
  active = provider;
}

export function getActiveProvider(): DataProvider {
  return active;
}
