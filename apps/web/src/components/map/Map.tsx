'use client';

/**
 * OPERATIONAL MAP.
 *
 * Map-first surface. Everything else in the operational view floats above it.
 *
 * Audit fixes carried here:
 *  - `promoteId: 'id'` + paint properties that actually READ `feature-state`,
 *    so hovering or selecting an event visibly changes the marker. The old
 *    build wrote feature state that nothing consumed.
 *  - Cluster step expressions are valid input/output pairs, and the font stack
 *    is one the CARTO glyph endpoint actually serves.
 *  - Radius encodes fire radiative power, not just zoom.
 *  - Framing is `fitBounds` on the India AOI with panel-aware padding, so the
 *    framing holds from 1024×768 to 1920×1080.
 *  - Exactly one camera move per selection, guarded by a ref, so a click can
 *    no longer trigger two competing `flyTo` calls.
 *  - `scrollZoom` is disabled for the lifetime of the map. The bare wheel
 *    belongs to the page; zoom is cooperative (Ctrl/Cmd + wheel). This is the
 *    structural fix for the reverse-scroll trap.
 *  - Tile/style/glyph failures are counted and surface a degraded banner
 *    instead of an empty black void.
 */

import { useEffect, useRef } from 'react';
import maplibregl, { type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { EventGeoJSON } from '@/types/event';
import type { LayerState } from '@/store/useAppStore';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  FALLBACK_STYLE,
  GLYPH_FONT,
  LAYER_IDS,
  MAP_STYLE,
  SATELLITE_SOURCE,
} from '@/lib/constants';
import { INDIA_AOI_BOUNDS, flyToPaddingForViewport, mapPaddingForViewport } from '@/lib/geo';
import { facilitiesToGeoJSON, INDIA_OUTLINE } from '@/lib/adapters/geojson';
import { INDUSTRIAL_FACILITIES } from '@/data/regions';
import { clamp01 } from '@/lib/motion';

export interface MapProps {
  /** Detections, as produced by the adapter. A collection, not an array. */
  features: EventGeoJSON;
  /** Gridded event density for the regional heatmap layer. */
  densityFeatures?: GeoJSON.FeatureCollection;
  selectedEventId: string | null;
  /** Hover driven from outside the map (the event navigator list). The map's
   *  own hit-testing and this prop resolve to the same feature-state, so the
   *  highlight is identical whichever surface the pointer is over. */
  hoveredEventId?: string | null;
  layers: LayerState;
  /** True only in OPERATIONAL mode. Below that the map captures nothing. */
  interactive: boolean;
  /** 0..1 — map opacity, driven by the scroll experience. */
  opacity: number;
  onEventClick: (id: string) => void;
  onMapClick: () => void;
  onHover: (id: string | null) => void;
  onCoordinates: (lng: number, lat: number) => void;
  onDegradedChange: (degraded: boolean) => void;
  onReady?: () => void;
}

/** Number of tile/glyph errors before we declare the basemap unusable. */
const DEGRADED_ERROR_THRESHOLD = 6;

