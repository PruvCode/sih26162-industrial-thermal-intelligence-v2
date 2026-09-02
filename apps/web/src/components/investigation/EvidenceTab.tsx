'use client';

/**
 * EVIDENCE STACK — explain.
 *
 * Renders the factors that actually drove the classification, with their
 * weights and the data source each one came from. Positive and negative
 * contributions are shown together: an analyst needs to see what argued
 * against the label, not just what argued for it.
 */

import { ThumbsUp, ThumbsDown, Cpu } from 'lucide-react';
import type { EventDetail } from '@/types/intelligence';
import { CLASS_LABELS } from '@/lib/constants';
import { eventClass, eventConfidence } from '@/data/derive';
import { EmptyState, SectionLabel } from '@/components/ui/primitives';
import type { Evidence } from '@/types/event';

export function EvidenceTab({ detail }: { detail: EventDetail }) {
  const evidence: Evidence | null = detail.evidence;
  const cls = eventClass(detail.event);

  if (!evidence || (evidence.positiveFactors.length === 0 && evidence.negativeFactors.length === 0)) {
    return (
      <EmptyState
        title="No evidence recorded"
        detail="This detection predates the current model version, or its feature record was incomplete."
      />
    );
  }

  const maxWeight = Math.max(
    0.01,
    ...evidence.positiveFactors.map((f) => f.weight),
    ...evidence.negativeFactors.map((f) => Math.abs(f.weight))
  );

  return (
    <div className="space-y-5">
      {/* Verdict */}
      <section className="rounded-md border border-white/[0.07] bg-black/20 p-3">
        <SectionLabel>Model verdict</SectionLabel>
        <p className="mt-2 font-display text-[19px] leading-tight text-[#E8EDF3]">{CLASS_LABELS[cls]}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#00D9FF] transition-[width] duration-700"
              style={{ width: `${eventConfidence(detail.event) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-[#DCE4EE]">
            {Math.round(eventConfidence(detail.event) * 100)}%
          </span>
        </div>

        {/* Class probability distribution */}
        {detail.event.classification?.allProbabilities && (
          <div className="mt-3.5 space-y-1.5 border-t border-white/[0.05] pt-3">
            {Object.entries(detail.event.classification.allProbabilities)
              .sort((a, b) => b[1] - a[1])
              .map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-[118px] shrink-0 truncate text-[10px] text-[#8798AC]">
                    {CLASS_LABELS[key as keyof typeof CLASS_LABELS]}
                  </span>
                  <div className="h-[2px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-[#4A6B85] transition-[width] duration-700"
                      style={{ width: `${value * 100}%` }}
                    />
                  </div>
                  <span className="w-[34px] shrink-0 text-right font-mono text-[9px] tabular-nums text-[#A9B6C6]">
                    {Math.round(value * 100)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Supporting */}
      <FactorList
        title="Supporting factors"
        icon={<ThumbsUp className="h-3 w-3 text-[#22C55E]" />}
        factors={evidence.positiveFactors}
        max={maxWeight}
        positive
      />

      {/* Contradicting */}
      <FactorList
        title="Contradicting factors"
        icon={<ThumbsDown className="h-3 w-3 text-[#EF4444]" />}
        factors={evidence.negativeFactors}
        max={maxWeight}
        positive={false}
      />

      {/* Feature attribution */}
      {evidence.shapSummary?.topFeatures?.length ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Cpu className="h-3 w-3 text-[#8798AC]" />
            <SectionLabel>Feature attribution</SectionLabel>
          </div>
          <div className="space-y-1.5 rounded-md border border-white/[0.06] bg-black/20 p-3">
            {evidence.shapSummary.topFeatures.map((f) => {
              const positive = f.shapValue >= 0;
              const w = Math.min(1, Math.abs(f.shapValue) * 2.2);
              return (
                <div key={f.feature} className="flex items-center gap-2">
                  <span className="w-[150px] shrink-0 truncate font-mono text-[9px] text-[#8798AC]">
                    {f.feature}
                  </span>
                  <div className="relative h-[3px] min-w-0 flex-1 rounded-full bg-white/[0.05]">
                    <span className="absolute left-1/2 top-[-2px] h-[7px] w-px bg-white/[0.12]" />
                    <div
                      className="absolute top-0 h-full rounded-full transition-[width] duration-700"
                      style={{
                        left: positive ? '50%' : `${50 - w * 50}%`,
                        width: `${w * 50}%`,
                        background: positive ? '#22C55E' : '#EF4444',
                      }}
                    />
                  </div>
                  <span
                    className="w-[42px] shrink-0 text-right font-mono text-[9px] tabular-nums"
                    style={{ color: positive ? '#6BD98A' : '#FCA5A5' }}
                  >
                    {positive ? '+' : ''}
                    {f.shapValue.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FactorList({
  title,
  icon,
  factors,
  max,
  positive,
}: {
  title: string;
  icon: React.ReactNode;
  factors: Evidence['positiveFactors'];
  max: number;
  positive: boolean;
}) {
  if (factors.length === 0) return null;
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        {icon}
        <SectionLabel>{title}</SectionLabel>
        <span className="ml-auto font-mono text-[9px] tabular-nums text-[#6B7C90]">{factors.length}</span>
      </div>
      <ul className="space-y-3">
        {factors.map((f, i) => {
          const w = Math.abs(f.weight) / max;
          return (
            <li
              key={f.factor}
              className="animate-fade-in"
              style={{ animationDelay: `${i * 55}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] text-[#DCE4EE]">{f.factor}</span>
                <span
                  className="shrink-0 font-mono text-[10px] tabular-nums"
                  style={{ color: positive ? '#6BD98A' : '#FCA5A5' }}
                >
                  {positive ? '+' : ''}
                  {f.weight.toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.max(3, w * 100)}%`,
                    background: positive ? '#22C55E' : '#EF4444',
                    transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <span className="text-[10.5px] leading-relaxed text-[#8798AC]">{f.detail}</span>
                <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-[#5A6B7F]">
                  {f.source}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
