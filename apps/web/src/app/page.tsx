'use client';

/**
 * APPLICATION SHELL — the scroll experience.
 *
 * ── Geometry ──────────────────────────────────────────────────────────────
 * The document is a tall scroll spacer plus a `position: fixed` stage. No
 * negative margins, no pulling sections back over each other. That is what
 * makes `scrollY / maxScroll` reach exactly 1 at the bottom — the property the
 * previous build destroyed with `marginTop: -100vh`, leaving the operational
 * map permanently stuck at 46% opacity.
 *
 * ── Wheel ownership ───────────────────────────────────────────────────────
 * The page owns the wheel for the entire journey. The map's `scrollZoom` is
 * disabled for its whole lifetime; zoom is cooperative (Ctrl/Cmd + wheel).
 * There is therefore no state in which the map can trap the page, so reverse
 * scrolling works by construction rather than by hysteresis luck.
 *
 * ── Depth planes ─────────────────────────────────────────────────────────
 *   z-0   handoff backdrop           → ambient floor, never lets it go black
 *   z-0   globe (cinematic)          → fades out across the descent
 *   z-10  observation overlay        → intermediate, fades in then out
 *   z-20  map (operational)          → fades in, becomes the ground
 *   z-30  floating panels            → navigator, investigation, timeline
 *   z-40  navigation + status bar
 *   z-50  degraded banner
 *   z-60  loading screen
 *   z-70  report modal
 *
 * ── The handoff ──────────────────────────────────────────────────────────
 * Backdrop, globe dissolve, observation view and map all take their ramps from
 * HANDOFF in lib/constants.ts, in RAW progress. They previously ran on three
 * different clocks, which left 143vh of black screen between the planet and
 * the map. Do not reintroduce per-layer magic numbers here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { SCROLL_VH, useExperience } from '@/hooks/useExperience';
import { useAppStore } from '@/store/useAppStore';
import { useAllEvents, useDensity } from '@/features/events/hooks';
import { useFilteredEvents } from '@/features/events/useFilteredEvents';
import { densityToGeoJSON, eventsToGeoJSON } from '@/lib/adapters/geojson';
import { formatDate } from '@/lib/formatters';
import { DEMO_REFERENCE_DATE } from '@/data/dataset';
import { clamp01, smootherstep } from '@/lib/motion';
import { cn } from '@/lib/utils';

import GlobeHero from '@/components/cinematic/GlobeHero';
import { HandoffBackdrop } from '@/components/cinematic/HandoffBackdrop';
import { ObservationLayer } from '@/components/cinematic/ObservationLayer';
import Map from '@/components/map/Map';
import { TopNavigation } from '@/components/layout/TopNavigation';
import { StatusBar } from '@/components/layout/StatusBar';
import { EventNavigator } from '@/components/navigator/EventNavigator';
import { Timeline } from '@/components/timeline/Timeline';
import { InvestigationPanel } from '@/components/investigation/InvestigationPanel';
import { AnalyticsView } from '@/components/views/AnalyticsView';
import { EventsExplorer } from '@/components/views/EventsExplorer';
import { Watchtower } from '@/components/views/Watchtower';
import { AboutView } from '@/components/views/AboutView';
import { DegradedBanner } from '@/components/ui/primitives';

const LoadingScreen = dynamic(() => import('@/components/ui/LoadingScreen'), { ssr: false });
const CustomCursor = dynamic(() => import('@/components/ui/CustomCursor'), { ssr: false });

type LoadStage = 'earth' | 'atmosphere' | 'geospatial' | 'events';

export default function HomePage() {
  useExperience();

  const view = useAppStore((s) => s.view);
  const mode = useAppStore((s) => s.mode);
  const reveal = useAppStore((s) => s.operationalReveal);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const hoveredEventId = useAppStore((s) => s.hoveredEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const hoverEvent = useAppStore((s) => s.hoverEvent);
  const layers = useAppStore((s) => s.layers);
  const degraded = useAppStore((s) => s.mapDegraded);
  const setMapDegraded = useAppStore((s) => s.setMapDegraded);
  const navigatorOpen = useAppStore((s) => s.navigatorOpen);

  const { data: allData } = useAllEvents();
  const { data: densityData } = useDensity();
  const { events, total } = useFilteredEvents();

  // ── Real loading, not a timer ───────────────────────────────────────────
  const [earthProgress, setEarthProgress] = useState(0);
  const [stages, setStages] = useState<Record<LoadStage, boolean>>({
    earth: false,
    atmosphere: false,
    geospatial: false,
    events: false,
  });
  const [loaded, setLoaded] = useState(false);

  const markStage = useCallback((stage: LoadStage, done = true) => {
    setStages((s) => (s[stage] === done ? s : { ...s, [stage]: done }));
  }, []);

  const handleGlobeProgress = useCallback((f: number) => {
    setEarthProgress((p) => (f > p ? f : p));
  }, []);

  const handleGlobeReady = useCallback(() => {
    setEarthProgress(1);
    markStage('earth');
    markStage('atmosphere');
  }, [markStage]);

  const handleMapReady = useCallback(() => markStage('geospatial'), [markStage]);

  // Events are "loaded" when the dataset has actually resolved — not when a
  // timer says so.
  const eventCount = allData?.data?.length ?? 0;
  useEffect(() => {
    if (eventCount > 0) markStage('events');
  }, [eventCount, markStage]);

  // ── Map input ───────────────────────────────────────────────────────────
  const features = useMemo(() => eventsToGeoJSON(events), [events]);
  const densityFeatures = useMemo(() => densityToGeoJSON(densityData?.data ?? []), [densityData]);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const handleCoordinates = useCallback((lng: number, lat: number) => {
    setCoords((c) => (c && Math.abs(c.lat - lat) < 1e-4 && Math.abs(c.lng - lng) < 1e-4 ? c : { lat, lng }));
  }, []);
  const handleMapClick = useCallback(() => selectEvent(null), [selectEvent]);

  // ── Reveal ramps ────────────────────────────────────────────────────────
  // The globe owns the screen until the descent commits; the map then takes
  // over and reaches full opacity. `reveal` is already quantised to 1/200.
  const globeOpacity = clamp01(1 - smootherstep(0.72, 0.97, reveal));
  // Reaches full opacity at reveal 0.55 (raw ~0.90). The map is what has to
  // catch the globe as it dissolves — if it is still near zero when the planet
  // is gone, screen brightness troughs below its final value and reads as a
  // blink. The layer's own rAF hides it below 0.01.
  const mapOpacity = clamp01(smootherstep(0.0, 0.55, reveal));
  const chromeOpacity = clamp01(smootherstep(0.35, 1, reveal));
  const operational = mode === 'operational' && reveal > 0.9;
  const showChrome = mode === 'operational';

  const breadcrumb = useMemo(() => {
    if (!selectedEventId) return ['EARTH', 'INDIA', 'ALL REGIONS'];
    const e = events.find((x) => x.id === selectedEventId);
    if (!e) return ['EARTH', 'INDIA', 'ALL REGIONS'];
    return [
      'EARTH',
      'INDIA',
      (e.enrichment?.admin?.state ?? 'UNKNOWN').toUpperCase(),
      (e.enrichment?.admin?.district ?? 'UNKNOWN').toUpperCase(),
    ];
  }, [selectedEventId, events]);

  return (
    <>
      {!loaded && (
        <LoadingScreen
          earthProgress={earthProgress}
          stages={stages}
          onComplete={() => setLoaded(true)}
        />
      )}

      <CustomCursor />

      {/* Scroll spacer — this, and only this, creates the scrollable height. */}
      <div style={{ height: `${SCROLL_VH}vh` }} aria-hidden="true" />

      {/* ── Fixed stage ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#05070B]">
        {/* z-0 — ambient floor. Declared before the globe so it paints beneath
            it at the same stacking level; purely decorative, never interactive. */}
        <HandoffBackdrop />

        {/* z-0 — cinematic globe */}
        <div
          data-testid="stage-globe"
          className="absolute inset-0 z-0"
          style={{
            opacity: globeOpacity,
            pointerEvents: globeOpacity > 0.05 ? 'auto' : 'none',
            visibility: globeOpacity < 0.01 ? 'hidden' : 'visible',
          }}
        >
          <GlobeHero onGlobeProgress={handleGlobeProgress} onGlobeReady={handleGlobeReady} />
        </div>

        {/* z-10 — observation overlay */}
        <div
          data-testid="stage-observation"
          className="absolute inset-0 z-10"
          style={{
            pointerEvents: 'none',
            // Was `globeOpacity < 0.99 && mapOpacity < 0.99`. globeOpacity is
            // derived from `reveal`, which is 0 until raw 0.86 — so the first
            // clause was never true and this bridge NEVER rendered, leaving the
            // observation band with nothing on screen at all.
            // `reveal` alone is the right gate, and it must sit above where
            // the layer's own fade-out finishes (raw 0.94) or the bridge gets
            // clipped while still partly opaque and pops.
            visibility: reveal < 0.995 ? 'visible' : 'hidden',
          }}
        >
          <ObservationLayer
            lastUpdated={formatDate(DEMO_REFERENCE_DATE)}
            eventCount={total}
            operationalReveal={reveal}
          />
        </div>

        {/* z-20 — operational map */}
        <div
          data-testid="stage-map"
          className="absolute inset-0 z-20"
          style={{
            opacity: mapOpacity,
            visibility: mapOpacity < 0.01 ? 'hidden' : 'visible',
          }}
        >
          <Map
            features={features}
            densityFeatures={densityFeatures}
            selectedEventId={selectedEventId}
            hoveredEventId={hoveredEventId}
            layers={layers}
            interactive={operational}
            opacity={mapOpacity}
            onEventClick={selectEvent}
            onMapClick={handleMapClick}
            onHover={hoverEvent}
            onCoordinates={handleCoordinates}
            onDegradedChange={setMapDegraded}
            onReady={handleMapReady}
          />
        </div>

        {/* ── Operational chrome ───────────────────────────────────────── */}
        <div
          data-testid="operational-chrome"
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            opacity: chromeOpacity,
            visibility: showChrome ? 'visible' : 'hidden',
          }}
        >
          {/* Full-surface views sit above the map but below the top nav. */}
          {view !== 'command' && (
            <div className="pointer-events-auto absolute inset-0 top-[52px] overflow-hidden bg-[#070A10]/92 backdrop-blur-xl">
              {view === 'analytics' && <AnalyticsView />}
              {view === 'events' && <EventsExplorer />}
              {view === 'watchtower' && <Watchtower />}
              {view === 'about' && <AboutView />}
            </div>
          )}

          {view === 'command' && (
            <>
              {/* Left — event navigator rail. Bottom offset clears the timeline
                  (which spans bottom-[46px]→~bottom-[150px]) so the panel footer
                  never sits under the scrubber and eats pointer events. The map
                  layer control lives inside the navigator itself — a layers icon
                  in its controls row expands a collapsible section — so it only
                  ever exists on the command view, docked in the sidebar. */}
              <div
                className={cn(
                  'absolute bottom-[158px] left-4 top-[68px] z-30 flex w-[336px] flex-col transition-transform [transition-duration:420ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                  navigatorOpen ? 'translate-x-0' : '-translate-x-[calc(100%+16px)]'
                )}
              >
                <div className="min-h-0 flex-1">
                  <EventNavigator />
                </div>
              </div>

              {/* Right — investigation panel. Same bottom offset as the navigator:
                  its footer Report button must be above the timeline band or the
                  scrubber intercepts the click. */}
              <div className="absolute bottom-[158px] right-4 top-[68px] z-30 flex justify-end">
                <InvestigationPanel />
              </div>

              {/* Bottom — temporal replay */}
              <div className="absolute bottom-[46px] left-4 right-4 z-30">
                <Timeline />
              </div>
            </>
          )}

          {/* Degraded basemap notice */}
          {degraded && (
            <div className="absolute left-1/2 top-[68px] z-50 -translate-x-1/2">
              <DegradedBanner detail="Tile server unreachable — vector layers and analytics remain live." />
            </div>
          )}
        </div>

        {/* z-40 — persistent navigation + status */}
        <TopNavigation reveal={reveal} />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
          style={{
            opacity: chromeOpacity,
            visibility: showChrome ? 'visible' : 'hidden',
          }}
        >
          <StatusBar
            coordinates={coords}
            breadcrumb={breadcrumb}
            visibleCount={events.length}
            totalCount={total}
            degraded={degraded}
          />
        </div>
      </div>
    </>
  );
}
