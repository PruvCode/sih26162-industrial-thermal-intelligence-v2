'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks `prefers-reduced-motion`.
 *
 * Returns false during SSR and the first client render so markup matches, then
 * syncs on mount. Every motion consumer in the product gates on this.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