/** Stable empty collection — a fresh literal would re-trigger the data effect. */
const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function Map({
  features,
  densityFeatures = EMPTY_COLLECTION,
  selectedEventId,
  hoveredEventId = null,
  layers,
  interactive,
  opacity,
  onEventClick,
  onMapClick,
  onHover,
  onCoordinates,
  onDegradedChange,
  onReady,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);

  // Callbacks live in refs: the map is constructed once and must not be torn
  // down and rebuilt every time a parent re-renders with a new closure.
  const cb = useRef({ onEventClick, onMapClick, onHover, onCoordinates, onDegradedChange, onReady });
  cb.current = { onEventClick, onMapClick, onHover, onCoordinates, onDegradedChange, onReady };

  /** Set by the map setup effect so external hover can drive feature-state. */
  const setHoverRef = useRef<((id: string | null) => void) | null>(null);

  const interactiveRef = useRef(interactive);
  const featuresRef = useRef(features);
  const selectedRef = useRef<string | null>(null);
  /** Guards against a second camera move for the same selection. */
  const lastFlownRef = useRef<string | null>(null);
  /** Guards against repeating the initial framing. */
  const framedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let errorCount = 0;
    let degraded = false;
    let disposed = false;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [79.5, 21],
      zoom: 4.2,
      attributionControl: false,
      antialias: true,
      // Every handler starts disabled. They are switched on by `interactive`.
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      touchZoomRotate: false,
      dragRotate: false,
      touchPitch: false,
      fadeDuration: 180,
    });
    mapRef.current = map;

    const markDegraded = (reason: string) => {
      if (degraded || disposed) return;
      degraded = true;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[map] basemap degraded:', reason);
      }
      // Swap to a locally-defined style so the map renders *something* and the
      // event layers above it keep working.
      try {
        map.setStyle(FALLBACK_STYLE as unknown as maplibregl.StyleSpecification);
      } catch {
        /* the fallback is the last resort; nothing further to try */
      }
      cb.current.onDegradedChange(true);
    };

    map.on('error', (e) => {
      errorCount += 1;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[maplibre]', (e as unknown as { error?: Error }).error?.message ?? e);
      }
      if (errorCount >= DEGRADED_ERROR_THRESHOLD) markDegraded(`${errorCount} tile/glyph errors`);
    });

    map.on('style.load', () => {
      if (disposed) return;
      // Exposed for the automated journey test to read the live camera. It is
      // a read-only probe; nothing in the application reads it back.
      (window as unknown as { __sihMap?: maplibregl.Map }).__sihMap = map;
      if (!map.getSource('events')) addSourcesAndLayers(map);
      // Tile failures only count after the style resolves; the style itself
      // failing is handled by the timeout below.
      window.setTimeout(() => {
        if (!disposed && !readyRef.current) {
          readyRef.current = true;
          cb.current.onReady?.();
        }
      }, 0);
    });

    // If the style has not arrived, the CDN is unreachable. Do not leave the
    // operator staring at nothing.
    const styleTimeout = window.setTimeout(() => {
      if (!disposed && !readyRef.current) {
        readyRef.current = true;
        markDegraded('style load timeout');
        cb.current.onReady?.();
      }
    }, 9000);

    function addSourcesAndLayers(m: maplibregl.Map) {
      // ── Satellite context (bottom of the stack) ───────────────────────
      if (!m.getSource(SATELLITE_SOURCE.id)) {
        m.addSource(SATELLITE_SOURCE.id, {
          type: 'raster',
          tiles: SATELLITE_SOURCE.tiles,
          tileSize: SATELLITE_SOURCE.tileSize,
          maxzoom: SATELLITE_SOURCE.maxzoom,
          attribution: SATELLITE_SOURCE.attribution,
        });
        m.addLayer(
          {
            id: LAYER_IDS.satellite,
            type: 'raster',
            source: SATELLITE_SOURCE.id,
            paint: { 'raster-opacity': 0.55, 'raster-contrast': -0.12, 'raster-saturation': -0.3 },
            layout: { visibility: 'none' },
          },
          // Insert below everything so the vector basemap still reads through.
          m.getLayer('water') ? 'water' : undefined
        );
      }

      // ── Administrative outline ────────────────────────────────────────
      if (!m.getSource('admin')) {
        m.addSource('admin', { type: 'geojson', data: INDIA_OUTLINE });
        m.addLayer({
          id: LAYER_IDS.adminLine,
          type: 'line',
          source: 'admin',
          layout: { visibility: 'none' },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'primary'], true],
              'rgba(0,217,255,0.55)',
              'rgba(148,163,184,0.28)',
            ],
            'line-width': ['case', ['==', ['get', 'primary'], true], 1.3, 0.8],
            'line-dasharray': [3, 2],
          },
        });
      }

      // ── Industrial sites ──────────────────────────────────────────────
      if (!m.getSource('industrial')) {
        m.addSource('industrial', { type: 'geojson', data: facilitiesToGeoJSON(INDUSTRIAL_FACILITIES) });
        m.addLayer({
          id: LAYER_IDS.industrial,
          type: 'circle',
          source: 'industrial',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 8, 4, 12, 6],
            'circle-color': 'rgba(15,23,42,0.85)',
            'circle-stroke-color': 'rgba(148,163,184,0.75)',
            'circle-stroke-width': 1.1,
          },
        });
        m.addLayer({
          id: LAYER_IDS.industrialLabel,
          type: 'symbol',
          source: 'industrial',
          minzoom: 7,
          layout: {
            visibility: 'none',
            'text-field': ['get', 'name'],
            'text-font': GLYPH_FONT,
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#8FA0B4',
            'text-halo-color': 'rgba(5,7,11,0.9)',
            'text-halo-width': 1.2,
          },
        });
      }

      // ── Regional density heatmap ──────────────────────────────────────
      if (!m.getSource('density')) {
        m.addSource('density', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        m.addLayer({
          id: LAYER_IDS.heatmap,
          type: 'heatmap',
          source: 'density',
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 0, 0, 60, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 2.2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 26, 6, 42, 9, 70],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 10, 0],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, 'rgba(30,64,120,0.45)',
              0.4, 'rgba(0,217,255,0.45)',
              0.6, 'rgba(250,204,21,0.55)',
              0.8, 'rgba(249,115,22,0.65)',
              1, 'rgba(239,68,68,0.75)',
            ],
          },
        });
      }

      // ── Thermal events ────────────────────────────────────────────────
      if (!m.getSource('events')) {
        m.addSource('events', {
          type: 'geojson',
          data: featuresRef.current,
          cluster: true,
          clusterRadius: CLUSTER_RADIUS,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
          // REQUIRED for feature-state: without it every setFeatureState call
          // silently targets a feature id the source never minted.
          promoteId: 'id',
        });

        // MapLibre's spec types are structural unions that TS cannot infer
        // from a bare array literal, so both expressions are declared once
        // against the spec type and reused across layers.

        /** Map-only brightened classification palette — same hues as
         *  EVENT_COLORS (which the list, charts and legends keep) but lifted
         *  in lightness so detections pop against the dark basemap. */
        const classColor: ExpressionSpecification = [
          'match',
          ['get', 'class'],
          'industrial_fire', '#FF6B6B',
          'persistent_thermal_source', '#FFA94D',
          'natural_wildfire', '#FFE066',
          '#94A3B8',
        ];

        /** Per-feature FRP multiplier for the radius stops: low-power events
         *  stay small, high-power events read as “this point is hotter”. */
        const intensityFactor: ExpressionSpecification = [
          '+',
          0.55,
          ['*', 0.6, ['coalesce', ['get', 'intensity'], 0.3]],
        ];

        /**
         * Zoom-driven radius. `zoom` MUST be the input of a TOP-LEVEL
         * interpolate — MapLibre silently DROPS the whole layer when `zoom`
         * is nested inside arithmetic (the audit build shipped exactly that
         * bug: events-glow and events-core never rendered, leaving only
         * clusters visible). `scale` multiplies every stop: 1 for the core,
         * 1.8 for the bloom. Base tightened ~25% from the audit build.
         */
        const radiusWith = (scale: number): ExpressionSpecification => [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, ['*', 1.7 * scale, intensityFactor],
          6, ['*', 2.8 * scale, intensityFactor],
          9, ['*', 4.2 * scale, intensityFactor],
          13, ['*', 6.5 * scale, intensityFactor],
          16, ['*', 9.5 * scale, intensityFactor],
        ];

        // Outer thermal bloom — the gradient. 1.8× the core with a soft
        // edge, so the falloff hugs the detection instead of smearing
        // across the surrounding region.
        m.addLayer({
          id: LAYER_IDS.eventsGlow,
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          layout: { visibility: layers.events ? 'visible' : 'none' },
          paint: {
            'circle-color': classColor,
            'circle-radius': radiusWith(1.8),
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 0.42,
              ['boolean', ['feature-state', 'selected'], false], 0.4,
              0.22,
            ],
            'circle-blur': 0.55,
          },
        });

        // Core marker — reads feature-state for both hover and selection.
        m.addLayer({
          id: LAYER_IDS.eventsCore,
          type: 'circle',
          source: 'events',
          filter: ['!', ['has', 'point_count']],
          layout: { visibility: layers.events ? 'visible' : 'none' },
          paint: {
            'circle-color': classColor,
            'circle-radius': radiusWith(1),
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 1,
              ['boolean', ['feature-state', 'selected'], false], 1,
              0.95,
            ],
            'circle-stroke-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#FFFFFF',
              ['boolean', ['feature-state', 'hover'], false], 'rgba(255,255,255,0.85)',
              'rgba(255,255,255,0.22)',
            ],
            'circle-stroke-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 2.2,
              ['boolean', ['feature-state', 'hover'], false], 1.8,
              0.7,
            ],
          },
        });

        // Cluster bloom — a blurred halo behind each cluster disc. It turns
        // the flat fill into a radial gradient while keeping the crisp
        // circle itself small and anchored to the cluster's own area.
        m.addLayer({
          id: LAYER_IDS.clustersGlow,
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          layout: { visibility: layers.events ? 'visible' : 'none' },
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#00D9FF',
              10, '#FACC15',
              40, '#F97316',
              120, '#EF4444',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 21, 40, 28, 120, 36],
            'circle-opacity': 0.3,
            'circle-blur': 0.75,
          },
        });

        // Clusters — step() takes input then output/stop PAIRS and nothing
        // else. Discs shrunk ~20% and fills brightened so the count-graded
        // severity reads at a glance.
        m.addLayer({
          id: LAYER_IDS.clusters,
          type: 'circle',
          source: 'events',
          filter: ['has', 'point_count'],
          layout: { visibility: layers.events ? 'visible' : 'none' },
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              'rgba(0,217,255,0.30)',
              10, 'rgba(250,204,21,0.36)',
              40, 'rgba(249,115,22,0.42)',
              120, 'rgba(239,68,68,0.48)',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 12, 10, 17, 40, 23, 120, 30],
            'circle-stroke-color': [
              'step',
              ['get', 'point_count'],
              'rgba(0,217,255,0.75)',
              10, 'rgba(250,204,21,0.8)',
              40, 'rgba(249,115,22,0.85)',
              120, 'rgba(239,68,68,0.9)',
            ],
            'circle-stroke-width': 1.1,
          },
        });

        m.addLayer({
          id: LAYER_IDS.clusterCount,
          type: 'symbol',
          source: 'events',
          filter: ['has', 'point_count'],
          layout: {
            visibility: layers.events ? 'visible' : 'none',
            'text-field': '{point_count_abbreviated}',
            'text-font': GLYPH_FONT,
            'text-size': 11,
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#DCE6F2' },
        });
      }

      // ── Selection indicator (separate source; never clustered away) ────
      if (!m.getSource('selection')) {
        m.addSource('selection', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        m.addLayer({
          id: LAYER_IDS.selectionHalo,
          type: 'circle',
          source: 'selection',
          paint: {
            'circle-radius': 30,
            'circle-color': 'rgba(0,217,255,0.05)',
            'circle-stroke-color': 'rgba(0,217,255,0.18)',
            'circle-stroke-width': 1,
          },
        });
        m.addLayer({
          id: LAYER_IDS.selectionRing,
          type: 'circle',
          source: 'selection',
          paint: {
            'circle-radius': 17,
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': '#00D9FF',
            'circle-stroke-width': 1.4,
          },
        });
      }
    }

    // ── Interaction ──────────────────────────────────────────────────────

    map.on('click', LAYER_IDS.eventsCore, (e) => {
      if (!interactiveRef.current) return;
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) cb.current.onEventClick(id);
    });

    map.on('click', LAYER_IDS.clusters, (e) => {
      if (!interactiveRef.current) return;
      const clusterId = e.features?.[0]?.properties?.cluster_id as number | undefined;
      const source = map.getSource('events') as maplibregl.GeoJSONSource | undefined;
      if (clusterId === undefined || !source?.getClusterExpansionZoom) return;
      source.getClusterExpansionZoom(clusterId).then((zoom) => {
        const center = (e.features?.[0]?.geometry as GeoJSON.Point)?.coordinates as [number, number];
        if (!center) return;
        map.easeTo({ center, zoom: Math.min(zoom + 0.4, 14), duration: 700 });
      }).catch(() => { /* cluster may have been re-tiled mid-request */ });
    });

    map.on('click', (e) => {
      if (!interactiveRef.current) return;
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.eventsCore, LAYER_IDS.clusters],
      });
      if (!hits.length) cb.current.onMapClick();
    });

    let hovered: string | null = null;
    const setHover = (id: string | null) => {
      if (hovered === id) return;
      if (hovered) map.setFeatureState({ source: 'events', id: hovered }, { hover: false });
      hovered = id;
      if (hovered) map.setFeatureState({ source: 'events', id: hovered }, { hover: true });
      cb.current.onHover(id);
      map.getCanvas().setAttribute('data-cursor', id ? 'event' : 'map');
    };
    setHoverRef.current = setHover;

    map.on('mouseenter', LAYER_IDS.eventsCore, (e) => {
      if (!interactiveRef.current) return;
      setHover((e.features?.[0]?.properties?.id as string) ?? null);
    });
    map.on('mousemove', LAYER_IDS.eventsCore, (e) => {
      if (!interactiveRef.current) return;
      setHover((e.features?.[0]?.properties?.id as string) ?? null);
    });
    map.on('mouseleave', LAYER_IDS.eventsCore, () => setHover(null));

    map.on('mousemove', (e) => cb.current.onCoordinates(e.lngLat.lng, e.lngLat.lat));

    // Cooperative wheel: the bare wheel ALWAYS scrolls the page. Requiring a
    // modifier means the map can never become a one-way trap.
    const onWheel = (e: WheelEvent) => {
      if (!interactiveRef.current) return;
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const around = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      map.easeTo({ zoom: map.getZoom() - px * 0.0045, around, duration: 0 });
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      disposed = true;
      window.clearTimeout(styleTimeout);
      container.removeEventListener('wheel', onWheel);
      setHoverRef.current = null;
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // Constructed exactly once. All live values reach it through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── External hover — mirrors a navigator row hover onto the map ─────────
  useEffect(() => {
    setHoverRef.current?.(hoveredEventId ?? null);
  }, [hoveredEventId]);

  // ── Interaction enable/disable — the wheel-ownership switch ─────────────
  useEffect(() => {
    interactiveRef.current = interactive;
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      try {
        if (interactive) {
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.boxZoom.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
          map.getCanvas().setAttribute('data-cursor', 'map');
        } else {
          map.dragPan.disable();
          map.doubleClickZoom.disable();
          map.boxZoom.disable();
          map.keyboard.disable();
          map.touchZoomRotate.disable();
          map.getCanvas().setAttribute('data-cursor', 'default');
        }
        // scrollZoom is never enabled. Not here, not anywhere.
        map.scrollZoom.disable();
      } catch {
        /* handlers are absent until the style has loaded */
      }
    };
    apply();
    if (map.isStyleLoaded()) return;
    map.once('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [interactive]);

  // ── Framing: fit the India AOI once the style is ready ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || framedRef.current) return;
    const frame = () => {
      if (framedRef.current || !map.isStyleLoaded()) return;
      framedRef.current = true;
      frameIndia(map);
    };
    if (map.isStyleLoaded()) frame();
    else map.once('style.load', frame);
    return () => {
      map.off('style.load', frame);
    };
  }, []);

  // Re-frame on viewport changes so the AOI stays correctly placed at every
  // breakpoint instead of drifting off the panels.
  useEffect(() => {
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        frameIndia(map);
      }, 220);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // ── Data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    featuresRef.current = features;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource('events') as maplibregl.GeoJSONSource | undefined;
    src?.setData(features);
  }, [features]);

  // ── Density (regional heatmap) ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource('density') as maplibregl.GeoJSONSource | undefined;
    src?.setData(densityFeatures);
  }, [densityFeatures]);

  // ── Selection: one camera move, ever, per selection ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;

      const previous = selectedRef.current;
      if (previous && previous !== selectedEventId) {
        map.setFeatureState({ source: 'events', id: previous }, { selected: false });
      }
      selectedRef.current = selectedEventId;

      const src = map.getSource('selection') as maplibregl.GeoJSONSource | undefined;
      if (!selectedEventId) {
        src?.setData({ type: 'FeatureCollection', features: [] });
        lastFlownRef.current = null;
        return;
      }

      const feature = featuresRef.current.features.find(
        (f) => f.properties?.id === selectedEventId
      );
      if (!feature) {
        src?.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      map.setFeatureState({ source: 'events', id: selectedEventId }, { selected: true });
      src?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: feature.geometry, properties: {} }],
      });

      // THE single flyTo. Guarded so a click, a list selection and a watchlist
      // jump cannot each issue their own competing camera animation.
      if (lastFlownRef.current !== selectedEventId) {
        lastFlownRef.current = selectedEventId;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const targetZoom = Math.max(map.getZoom(), 9.5);
        map.flyTo({
          center: [lng, lat],
          zoom: targetZoom,
          duration: 1400,
          curve: 1.42,
          essential: true,
          padding: flyToPaddingForViewport(window.innerWidth),
        });
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [selectedEventId]);

  // ── Layer visibility ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      setVisibility(map, LAYER_IDS.eventsGlow, layers.events);
      setVisibility(map, LAYER_IDS.eventsCore, layers.events);
      setVisibility(map, LAYER_IDS.clustersGlow, layers.events);
      setVisibility(map, LAYER_IDS.clusters, layers.events);
      setVisibility(map, LAYER_IDS.clusterCount, layers.events);
      setVisibility(map, LAYER_IDS.heatmap, layers.heatmap);
      setVisibility(map, LAYER_IDS.industrial, layers.industrial);
      setVisibility(map, LAYER_IDS.industrialLabel, layers.industrial);
      setVisibility(map, LAYER_IDS.adminLine, layers.admin);
      setVisibility(map, LAYER_IDS.satellite, layers.satellite);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [layers]);

  return (
    <div
      ref={containerRef}
      data-cursor="map"
      className="absolute inset-0"
      // Inline positioning is required: MapLibre adds the `maplibregl-map`
      // class to THIS element and its stylesheet sets `position: relative`,
      // which would override Tailwind's `absolute` (equal specificity, later in
      // the cascade) and collapse the container to height 0 — leaving the map
      // canvas blank even after the operational stage becomes visible. Inline
      // styles win over class-based rules, so the map always fills its stage.
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: clamp01(opacity),
        willChange: 'opacity',
      }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function setVisibility(map: maplibregl.Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

/**
 * Frame the area of interest: India plus the surrounding context the brief
 * requires, inset by the panels that float over the map.
 */
export function frameIndia(map: maplibregl.Map, duration = 0) {
  const padding = mapPaddingForViewport(window.innerWidth);
  map.fitBounds(
    [
      [INDIA_AOI_BOUNDS[0], INDIA_AOI_BOUNDS[1]],
      [INDIA_AOI_BOUNDS[2], INDIA_AOI_BOUNDS[3]],
    ],
    { padding, duration, essential: true }
  );
}
