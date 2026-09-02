'use client';

/**
 * THE SCROLL EXPERIENCE CONTROLLER.
 *
 * Architecture
 * ────────────
 * The page is a tall scroll spacer plus a `position: fixed` stage. Nothing is
 * pulled up with negative margins, so `scrollY / maxScroll` reaches exactly 1
 * at the bottom of the document — the property the previous build destroyed
 * with `marginTop: -100vh`, which capped the operational map at 46% opacity
 * forever.
 *
 * Wheel ownership is explicit and absolute:
 *   CINEMATIC   page owns the wheel. Map is inert and non-interactive.
 *   OBSERVATION page owns the wheel. Map is inert and non-interactive.
 *   OPERATIONAL map owns pointer interaction, but `scrollZoom` stays disabled
 *               forever, so the bare wheel always scrolls the page. Zoom is
 *               cooperative (Ctrl/Cmd + wheel).
 *
 * There is therefore no state in which the map can trap the page, and reverse
 * scrolling works by construction rather than by hysteresis luck.
 *
 * Performance
 * ───────────
 * Continuous progress is published to `experience.progress`, read imperatively
 * inside rAF loops (the globe camera). React only sees *quantised* mode and
 * reveal values, so scrolling produces a few dozen renders for the entire
 * journey instead of one per scroll event.
 */

import { useEffect } from 'react';
import { cinematicStateAt } from '@/lib/constants';
import { clamp01, smoothstep } from '@/lib/motion';
import { useAppStore, type ExperienceMode } from '@/store/useAppStore';

/** Total scrollable height of the cinematic spacer, in viewport heights. */
export const SCROLL_VH = 420;

/** Journey boundaries over the 0..1 document progress. */
export const OBSERVATION_START = 0.68;
export const OPERATIONAL_START = 0.86;

/**
 * Reveal ramp for `operationalProgress`.
 *
 * Deliberately starts BEFORE OPERATIONAL_START. The map has to begin rising
 * while the globe is still on screen, otherwise the planet fades out into
 * nothing and the brightness curves trough below where it ends up — a visible
 * dip to near-dark just before the dashboard settles. See HANDOFF in
 * lib/constants.ts; the two ramps are tuned against each other.
 */
const REVEAL_START = 0.82;
const REVEAL_END = 0.96;

/** Hysteresis band so parking on the boundary cannot flap the mode. */
const OPERATIONAL_ENTER = 0.865;
const OPERATIONAL_EXIT = 0.84;
const OBSERVATION_ENTER = 0.685;
const OBSERVATION_EXIT = 0.665;

/**
 * Module-level continuous state. Read from rAF loops; never through React.
 */
export const experience = {
  /** 0..1 progress through the whole journey. Reaches exactly 1. */
  progress: 0,
  /** 0..1 progress through the cinematic globe sequence. */
  cinematicProgress: 0,
  /** 0..1 reveal of the observation overlay. */
  observationProgress: 0,
  /** 0..1 reveal of the operational map + UI. Reaches exactly 1. */
  operationalProgress: 0,
  mode: 'cinematic' as ExperienceMode,
  /** True once the globe has fully handed off and three.js must stop rendering. */
  cinematicSettled: false,
  /** Highest progress reached this session — used to avoid re-animating. */
  maxProgress: 0,
};

export interface ExperienceSnapshot {
  mode: ExperienceMode;
  cinematicStateId: string;
  operationalReveal: number;
  observationReveal: number;
}

function resolveMode(p: number, current: ExperienceMode): ExperienceMode {
  if (current === 'operational') {
    if (p >= OPERATIONAL_ENTER) return 'operational';
    if (p < OPERATIONAL_EXIT) return p >= OBSERVATION_EXIT ? 'observation' : 'cinematic';
    return 'observation';
  }
  if (current === 'observation') {
    if (p >= OPERATIONAL_ENTER) return 'operational';
    if (p < OBSERVATION_EXIT) return 'cinematic';
    return 'observation';
  }
  // cinematic
  if (p >= OPERATIONAL_ENTER) return 'operational';
  if (p >= OBSERVATION_ENTER) return 'observation';
  return 'cinematic';
}

/**
 * Install the controller. Call exactly once, from the experience root.
 */
export function useExperience(): void {
  const setExperience = useAppStore((s) => s.setExperience);

  useEffect(() => {
    let raf: number | null = null;
    let disposed = false;

    const measure = () => {
      raf = null;
      if (disposed) return;

      const vh = window.innerHeight;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
      const p = clamp01(window.scrollY / maxScroll);

      experience.progress = p;
      experience.maxProgress = Math.max(experience.maxProgress, p);
      experience.cinematicProgress = smoothstep(0, OBSERVATION_START, p);
      experience.observationProgress = smoothstep(OBSERVATION_START, OPERATIONAL_START, p);
      experience.operationalProgress = smoothstep(REVEAL_START, REVEAL_END, p);
      experience.mode = resolveMode(p, experience.mode);
      experience.cinematicSettled = p > 0.995;

      // Quantise before it reaches React: 1/200 steps means at most ~200
      // renders across the entire 420vh journey, and panel animations read as
      // continuous because they are CSS transitions between those steps.
      const reveal = Math.round(experience.operationalProgress * 200) / 200;
      const state = cinematicStateAt(experience.cinematicProgress);
      setExperience(experience.mode, state.id, reveal);
    };

    const schedule = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      disposed = true;
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [setExperience]);
}

/** Scroll to a journey position expressed in 0..1 document progress. */
export function scrollToProgress(p: number, smooth = true): void {
  const vh = window.innerHeight;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  window.scrollTo({
    top: clamp01(p) * maxScroll,
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
  });
}

/** Scroll to the exact top of the operational state. */
export function scrollToOperational(smooth = true): void {
  scrollToProgress(1, smooth);
}

/** Scroll back to the top of the cinematic hero. */
export function scrollToHero(smooth = true): void {
  scrollToProgress(0, smooth);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
