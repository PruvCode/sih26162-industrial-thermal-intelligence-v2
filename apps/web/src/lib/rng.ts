/**
 * Deterministic pseudo-random generation.
 *
 * The demo dataset must be identical on the server and the client, and stable
 * across reloads — otherwise hydration mismatches and "the number changed
 * between renders" bugs. Everything synthetic goes through these helpers with
 * an explicit seed.
 */

/** mulberry32 — small, fast, good enough distribution for demo data. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit string hash, so a seed can be derived from an id. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
  /** Pick one element. */
  pick<T>(items: readonly T[]): T;
  /** Weighted pick — weights need not sum to 1. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** true with probability p. */
  chance(p: number): boolean;
  /**
   * Approximately normal via a sum of uniforms (Irwin–Hall). Clamped to
   * [0, 1] so it can be used directly as a normalised "how extreme" factor.
   */
  bell(): number;
  /** Independent sub-stream derived from a label — keeps draws decoupled. */
  fork(label: string): Rng;
}

export function createRng(seed: number | string): Rng {
  const numericSeed = typeof seed === 'string' ? hashString(seed) : seed;
  const rng = mulberry32(numericSeed);

  const api: Rng = {
    next: rng,
    range: (min, max) => min + rng() * (max - min),
    int: (min, max) => Math.floor(min + rng() * (max - min + 1)),
    pick: (items) => items[Math.floor(rng() * items.length)],
    weighted: (items, weights) => {
      const total = weights.reduce((a, b) => a + b, 0);
      let r = rng() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
    chance: (p) => rng() < p,
    bell: () => {
      const s = rng() + rng() + rng();
      return Math.min(1, Math.max(0, s / 3));
    },
    fork: (label) => createRng(hashString(`${label}:${numericSeed}`)),
  };

  return api;
}
