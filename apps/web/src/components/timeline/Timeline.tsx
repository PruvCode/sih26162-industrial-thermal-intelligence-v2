'use client';

/**
 * HISTORICAL TIMELINE + REPLAY.
 *
 * A 30-day detection histogram with a scrubber. Replay is cumulative: events
 * accumulate as the cursor advances, which is what a month of satellite
 * overpasses actually looks like.
 *
 * Playback advances on a fixed interval rather than on rAF so the speed is
 * identical on every display.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { useObservationDays, useFilteredEvents } from '@/features/events/useFilteredEvents';
import { IconButton, SectionLabel } from '@/components/ui/primitives';
import { WINDOW_DAYS } from '@/data/dataset';

/** Milliseconds between replay steps. */
const STEP_MS = 260;

export function Timeline() {
  const days = useObservationDays();
  const { beforeTimeline, events, isLoading } = useFilteredEvents();
  const cursor = useAppStore((s) => s.timelineCursor);
  const playing = useAppStore((s) => s.timelinePlaying);
  const setCursor = useAppStore((s) => s.setTimelineCursor);
  const setPlaying = useAppStore((s) => s.setTimelinePlaying);

  const histogram = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of beforeTimeline) {
      const d = e.acqDatetime.slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return days.map((d) => ({ date: d, count: counts.get(d) ?? 0 }));
  }, [beforeTimeline, days]);

  const max = useMemo(() => Math.max(1, ...histogram.map((h) => h.count)), [histogram]);

  // Replay driver.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || days.length === 0) return undefined;
    timerRef.current = window.setInterval(() => {
      const current = useAppStore.getState().timelineCursor;
      const next = current + 1;
      if (next >= days.length - 1) {
        useAppStore.getState().setTimelineCursor(-1);
        useAppStore.getState().setTimelinePlaying(false);
      } else {
        useAppStore.getState().setTimelineCursor(next);
      }
    }, STEP_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [playing, days.length]);

  const atEnd = cursor >= days.length - 1;
  const activeIndex = cursor < 0 ? days.length - 1 : cursor;
  const activeDay = days[activeIndex] ?? '—';
  const shown = events.length;
  const total = beforeTimeline.length;

  return (
    <div className="pointer-events-auto flex h-[104px] flex-col rounded-glass glass-elevated px-4 py-3">
      <div className="mb-2.5 flex items-center gap-3">
        <SectionLabel>Detection timeline</SectionLabel>

        <div className="flex items-center gap-1">
          <IconButton
            label={playing ? 'Pause replay' : 'Play replay'}
            active={playing}
            onClick={() => {
              if (!playing && atEnd) setCursor(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </IconButton>
          <IconButton
            label="Reset to full window"
            onClick={() => {
              setPlaying(false);
              setCursor(-1);
            }}
          >
            <SkipBack className="h-3 w-3" />
          </IconButton>
        </div>

        <span className="font-mono text-[10px] tabular-nums text-[#DCE4EE]">{activeDay}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#6B7C90]">
          {cursor < 0 ? `${WINDOW_DAYS}-day window` : `Day ${cursor + 1} of ${days.length}`}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[10px] tabular-nums text-[#A9B6C6]">
            <span className="text-[#E8EDF3]">{shown.toLocaleString()}</span>
            <span className="text-[#6B7C90]"> / {total.toLocaleString()}</span>
          </span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-[#6B7C90] sm:inline">
            Peak {max}/day
          </span>
        </div>
      </div>

      {/* Histogram + scrubber */}
      <div className="relative flex min-h-0 flex-1 items-end">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded bg-white/[0.04]" />
        ) : (
          <div className="flex h-full w-full items-end gap-[2px]">
            {histogram.map((h, i) => {
              const past = i <= activeIndex;
              const isCursor = i === activeIndex && cursor >= 0;
              return (
                <button
                  key={h.date}
                  type="button"
                  data-cursor="button"
                  aria-label={`${h.date}: ${h.count} detections`}
                  onClick={() => {
                    setPlaying(false);
                    setCursor(i >= days.length - 1 ? -1 : i);
                  }}
                  onMouseEnter={() => {
                    if (cursor < 0) return;
                  }}
                  className="group relative flex-1 rounded-sm transition-all duration-150"
                  style={{
                    height: `${Math.max(3, (h.count / max) * 100)}%`,
                    background: isCursor
                      ? '#00D9FF'
                      : past
                        ? 'rgba(0,217,255,0.42)'
                        : 'rgba(148,163,184,0.16)',
                    boxShadow: isCursor ? '0 0 10px rgba(0,217,255,0.6)' : undefined,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Axis labels */}
      <div className="mt-1.5 flex justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-[#5A6B7F]">
        <span>{days[0]?.slice(5) ?? ''}</span>
        <span className={cn(cursor >= 0 && 'text-[#8FE6FF]')}>
          {cursor >= 0 ? 'Replay' : 'Full window'}
        </span>
        <span>{days[days.length - 1]?.slice(5) ?? ''}</span>
      </div>
    </div>
  );
}
