'use client';

/**
 * INTELLIGENCE REPORT.
 *
 * The output an analyst hands to someone else. It is deliberately plain:
 * a structured record of what was measured, what the model concluded, how
 * confident that conclusion is, and — critically — what would change the
 * conclusion. Reports that hide their uncertainty are worse than no report.
 *
 * Export is copy-to-clipboard. No PDF pipeline: at MVP scale a fragile
 * print-to-PDF path breaks more often than the value it adds, and the text
 * record is what actually gets pasted into a briefing.
 */

import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { useIntelligenceReport } from '@/features/events/hooks';
import { PRIORITY_COLORS, PRIORITY_LABELS, describeConfidence } from '@/lib/constants';
import { formatEventId, formatDateTime } from '@/lib/formatters';
import { formatLatLng } from '@/lib/geo';
import { Button, ErrorState, IconButton, Skeleton } from '@/components/ui/primitives';
import { DURATION } from '@/lib/motion';

export function ReportModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useIntelligenceReport(eventId);
  const report = data?.data ?? null;
  const [copied, setCopied] = useState(false);

  // Escape closes; scroll behind is locked while the modal owns the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const plainText = useMemo(() => (report ? serialise(report) : ''), [report]);

  const copy = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API is unavailable over plain http on some hosts — fall back
      // to a selection-based copy rather than silently doing nothing.
      const ta = document.createElement('textarea');
      ta.value = plainText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Intelligence report"
    >
      {/* Scrim — click anywhere outside to dismiss. */}
      <button
        type="button"
        aria-label="Close report"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#030509]/80 backdrop-blur-[3px]"
        style={{ animation: `fadeIn ${DURATION.ui}ms ease-out both` }}
      />

      <div
        className="relative flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-glass border border-white/[0.09] glass-elevated"
        style={{ animation: `reportIn ${DURATION.ui}ms cubic-bezier(0.16,1,0.3,1) both` }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
          <FileText className="h-3.5 w-3.5 text-[#8FE6FF]" />
          <div className="min-w-0">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#E8EDF3]">
              Intelligence Report
            </h2>
            <p className="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-[#6B7C90]">
              {formatEventId(eventId)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" onClick={copy} disabled={!report}>
              {copied ? (
                <Check className="h-3 w-3 text-[#6BD98A]" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <IconButton label="Close report" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isError || !report ? (
            <ErrorState
              title="Report unavailable"
              detail="The structured summary could not be assembled for this event."
              onRetry={() => refetch()}
            />
          ) : (
            <article className="space-y-5">
              {/* Verdict */}
              <section>
                <Label>Assessment</Label>
                <p className="mt-2 font-display text-[22px] leading-tight text-[#F2F6FA]">
                  {report.classificationLabel}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Chip color={describeConfidence(report.confidence).color}>
                    {Math.round(report.confidence * 100)}% {describeConfidence(report.confidence).label}
                  </Chip>
                  <Chip color={PRIORITY_COLORS[report.priorityBand]}>
                    {PRIORITY_LABELS[report.priorityBand]} priority
                  </Chip>
                  <Chip color="#8798AC">
                    {report.persistence.activeDays}/{report.persistence.windowDays} active days
                  </Chip>
                </div>
              </section>

              {/* Location */}
              <section>
                <Label>Location</Label>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Field label="Coordinates" value={formatLatLng(report.location.lat, report.location.lng)} />
                  <Field label="District" value={report.location.district ?? '—'} />
                  <Field label="State" value={report.location.state ?? '—'} />
                  <Field label="Path" value={report.location.breadcrumb.slice(1).join(' · ')} />
                </dl>
              </section>

              {/* Measurement */}
              <section>
                <Label>Measurement</Label>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <Field label="Brightness" value={`${report.thermal.brightness.toFixed(1)} K`} />
                  <Field
                    label="Radiative power"
                    value={report.thermal.frp !== undefined ? `${report.thermal.frp.toFixed(2)} MW` : '—'}
                  />
                  <Field label="Satellite" value={`${report.thermal.satellite} · ${report.thermal.instrument}`} />
                  <Field label="Overpass" value={report.thermal.daynight} />
                  <Field label="Detections" value={String(report.persistence.detectionCount)} />
                  <Field
                    label="Nearest facility"
                    value={
                      report.nearestFacility
                        ? `${report.nearestFacility.distanceKm.toFixed(2)} km — ${report.nearestFacility.name}`
                        : 'None within threshold'
                    }
                  />
                </dl>
              </section>

              {/* Evidence */}
              {report.keyEvidence.length > 0 && (
                <section>
                  <Label>Supporting evidence</Label>
                  <ul className="mt-2 space-y-2">
                    {report.keyEvidence.map((e) => (
                      <li key={e.factor} className="border-l border-white/[0.1] pl-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[12px] text-[#DCE4EE]">{e.factor}</span>
                          <span className="font-mono text-[9px] tabular-nums text-[#8798AC]">
                            w {e.weight.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#8798AC]">{e.detail}</p>
                        <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#5A6B7F]">
                          {e.source}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Caveats — the part most reports omit and shouldn't */}
              {report.caveats.length > 0 && (
                <section className="rounded-md border border-[rgba(249,115,22,0.26)] bg-[rgba(249,115,22,0.055)] p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-[#F97316]" />
                    <Label tone="#FDBA74">Interpretation limits</Label>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {report.caveats.map((c) => (
                      <li key={c} className="flex gap-2 text-[11px] leading-relaxed text-[#C3A98C]">
                        <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#F97316]" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Provenance */}
              <section className="border-t border-white/[0.06] pt-3.5">
                <Label>Provenance</Label>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  <Field label="Data type" value={report.provenance.dataType} />
                  <Field label="Primary source" value={report.provenance.primarySource} />
                  <Field label="Instruments" value={report.provenance.satellites} />
                  <Field label="Model" value={report.provenance.modelVersion} />
                  <Field label="Industrial context" value={report.provenance.industrialContext} />
                  <Field label="Generated" value={formatDateTime(report.generatedAt)} />
                </dl>
              </section>
            </article>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="flex shrink-0 items-center gap-3 border-t border-white/[0.07] px-5 py-3">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#5A6B7F]">
            Derived from thermal anomalies · not a legal determination
          </span>
          {isLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-[#8798AC]" />}
        </footer>
      </div>
    </div>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Label({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-[0.18em]"
      style={{ color: tone ?? '#8798AC' }}
    >
      {children}
    </span>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.12em]"
      style={{ background: `${color}1F`, color, borderColor: `${color}33` }}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</dt>
      <dd className="mt-0.5 font-mono text-[11px] tabular-nums leading-snug text-[#DCE4EE]">{value}</dd>
    </div>
  );
}

// ── Plain-text serialisation ────────────────────────────────────────────────

type Report = NonNullable<ReturnType<typeof useIntelligenceReport>['data']>['data'];

function serialise(r: NonNullable<Report>): string {
  const lines: string[] = [];
  lines.push('SIH26162 — INDUSTRIAL THERMAL INTELLIGENCE');
  lines.push('INTELLIGENCE REPORT');
  lines.push('='.repeat(52));
  lines.push('');
  lines.push(`Event            ${formatEventId(r.eventId)}`);
  lines.push(`Generated        ${new Date(r.generatedAt).toISOString()}`);
  lines.push('');
  lines.push('ASSESSMENT');
  lines.push(`  Classification ${r.classificationLabel}`);
  lines.push(`  Confidence     ${(r.confidence * 100).toFixed(0)}% (${r.confidenceBand})`);
  lines.push(`  Priority       ${PRIORITY_LABELS[r.priorityBand]} (${r.priorityScore}/100)`);
  lines.push('');
  lines.push('LOCATION');
  lines.push(`  Coordinates    ${formatLatLng(r.location.lat, r.location.lng)}`);
  lines.push(`  District       ${r.location.district ?? '—'}`);
  lines.push(`  State          ${r.location.state ?? '—'}`);
  lines.push(`  Path           ${r.location.breadcrumb.join(' / ')}`);
  lines.push('');
  lines.push('MEASUREMENT');
  lines.push(`  Brightness     ${r.thermal.brightness.toFixed(1)} K`);
  lines.push(`  Radiative pwr  ${r.thermal.frp !== undefined ? `${r.thermal.frp.toFixed(2)} MW` : '—'}`);
  lines.push(`  Platform       ${r.thermal.satellite} ${r.thermal.instrument}`);
  lines.push(`  Overpass       ${r.thermal.daynight}`);
  lines.push(`  Detections     ${r.persistence.detectionCount} over ${r.persistence.activeDays} active days / ${r.persistence.windowDays}d window`);
  if (r.nearestFacility) {
    lines.push(`  Nearest site   ${r.nearestFacility.name} (${r.nearestFacility.type}) — ${r.nearestFacility.distanceKm.toFixed(2)} km`);
  }
  if (r.keyEvidence.length) {
    lines.push('');
    lines.push('SUPPORTING EVIDENCE');
    for (const e of r.keyEvidence) {
      lines.push(`  [${e.weight.toFixed(2)}] ${e.factor}`);
      lines.push(`         ${e.detail}`);
      lines.push(`         source: ${e.source}`);
    }
  }
  if (r.caveats.length) {
    lines.push('');
    lines.push('INTERPRETATION LIMITS');
    for (const c of r.caveats) lines.push(`  - ${c}`);
  }
  lines.push('');
  lines.push('PROVENANCE');
  lines.push(`  Data type      ${r.provenance.dataType}`);
  lines.push(`  Source         ${r.provenance.primarySource}`);
  lines.push(`  Instruments    ${r.provenance.satellites}`);
  lines.push(`  Model          ${r.provenance.modelVersion}`);
  lines.push(`  Context        ${r.provenance.industrialContext}`);
  lines.push('');
  lines.push('Derived from satellite thermal anomalies. Not a legal determination.');
  return lines.join('\n');
}
