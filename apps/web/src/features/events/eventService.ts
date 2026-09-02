/**
 * ONE SOURCE OF TRUTH for every read the UI performs.
 *
 * No component imports the dataset, and no component imports the HTTP client.
 * Components call hooks; hooks call this service; this service asks whichever
 * `DataProvider` is active — seeded demo data or the live FastAPI backend.
 *
 * Swapping to live data is an environment variable, not a refactor.
 *
 * The exported signatures here are the contract the hooks depend on. They have
 * not changed; only the implementation behind them has.
 */

import { DATA_PROVENANCE } from '@/data/dataset';
import { API_BASE_URL, isApiConfigured } from '@/lib/api/http';
import { ApiError } from '@/lib/api/errors';
import {
  getActiveProvider,
  providerFor,
  setActiveProvider,
  type DataProvider,
  type DataSource,
} from '@/lib/api/provider';
import type { ExplorerFilters } from '@/data/derive';
import type { Evidence, ThermalEvent } from '@/types/event';
import type {
  AnalyticsView,
  EventDetail,
  IntelligenceReport,
  PersistentSource,
  WatchtowerDigest,
} from '@/types/intelligence';

export type { DataSource };

/**
 * Small artificial latency on the demo path.
 *
 * Without it every query resolves in the same microtask, loading skeletons
 * never render, and the moment a real backend is attached the whole UI reveals
 * itself as having no loading states. Keeping it makes those states real.
 */
const LOCAL_LATENCY_MS = 120;

const HEALTH_TIMEOUT_MS = 1500;

/** `null` = not yet probed. `true` = a live backend answered. */
let remoteAvailable: boolean | null = null;

export function setRemoteAvailability(value: boolean | null) {
  remoteAvailable = value;
  setActiveProvider(providerFor(value === true ? 'live' : 'demo'));
}

export function isRemote(): boolean {
  return remoteAvailable === true;
}

function delay<T>(value: T, ms = LOCAL_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface ServiceEnvelope<T> {
  data: T;
  source: DataSource;
}

/**
 * Transport failures degrade to demo data; logic failures do not.
 *
 * A backend that is down, unreachable or timing out should not take the demo
 * down with it. But a genuinely missing record (404) or a view the backend
 * cannot serve yet (501) must surface — hiding it behind demo data would show
 * the user numbers that are not the ones they asked for.
 */
function shouldDegradeToDemo(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT' ||
    error.code === 'SERVICE_UNAVAILABLE' ||
    error.status >= 500
  );
}

async function run<T>(work: (provider: DataProvider) => Promise<T>): Promise<ServiceEnvelope<T>> {
  const provider = getActiveProvider();

  if (provider.source === 'demo') {
    return { data: await delay(await work(provider)), source: 'demo' };
  }

  try {
    return { data: await work(provider), source: 'live' };
  } catch (error) {
    if (shouldDegradeToDemo(error)) {
      setRemoteAvailability(false);
      const fallback = providerFor('demo');
      return { data: await delay(await work(fallback)), source: 'demo' };
    }
    throw error;
  }
}

export function listEvents(filters: ExplorerFilters = {}): Promise<ServiceEnvelope<ThermalEvent[]>> {
  return run((provider) => provider.listEvents(filters));
}

export function getEvent(eventId: string): Promise<ServiceEnvelope<EventDetail | null>> {
  return run((provider) => provider.getEvent(eventId));
}

export function getEvidence(eventId: string): Promise<ServiceEnvelope<Evidence | null>> {
  return run((provider) => provider.getEvidence(eventId));
}

export function getHistory(eventId: string) {
  return run((provider) => provider.getHistory(eventId));
}

export function getAnalytics(): Promise<ServiceEnvelope<AnalyticsView>> {
  return run((provider) => provider.getAnalytics());
}

export function getPersistentRanking(limit = 12): Promise<ServiceEnvelope<PersistentSource[]>> {
  return run((provider) => provider.getPersistentSources(limit));
}

export function getWatchtower(): Promise<ServiceEnvelope<WatchtowerDigest>> {
  return run((provider) => provider.getWatchtower());
}

export function getDensity() {
  return run((provider) => provider.getDensity());
}

export function getReport(eventId: string): Promise<ServiceEnvelope<IntelligenceReport | null>> {
  return run((provider) => provider.getReport(eventId));
}

/**
 * Probe the backend once at startup.
 *
 * Cheap, non-blocking, and failure is the expected outcome today — the demo
 * dataset is the default, not an error path.
 *
 * Note the `/api/v1/health` prefix: the health router is mounted under the v1
 * router, so the bare `/health` this used to call was never a real endpoint.
 */
export async function probeBackend(): Promise<boolean> {
  if (!isApiConfigured()) {
    setRemoteAvailability(false);
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const response = await fetch(`${API_BASE_URL}/api/v1/health`, { signal: controller.signal });
    clearTimeout(timer);

    setRemoteAvailability(response.ok);
    return response.ok;
  } catch {
    setRemoteAvailability(false);
    return false;
  }
}

export function provenance() {
  return {
    ...DATA_PROVENANCE,
    isLive: isRemote(),
  };
}
