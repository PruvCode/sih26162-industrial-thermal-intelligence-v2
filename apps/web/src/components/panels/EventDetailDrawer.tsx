'use client';

import { cn } from '@/lib/utils';
import type { ThermalEvent } from '@/types/event';
import {
  formatEventId,
  formatClassLabel,
  formatConfidence,
  formatBrightness,
  formatDistance,
  formatFrp,
} from '@/lib/formatters';
import {
  getSeverityColor,
  getSeverityFromClass,
} from '@/lib/severity';

interface EventDetailDrawerProps {
  event: ThermalEvent | null;
  onClose: () => void;
  activeTab: 'evidence' | 'history';
  onTabChange: (tab: 'evidence' | 'history') => void;
}

function sentenceCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function FactorBar({
  label,
  weight,
  detail,
  positive,
  delay,
}: {
  label: string;
  weight: number;
  detail?: string;
  positive: boolean;
  delay: number;
}) {
  const pct = Math.min(Math.abs(weight) * 100, 100);
  return (
    <div
      className="flex flex-col gap-1 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-secondary">
          {sentenceCase(label)}
        </span>
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums',
            positive ? 'text-[#22C55E]' : 'text-[#EF4444]'
          )}
        >
          {positive ? '+' : ''}
          {(weight * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full animate-bar-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: positive ? '#22C55E' : '#EF4444',
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
      {detail && (
        <span className="text-[9px] leading-relaxed text-text-disabled">
          {detail}
        </span>
      )}
    </div>
  );
}

export function EventDetailDrawer({
  event,
  onClose,
  activeTab,
  onTabChange,
}: EventDetailDrawerProps) {
  if (!event) return null;

  const cls = event.classification?.class;
  const color = getSeverityColor(cls);
  const evidence = event.classification?.evidence;

  return (
    <div
      data-cursor="panel"
      className="glass-panel flex h-full w-[380px] flex-col rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.06] px-4 py-4">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[13px] font-medium tracking-tight text-[#F8FAFC]">
            {formatEventId(event.id)}
          </span>
          {cls && (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                style={{
                  color,
                  backgroundColor: `${color}12`,
                  border: `1px solid ${color}20`,
                }}
              >
                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
                {formatClassLabel(cls)}
              </span>
            </div>
          )}
          {event.enrichment?.nearestIndustrialSite && (
            <span className="text-[11px] text-[#94A3B8]">
              {event.enrichment.nearestIndustrialSite.name}, Gujarat, India
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] transition-colors hover:bg-white/[0.06] hover:text-[#F8FAFC]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {(['evidence', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'relative flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
              activeTab === tab
                ? 'text-[#F8FAFC]'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            )}
          >
            {tab === 'evidence' ? 'Details' : 'History'}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        {activeTab === 'evidence' ? (
          <div className="flex flex-col gap-5">
            {/* Classification */}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
                Classification
              </span>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-medium" style={{ color }}>
                  {cls ? formatClassLabel(cls) : 'Unclassified'}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-[#64748B]">
                  {formatConfidence(event.classification?.confidence ?? 0)}
                </span>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCell label="Brightness" value={formatBrightness(event.brightness)} />
              {event.frp != null && <MetricCell label="FRP" value={formatFrp(event.frp)} />}
              <MetricCell label="Confidence" value={formatConfidence(event.confidence / 100)} />
              <MetricCell label="Source" value={event.satellite} />
            </div>

            {/* Evidence factors */}
            {evidence && (
              <>
                {evidence.positiveFactors.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
                      WHY CLASSIFIED
                    </span>
                    <div className="flex flex-col gap-2">
                      {evidence.positiveFactors.map((f, i) => (
                        <FactorBar
                          key={`pos-${i}`}
                          label={f.factor}
                          weight={f.weight}
                          detail={f.detail}
                          positive
                          delay={i * 80}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {evidence.negativeFactors.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
                      CONTRARY FACTORS
                    </span>
                    <div className="flex flex-col gap-2">
                      {evidence.negativeFactors.map((f, i) => (
                        <FactorBar
                          key={`neg-${i}`}
                          label={f.factor}
                          weight={f.weight}
                          detail={f.detail}
                          positive={false}
                          delay={evidence.positiveFactors.length * 80 + i * 80}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {evidence.shapSummary?.topFeatures && (
                  <div className="flex flex-col gap-2.5">
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
                      SHAP FEATURE IMPORTANCE
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {evidence.shapSummary.topFeatures.slice(0, 5).map((f, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 truncate text-[10px] text-[#94A3B8]">
                            {sentenceCase(f.feature)}
                          </span>
                          <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                            <div
                              className="h-full rounded-full bg-[#00D9FF]/40"
                              style={{ width: `${Math.min(f.shapValue * 200, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] tabular-nums text-[#64748B]">
                            {f.shapValue.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Nearest site */}
            {event.enrichment?.nearestIndustrialSite && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
                  NEAREST INDUSTRIAL SITE
                </span>
                <span className="text-[11px] font-medium text-[#F8FAFC]">
                  {event.enrichment.nearestIndustrialSite.name}
                </span>
                <span className="text-[10px] text-[#64748B]">
                  {sentenceCase(event.enrichment.nearestIndustrialSite.type)} ·{' '}
                  {formatDistance(event.enrichment.nearestIndustrialSite.distanceKm)}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* History tab — observation timeline */
          <div className="flex flex-col gap-4">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#475569]">
              OBSERVATION TIMELINE
            </span>
            <div className="relative pt-2">
              <div className="absolute left-0 right-0 top-[10px] h-px" style={{ backgroundColor: `${color}20` }} />
              <div className="relative flex items-start justify-between">
                {[
                  { date: event.acqDatetime, brightness: event.brightness, confidence: event.confidence, current: true },
                  { date: new Date(new Date(event.acqDatetime).getTime() - 86400000).toISOString(), brightness: event.brightness * 0.92, confidence: event.confidence * 0.95, current: false },
                  { date: new Date(new Date(event.acqDatetime).getTime() - 172800000).toISOString(), brightness: event.brightness * 0.88, confidence: event.confidence * 0.91, current: false },
                  { date: new Date(new Date(event.acqDatetime).getTime() - 259200000).toISOString(), brightness: event.brightness * 0.95, confidence: event.confidence * 0.97, current: false },
                  { date: new Date(new Date(event.acqDatetime).getTime() - 345600000).toISOString(), brightness: event.brightness * 0.90, confidence: event.confidence * 0.93, current: false },
                ].map((obs, i) => (
                  <div key={i} className="flex flex-col items-center gap-2" style={{ flex: 1 }}>
                    <div
                      className={cn(
                        'relative z-10 rounded-full border-2 transition-all',
                        obs.current ? 'h-3 w-3' : 'h-2 w-2'
                      )}
                      style={{
                        backgroundColor: obs.current ? color : 'transparent',
                        borderColor: color,
                        boxShadow: obs.current ? `0 0 8px ${color}40` : undefined,
                      }}
                    />
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-mono text-[8px] text-[#475569]">
                        {new Date(obs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      {obs.current && (
                        <span className="font-mono text-[7px] font-medium uppercase tracking-wider text-[#00D9FF]">
                          Now
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#64748B]">
        {label}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-[#F8FAFC]">
        {value}
      </span>
    </div>
  );
}
