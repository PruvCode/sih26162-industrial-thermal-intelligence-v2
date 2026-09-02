'use client';

/**
 * MAP LAYER CONTROL.
 *
 * Depth on the map comes from three planes: the basemap, the analytics layers
 * (density, boundaries, industrial context) and the detection layer. Letting
 * the analyst isolate any one of them is what turns a picture into an
 * instrument — every toggle here has a visible consequence within a frame.
 *
 * The panel is embedded in the event navigator sidebar — toggled from an icon
 * in the navigator's controls row — so it lives with the analyst's other
 * instruments instead of floating over the map or leaking onto other views.
 */

import { Layers, Flame, Grid3x3, Building2, Map as MapIcon, Satellite } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type LayerState } from '@/store/useAppStore';
import { Dot, SectionLabel } from '@/components/ui/primitives';

interface ToggleSpec {
  id: keyof LayerState;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const LAYER_TOGGLES: ToggleSpec[] = [
  { id: 'events', label: 'Thermal detections', hint: 'Individual satellite observations', icon: Flame },
  { id: 'heatmap', label: 'Density surface', hint: 'Gridded detection concentration', icon: Grid3x3 },
  { id: 'industrial', label: 'Industrial sites', hint: 'Registered facilities', icon: Building2 },
  { id: 'admin', label: 'Boundaries', hint: 'National outlines', icon: MapIcon },
  { id: 'satellite', label: 'Satellite imagery', hint: 'Optical basemap', icon: Satellite },
];

/** Number of analytics layers currently switched on. Used by the navigator's
 *  layers toggle for its active state and badge. */
export function useActiveLayerCount(): number {
  const layers = useAppStore((s) => s.layers);
  return LAYER_TOGGLES.reduce((n, t) => n + (layers[t.id] ? 1 : 0), 0);
}

/** Collapsible layers section, rendered inside the EventNavigator sidebar.
 *  Shares the filters section's visual grammar — a bordered strip between the
 *  header and the scrollable event list — so the two sections read as one
 *  instrument stack. */
export function LayerControlPanel() {
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const degraded = useAppStore((s) => s.mapDegraded);

  const activeCount = LAYER_TOGGLES.filter((t) => layers[t.id]).length;

  return (
    <div
      data-testid="layer-control-panel"
      className="shrink-0 border-b border-white/[0.06] bg-black/20 px-3.5 py-3"
      style={{ animation: 'fadeIn 200ms ease-out both' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3 w-3 text-[#8798AC]" />
          <SectionLabel>Map layers</SectionLabel>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-[#DCE4EE]">
          {activeCount}/{LAYER_TOGGLES.length}
        </span>
      </div>

      <ul className="space-y-0.5">
        {LAYER_TOGGLES.map((t) => {
          const on = layers[t.id];
          const Icon = t.icon;
          return (
            <li key={t.id}>
              <button
                type="button"
                data-cursor="button"
                role="switch"
                aria-checked={on}
                aria-label={t.label}
                onClick={() => toggleLayer(t.id)}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-200',
                  on ? 'bg-white/[0.04]' : 'hover:bg-white/[0.035]'
                )}
              >
                <Icon className={cn('h-3 w-3 shrink-0 transition-colors duration-200', on ? 'text-[#8FE6FF]' : 'text-[#5A6B7F]')} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[11.5px] transition-colors duration-200',
                      on ? 'text-[#E8EDF3]' : 'text-[#8798AC]'
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="block truncate font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#5A6B7F]">
                    {t.hint}
                  </span>
                </span>
                <span
                  className={cn(
                    'relative h-[14px] w-[26px] shrink-0 rounded-full border transition-colors duration-200',
                    on ? 'border-[rgba(0,217,255,0.45)] bg-[rgba(0,217,255,0.18)]' : 'border-white/[0.1] bg-white/[0.03]'
                  )}
                >
                  <span
                    className="absolute top-[2px] h-[8px] w-[8px] rounded-full transition-all duration-200"
                    style={{
                      left: on ? 14 : 3,
                      background: on ? '#7FE0FF' : '#5A6B7F',
                    }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {degraded && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-white/[0.07] pt-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#FDBA74]">
          <Dot color="#F97316" pulse />
          Basemap degraded — vector layers unaffected
        </p>
      )}
    </div>
  );
}
