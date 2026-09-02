/**
 * TanStack Query hooks — the ONLY way UI components read data.
 *
 * The brief's contract:
 *   useEvents()        → fetchEvents()
 *   useEventDetails()  → fetchEventDetail()
 *   useEventEvidence() → fetchEventEvidence()
 *   useEventHistory()  → fetchEventHistory()
 *   useAnalytics()     → fetchAnalyticsSummary()
 *
 * Backed by `eventService`, which resolves to the seeded dataset today and the
 * FastAPI backend tomorrow.
 */

'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getAnalytics,
  getDensity,
  getEvent,
  getEvidence,
  getHistory,
  getPersistentRanking,
  getReport,
  getWatchtower,
  listEvents,
  type ServiceEnvelope,
} from './eventService';
import type { ExplorerFilters } from '@/data/derive';
import type { ThermalEvent } from '@/types/event';
import type {
  AnalyticsView,
  EventDetail,
  IntelligenceReport,
  PersistentSource,
  WatchtowerDigest,
} from '@/types/intelligence';
import type { Evidence } from '@/types/event';

/** The dataset is static for the session; no reason to refetch on focus. */
const STATIC = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 1,
} as const;

export function useEvents(filters: ExplorerFilters = {}): UseQueryResult<ServiceEnvelope<ThermalEvent[]>> {
  const key = JSON.stringify(filters);
  return useQuery({
    queryKey: ['events', key],
    queryFn: () => listEvents(filters),
    ...STATIC,
  });
}

/** Unfiltered dataset — single source for map, clusters and analytics totals. */
export function useAllEvents(): UseQueryResult<ServiceEnvelope<ThermalEvent[]>> {
  return useQuery({
    queryKey: ['events', 'all'],
    queryFn: () => listEvents({}),
    ...STATIC,
  });
}

export function useEventDetails(
  eventId: string | null
): UseQueryResult<ServiceEnvelope<EventDetail | null>> {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getEvent(eventId as string),
    enabled: Boolean(eventId),
    ...STATIC,
  });
}

export function useEventEvidence(eventId: string | null): UseQueryResult<ServiceEnvelope<Evidence | null>> {
  return useQuery({
    queryKey: ['event-evidence', eventId],
    queryFn: () => getEvidence(eventId as string),
    enabled: Boolean(eventId),
    ...STATIC,
  });
}

export function useEventHistory(eventId: string | null) {
  return useQuery({
    queryKey: ['event-history', eventId],
    queryFn: () => getHistory(eventId as string),
    enabled: Boolean(eventId),
    ...STATIC,
  });
}

export function useAnalytics(): UseQueryResult<ServiceEnvelope<AnalyticsView>> {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
    ...STATIC,
  });
}

export function usePersistentSources(limit = 12): UseQueryResult<ServiceEnvelope<PersistentSource[]>> {
  return useQuery({
    queryKey: ['persistent-sources', limit],
    queryFn: () => getPersistentRanking(limit),
    ...STATIC,
  });
}

export function useWatchtower(): UseQueryResult<ServiceEnvelope<WatchtowerDigest>> {
  return useQuery({
    queryKey: ['watchtower'],
    queryFn: getWatchtower,
    ...STATIC,
  });
}

export function useDensity() {
  return useQuery({
    queryKey: ['density'],
    queryFn: getDensity,
    ...STATIC,
  });
}

export function useIntelligenceReport(eventId: string | null) {
  return useQuery({
    queryKey: ['report', eventId],
    queryFn: () => getReport(eventId as string),
    enabled: Boolean(eventId),
    ...STATIC,
  });
}
