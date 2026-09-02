'use client';

/**
 * The single filtered view of the dataset.
 *
 * The map, the navigator, the status bar count and the timeline all read from
 * this hook. One filter pipeline, one answer — so "1,247 events" in the
 * navigator can never contradict the 1,247 markers on the map.
 */

import { useMemo } from 'react';
import { useAllEvents } from './hooks';
import { useAppStore } from '@/store/useAppStore';
import { applyExplorerFilters, type ExplorerFilters } from '@/data/derive';
import type { ThermalEvent } from '@/types/event';

/** Ordered unique dates across the observation window. */
export function useObservationDays(): string[] {
  const { data } = useAllEvents();
  return useMemo(() => {
    const events = data?.data ?? [];
    const set = new Set<string>();
    for (const e of events) set.add(e.acqDatetime.slice(0, 10));
    return [...set].sort();
  }, [data]);
}

export interface FilteredEventsResult {
  events: ThermalEvent[];
  /** Matches the filters but ignores the timeline cursor — what the histogram
   *  should plot, since the cursor is the thing being scrubbed over it. */
  beforeTimeline: ThermalEvent[];
  /** Total matching the filters, ignoring the timeline cursor. */
  total: number;
  isLoading: boolean;
  isError: boolean;
}

export function useFilteredEvents(): FilteredEventsResult {
  const { data, isLoading, isError } = useAllEvents();
  const filters = useAppStore((s) => s.filters);
  const timelineCursor = useAppStore((s) => s.timelineCursor);

  const all = data?.data ?? [];

  const filtered = useMemo(() => {
    const f: ExplorerFilters = {
      classes: filters.classes,
      states: filters.states,
      bands: filters.bands,
      minConfidence: filters.minConfidence,
      minPersistence: filters.minPersistence,
      query: filters.query,
      sort: filters.sort,
    };
    return applyExplorerFilters(all, f);
  }, [
    all,
    filters.classes,
    filters.states,
    filters.bands,
    filters.minConfidence,
    filters.minPersistence,
    filters.query,
    filters.sort,
  ]);

  // Timeline replay is cumulative: scrubbing forward makes events appear and
  // stay, which is what "detections accumulating over a month" should look like.
  const days = useObservationDays();
  const events = useMemo(() => {
    if (timelineCursor < 0 || timelineCursor >= days.length - 1) return filtered;
    const cutoff = days[timelineCursor];
    return filtered.filter((e) => e.acqDatetime.slice(0, 10) <= cutoff);
  }, [filtered, timelineCursor, days]);

  return { events, beforeTimeline: filtered, total: filtered.length, isLoading, isError };
}
