'use client';

/**
 * Application state.
 *
 * Holds only *discrete* state — things that change on a user action or cross a
 * threshold. Continuous values (scroll progress, camera position) deliberately
 * do NOT live here: they are read imperatively from the experience controller
 * inside rAF loops, so scrolling never triggers a React render.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThermalClass, PriorityBand } from '@/types/event';

export type AppView = 'command' | 'events' | 'analytics' | 'watchtower' | 'about';
export type ExperienceMode = 'cinematic' | 'observation' | 'operational';
export type InvestigationTab = 'overview' | 'evidence' | 'history' | 'context';

export interface LayerState {
  events: boolean;
  heatmap: boolean;
  industrial: boolean;
  admin: boolean;
  satellite: boolean;
}

export interface ExplorerFilterState {
  classes: ThermalClass[];
  states: string[];
  bands: PriorityBand[];
  minConfidence: number;
  minPersistence: number;
  query: string;
  sort: 'recent' | 'priority' | 'intensity' | 'persistence';
}

export const DEFAULT_FILTERS: ExplorerFilterState = {
  classes: [],
  states: [],
  bands: [],
  minConfidence: 0,
  minPersistence: 0,
  query: '',
  sort: 'priority',
};

export interface AppState {
  // ── Navigation ────────────────────────────────────────────────────────
  view: AppView;
  setView: (view: AppView) => void;

  // ── Experience (published by the scroll controller, not by scroll events) ─
  mode: ExperienceMode;
  cinematicStateId: string;
  /** 0..1 reveal of the operational UI. Quantised to 1/100 before it lands here. */
  operationalReveal: number;
  setExperience: (mode: ExperienceMode, cinematicStateId: string, operationalReveal: number) => void;

  // ── Investigation ─────────────────────────────────────────────────────
  selectedEventId: string | null;
  hoveredEventId: string | null;
  investigationTab: InvestigationTab;
  selectEvent: (id: string | null) => void;
  hoverEvent: (id: string | null) => void;
  setInvestigationTab: (tab: InvestigationTab) => void;

  // ── Filters ───────────────────────────────────────────────────────────
  filters: ExplorerFilterState;
  setFilters: (patch: Partial<ExplorerFilterState>) => void;
  resetFilters: () => void;

  // ── Layers ────────────────────────────────────────────────────────────
  layers: LayerState;
  toggleLayer: (layer: keyof LayerState) => void;

  // ── Watchlist (persisted) ─────────────────────────────────────────────
  watchlist: string[];
  toggleWatch: (id: string) => void;
  isWatched: (id: string) => boolean;

  // ── Timeline replay ───────────────────────────────────────────────────
  /** Index into the observation window's ordered list of days; -1 = all data. */
  timelineCursor: number;
  timelinePlaying: boolean;
  setTimelineCursor: (i: number) => void;
  setTimelinePlaying: (playing: boolean) => void;

  // ── UI ────────────────────────────────────────────────────────────────
  navigatorOpen: boolean;
  toggleNavigator: () => void;
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;
  /** Set when the map cannot reach its basemap — drives the degraded banner. */
  mapDegraded: boolean;
  setMapDegraded: (degraded: boolean) => void;
  cursorVariant: 'default' | 'map' | 'event' | 'button';
  setCursorVariant: (v: 'default' | 'map' | 'event' | 'button') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'command',
      setView: (view) => set({ view }),

      mode: 'cinematic',
      cinematicStateId: 'space',
      operationalReveal: 0,
      setExperience: (mode, cinematicStateId, operationalReveal) => {
        const s = get();
        if (
          s.mode === mode &&
          s.cinematicStateId === cinematicStateId &&
          s.operationalReveal === operationalReveal
        ) {
          return;
        }
        set({ mode, cinematicStateId, operationalReveal });
      },

      selectedEventId: null,
      hoveredEventId: null,
      investigationTab: 'overview',
      selectEvent: (id) =>
        set({ selectedEventId: id, investigationTab: id ? 'overview' : 'overview' }),
      hoverEvent: (id) => {
        if (get().hoveredEventId !== id) set({ hoveredEventId: id });
      },
      setInvestigationTab: (tab) => set({ investigationTab: tab }),

      filters: DEFAULT_FILTERS,
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      layers: { events: true, heatmap: false, industrial: true, admin: false, satellite: false },
      toggleLayer: (layer) =>
        set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

      watchlist: [],
      toggleWatch: (id) =>
        set((s) => ({
          watchlist: s.watchlist.includes(id)
            ? s.watchlist.filter((x) => x !== id)
            : [...s.watchlist, id],
        })),
      isWatched: (id) => get().watchlist.includes(id),

      timelineCursor: -1,
      timelinePlaying: false,
      setTimelineCursor: (i) => set({ timelineCursor: i }),
      setTimelinePlaying: (playing) => set({ timelinePlaying: playing }),

      navigatorOpen: true,
      toggleNavigator: () => set((s) => ({ navigatorOpen: !s.navigatorOpen })),
      reportOpen: false,
      setReportOpen: (open) => set({ reportOpen: open }),
      mapDegraded: false,
      setMapDegraded: (degraded) => {
        if (get().mapDegraded !== degraded) set({ mapDegraded: degraded });
      },
      cursorVariant: 'default',
      setCursorVariant: (v) => {
        if (get().cursorVariant !== v) set({ cursorVariant: v });
      },
    }),
    {
      name: 'sih26162-app',
      storage: createJSONStorage(() => localStorage),
      // Only the analyst's own bookmarks survive a reload. Transient view
      // state must not, or a refresh would strand the user in a scrolled map.
      partialize: (state) => ({ watchlist: state.watchlist }),
      version: 1,
    }
  )
);
