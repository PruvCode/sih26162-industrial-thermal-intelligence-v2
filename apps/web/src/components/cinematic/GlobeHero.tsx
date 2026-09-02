'use client';

/**
 * CINEMATIC HERO OVERLAY.
 *
 * Reads the shared journey state from the experience controller inside a rAF
 * loop and writes to the DOM through refs. It therefore never re-renders React
 * while scrolling — the previous build called setState on every scroll event,
 * which is a large part of why the hero felt heavy.
 */

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { experience, scrollToOperational } from '@/hooks/useExperience';
import { CINEMATIC_STATES, cinematicStateAt } from '@/lib/constants';
import { clamp01, smoothstep } from '@/lib/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const GlobeScene = dynamic(() => import('./GlobeScene'), { ssr: false });

interface GlobeHeroProps {
  onGlobeProgress?: (fraction: number) => void;
  onGlobeReady?: () => void;
}

export default function GlobeHero({ onGlobeProgress, onGlobeReady }: GlobeHeroProps) {
  const reducedMotion = useReducedMotion();

  const debugTarget =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugTarget');

  const copyRef = useRef<HTMLDivElement>(null);
  const breadcrumbRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<HTMLSpanElement>(null);
  const subRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastStateId = '';
    let lastActiveIndex = -1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = experience.cinematicProgress;
      const state = cinematicStateAt(p);

      // Editorial copy clears as the camera commits to Asia.
      const copyOut = smoothstep(0.16, 0.42, p);
      if (copyRef.current) {
        copyRef.current.style.opacity = String(clamp01(1 - copyOut));
        copyRef.current.style.transform = `translate3d(0, ${-copyOut * 42}px, 0)`;
        copyRef.current.style.pointerEvents = copyOut > 0.6 ? 'none' : 'auto';
      }

      // Journey chrome clears later — it is the instrument, not the headline.
      const chromeOut = smoothstep(0.5, 0.78, p);
      const chromeOpacity = String(clamp01(1 - chromeOut));

      if (breadcrumbRef.current) {
        const label = state.id === 'space' ? 'LOW EARTH ORBIT' : `${state.label} · ${state.sub.toUpperCase()}`;
        if (breadcrumbRef.current.textContent !== label) breadcrumbRef.current.textContent = label;
        breadcrumbRef.current.parentElement!.style.opacity = chromeOpacity;
      }

      if (stateRef.current && state.id !== lastStateId) {
        lastStateId = state.id;
        stateRef.current.textContent = state.label;
        if (subRef.current) subRef.current.textContent = state.sub;
      }

      if (progressRef.current) {
        progressRef.current.style.width = `${clamp01(p) * 100}%`;
        progressRef.current.parentElement!.style.opacity = chromeOpacity;
      }

      const activeIndex = CINEMATIC_STATES.findIndex((s) => s.id === state.id);
      if (stepsRef.current && activeIndex !== lastActiveIndex) {
        lastActiveIndex = activeIndex;
        const nodes = stepsRef.current.children;
        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i] as HTMLElement;
          const done = i < activeIndex;
          const active = i === activeIndex;
          el.style.opacity = active ? '1' : done ? '0.5' : '0.22';
          const dot = el.firstElementChild as HTMLElement | null;
          if (dot) {
            dot.style.background = active ? '#00D9FF' : done ? '#64748B' : '#253044';
            dot.style.boxShadow = active ? '0 0 10px rgba(0,217,255,0.55)' : 'none';
          }
          const label = el.querySelector('[data-step-label]') as HTMLElement | null;
          if (label) {
            label.style.color = active ? '#00D9FF' : done ? '#94A3B8' : '#334155';
            label.style.fontWeight = active ? '500' : '400';
          }
        }
        stepsRef.current.style.opacity = chromeOpacity;
      }

      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(clamp01(smoothstep(0.02, 0.1, p) * (1 - smoothstep(0.1, 0.3, p))));
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="absolute inset-0 overflow-hidden" aria-label="Cinematic introduction">
      <div className="absolute inset-0 z-0">
        <GlobeScene
          onProgress={onGlobeProgress}
          onReady={onGlobeReady}
          debugTarget={debugTarget}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Framing vignette — deepens the corners, keeps the planet forward. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(ellipse 78% 68% at 64% 46%, transparent 38%, rgba(4,6,10,0.34) 72%, rgba(4,6,10,0.72) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] hidden xl:block"
        style={{ background: 'linear-gradient(90deg, rgba(5,7,11,0.62) 0%, rgba(5,7,11,0.18) 30%, transparent 52%)' }}
      />

      {/* Editorial column */}
      <div
        ref={copyRef}
        className="absolute z-10 flex h-full flex-col justify-center px-6 pb-[200px] sm:px-10 lg:px-16 xl:px-20"
        style={{ willChange: 'opacity, transform' }}
      >
        <span className="mb-5 block font-mono text-[10px] uppercase tracking-[0.28em] text-[#93A2B5]">
          Global Observation System
        </span>

        <h1
          className="max-w-[15ch] font-display font-normal text-[#FBFCFD] xl:max-w-[9ch]"
          style={{
            fontSize: 'clamp(2.6rem, 6.4vw, 6.1rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.018em',
            textShadow: '0 2px 44px rgba(0,0,0,0.6)',
          }}
        >
          Industrial
          <br />
          Thermal
          <br />
          Intelligence
        </h1>

        <p className="mt-7 max-w-[42ch] text-[15px] font-light leading-[1.75] text-[#B4C0CF]">
          Satellite detection and classification of industrial thermal anomalies across
          India — from orbital observation to investigation.
        </p>

        <button
          type="button"
          data-cursor="button"
          onClick={() => scrollToOperational(!reducedMotion)}
          className="group mt-9 inline-flex w-fit items-center gap-3 rounded-full border border-white/[0.12] px-6 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8EDF3] transition-all duration-200 hover:-translate-y-px hover:translate-x-[2px] hover:border-[rgba(0,217,255,0.34)] hover:bg-[rgba(0,217,255,0.05)] hover:text-[#8FE6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00D9FF]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
        >
          Explore Intelligence
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <path d="M1 7h11M8 3l4 4-4 4" />
          </svg>
        </button>

        {/* Two facts, not one string: a live status and the instruments feeding
            it. Previously joined by a middot inside a single tracked-out run,
            which read as punctuation soup at 9px. The hairline does the
            separating now, so the tracking can come down and the type can go
            up. Sits closer to the button than the button does to the paragraph
            — they are one cluster. */}
        <div
          data-testid="hero-status"
          className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-[6px] w-[6px] shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#22C55E]/40" style={{ animation: 'statusBreath 3.5s ease-in-out infinite' }} />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-[#22C55E]/70" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5FCB7E]">
              System active
            </span>
          </span>

          {/* Whitespace-only text nodes: a flex container does not render them
              as items, so they cost nothing visually, but they stop the two
              facts being announced as "System activeVIIRS / MODIS". */}
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-white/[0.14]" />{' '}

          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6A7A8E]">
            VIIRS <span className="text-[#3E4B5B]">/</span> MODIS
          </span>
        </div>
      </div>

      {/* Journey chrome */}
      <div className="pointer-events-none absolute bottom-7 left-0 right-0 z-10 px-6 sm:px-10 lg:px-16 xl:px-20">
        <div className="mb-5 flex items-end justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span ref={breadcrumbRef} className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#78889C]">
              LOW EARTH ORBIT
            </span>
          </div>
          <div className="hidden text-right sm:block">
            <span ref={stateRef} className="block font-display text-[22px] leading-none tracking-[0.04em] text-[#DCE4EE]">
              SPACE
            </span>
            <span ref={subRef} className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-[#6A7A8E]">
              Orbital insertion
            </span>
          </div>
        </div>

        <div className="relative mb-4 h-px bg-white/[0.06]">
          <div ref={progressRef} className="absolute left-0 top-0 h-full bg-[rgba(0,217,255,0.45)]" style={{ width: '0%' }} />
        </div>

        <div ref={stepsRef} className="hidden gap-1 md:flex">
          {CINEMATIC_STATES.map((step) => (
            <div key={step.id} className="flex flex-1 flex-col gap-1.5 transition-opacity duration-500" style={{ opacity: 0.22 }}>
              <div className="flex items-center gap-2">
                <span className="h-[5px] w-[5px] rounded-full bg-[#253044] transition-all duration-500" />
                <span data-step-label className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#334155] transition-colors duration-500">
                  {step.label}
                </span>
              </div>
              <span className="pl-[13px] text-[10px] leading-tight text-[#4A5A6E]">{step.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll affordance */}
      <div ref={scrollHintRef} className="pointer-events-none absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex" style={{ opacity: 0 }}>
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#6A7A8E]" style={{ writingMode: 'vertical-rl' }}>
          Scroll to descend
        </span>
        <div className="relative h-10 w-px overflow-hidden bg-white/[0.06]">
          <div className="absolute inset-x-0 h-full bg-gradient-to-b from-[#6A7A8E] to-transparent" style={{ animation: 'scrollDrift 3s ease-in-out infinite' }} />
        </div>
      </div>
    </section>
  );
}
