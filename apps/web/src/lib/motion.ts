/**
 * ONE MOTION SYSTEM.
 *
 * Every duration, easing curve and damping helper in the product comes from
 * here. Nothing else is allowed to invent a timing value — that is how the
 * previous build ended up with a hero, a map fade, a drawer and a cursor all
 * moving on unrelated curves and reading as four different products.
 *
 * Bands
 *   micro     180–220ms   hover, focus, press
 *   ui        300–450ms   panels, tabs, menus
 *   slow      700–1200ms  mode changes, camera moves on the map
 *   cinematic 1500–3000ms scroll-driven camera state changes
 *
 * No bounce, no elastic, no overshoot. This is an instrument, not a toy.
 */

export const DURATION = {
  micro: 200,
  ui: 380,
  slow: 900,
  cinematic: 2200,
} as const;

export const EASE = {
  /** Primary easing — fast start, long settle. Used for almost everything. */
  outExpo: [0.16, 1, 0.3, 1] as const,
  /** Symmetric — for anything that travels and returns (mode changes). */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Gentle acceleration — for elements leaving the screen. */
  inQuad: [0.5, 0, 0.75, 0] as const,
  /** Flat, continuous — for looping/scanning motion only. */
  linear: [0, 0, 1, 1] as const,
} as const;

export function cssEase(ease: readonly number[]): string {
  return `cubic-bezier(${ease.join(', ')})`;
}

/** CSS `transition` shorthand built from the shared tokens. */
export function transition(
  properties: string,
  duration: number = DURATION.ui,
  ease: readonly number[] = EASE.outExpo
): string {
  return `${properties} ${duration}ms ${cssEase(ease)}`;
}

// ── Numeric helpers ───────────────────────────────────────────────────────

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0 below `edge0`, 1 above `edge1`, linear between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  return clamp01((x - edge0) / (edge1 - edge0));
}

/** Hermite-smoothed ramp — no hard corners at the ends of the range. */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = smoothstep(edge0, edge1, x);
  return t * t * (3 - 2 * t);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutExpo(t: number): number {
  const x = clamp01(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * FRAME-RATE INDEPENDENT damping.
 *
 * The old code did `value += (target - value) * 0.05` once per frame, which
 * moves ~3x faster on a 144 Hz display than on a 60 Hz one. This is the
 * correct exponential-decay form: `smoothing` is the fraction of the remaining
 * distance left after one second.
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  if (smoothing <= 0) return target;
  return lerp(target, current, Math.exp(-dt / smoothing));
}

/**
 * Frame-rate independent damping expressed as a half-life: the value closes
 * half the remaining distance every `halfLifeSeconds`. Easier to reason about
 * than a raw smoothing constant when tuning camera mass.
 */
export function dampHalfLife(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target;
  return lerp(target, current, Math.pow(2, -dt / halfLife));
}

/** Clamp `dt` so a backgrounded tab cannot produce one enormous jump. */
export function clampDelta(dt: number, max = 0.05): number {
  return clamp(dt, 0, max);
}
