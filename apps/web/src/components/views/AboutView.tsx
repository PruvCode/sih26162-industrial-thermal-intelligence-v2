'use client';

/**
 * ABOUT / METHODOLOGY.
 *
 * This page exists because a system that classifies industrial activity must
 * be able to say what it knows, how it knows it, and where it is guessing.
 * Product trust is a feature: the classification model is stated, the
 * thresholds are stated, and the failure modes are stated rather than buried.
 */

import { Info, Satellite, Cpu, Layers3, AlertTriangle, GitBranch, Database } from 'lucide-react';
import { DATA_PROVENANCE, DEMO_REFERENCE_DATE, WINDOW_DAYS } from '@/data/dataset';
import { INDUSTRIAL_FACILITIES } from '@/data/regions';
import { CLASS_LABELS, EVENT_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, THERMAL_CLASSES } from '@/lib/constants';
import { useAnalytics } from '@/features/events/hooks';
import { SectionLabel } from '@/components/ui/primitives';

export function AboutView() {
  const { data } = useAnalytics();
  const view = data?.data ?? null;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-[860px]">
        <header className="mb-8">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-[#8FE6FF]" />
            <SectionLabel>About</SectionLabel>
          </div>
          <h1 className="mt-3 font-display text-[38px] leading-[1.1] text-[#F2F6FA]">
            Detecting industrial thermal anomalies
            <br />
            <span className="text-[#8798AC]">from orbit, with stated uncertainty.</span>
          </h1>
          <p className="mt-4 max-w-[68ch] text-[14px] leading-relaxed text-[#C3CFDD]">
            SIH26162 ingests satellite thermal anomaly detections across India, links repeat
            detections at the same location into persistent sources, enriches each one with
            industrial and administrative context, and ranks the result so an analyst spends
            attention where it changes an outcome.
          </p>
        </header>

        {/* ── The workflow ─────────────────────────────────────────────── */}
        <Section title="Workflow" icon={<GitBranch className="h-3 w-3" />}>
          <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: '01', t: 'Detect', d: 'Thermal anomalies from VIIRS and MODIS overpasses, filtered to India.' },
              { n: '02', t: 'Prioritise', d: 'Composite score over persistence, industrial proximity, intensity and context.' },
              { n: '03', t: 'Investigate', d: 'Evidence stack, source history and geographic context for one detection.' },
              { n: '04', t: 'Explain', d: 'Weighted supporting and contradicting factors with their data sources.' },
              { n: '05', t: 'Monitor', d: 'Watchlist and watchtower digest tracking what is new, urgent and persistent.' },
              { n: '06', t: 'Report', d: 'Structured intelligence summary, including explicit interpretation limits.' },
            ].map((s) => (
              <li key={s.n} className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[9px] tabular-nums text-[#8FE6FF]">{s.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#E8EDF3]">
                    {s.t}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#A9B6C6]">{s.d}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Data ─────────────────────────────────────────────────────── */}
        <Section title="Data" icon={<Satellite className="h-3 w-3" />}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Primary source" value={DATA_PROVENANCE.primarySource} />
            <Fact label="Instruments" value={DATA_PROVENANCE.satellites} />
            <Fact label="Data type" value={`${DATA_PROVENANCE.dataType} — deterministic seed`} tone="demo" />
            <Fact label="Industrial context" value={DATA_PROVENANCE.industrialContext} />
            <Fact label="Observation window" value={`${WINDOW_DAYS} days to ${DEMO_REFERENCE_DATE.slice(0, 10)}`} />
            <Fact label="Registered facilities" value={`${INDUSTRIAL_FACILITIES.length} sites`} />
            {view && (
              <>
                <Fact label="Detections in window" value={view.totals.events.toLocaleString()} />
                <Fact label="Distinct sources" value={view.totals.sources.toLocaleString()} />
              </>
            )}
          </dl>
        </Section>

        {/* ── Classification ───────────────────────────────────────────── */}
        <Section title="Classification" icon={<Cpu className="h-3 w-3" />}>
          <p className="mb-3 max-w-[68ch] text-[13px] leading-relaxed text-[#C3CFDD]">
            Each detection is assigned one of four classes by a model over engineered thermal,
            temporal and contextual features. Confidences below 55% are surfaced as requiring
            human review rather than being presented as settled.
          </p>
          <ul className="space-y-1.5">
            {THERMAL_CLASSES.map((c) => (
              <li key={c} className="flex items-center gap-3">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: EVENT_COLORS[c], boxShadow: `0 0 7px ${EVENT_COLORS[c]}99` }}
                />
                <span className="text-[12.5px] text-[#DCE4EE]">{CLASS_LABELS[c]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B7C90]">
            Model version {DATA_PROVENANCE.modelVersion}
          </p>
        </Section>

        {/* ── Priority ─────────────────────────────────────────────────── */}
        <Section title="Priority" icon={<Layers3 className="h-3 w-3" />}>
          <p className="mb-3 max-w-[68ch] text-[13px] leading-relaxed text-[#C3CFDD]">
            Priority is deliberately separate from classification. Class answers “what is it”;
            priority answers “how much should anyone care”. It is a 0–100 composite of
            persistence, industrial proximity, radiative power and contextual exposure.
          </p>
          <ul className="flex flex-wrap gap-2">
            {(['critical', 'high', 'moderate', 'low'] as const).map((b) => (
              <li
                key={b}
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1"
                style={{
                  borderColor: `${PRIORITY_COLORS[b]}33`,
                  background: `${PRIORITY_COLORS[b]}14`,
                  color: PRIORITY_COLORS[b],
                }}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.14em]">{PRIORITY_LABELS[b]}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── Limits ───────────────────────────────────────────────────── */}
        <Section title="Known limits" icon={<AlertTriangle className="h-3 w-3" />}>
          <ul className="space-y-2">
            {[
              'Thermal anomaly detection cannot distinguish a deliberate industrial process from an accidental fire using radiance alone — classification is probabilistic, never conclusive.',
              'Cloud cover and smoke suppress detection entirely; absence of a detection is not evidence of absence of activity.',
              'Spatial accuracy is limited by sensor footprint (375 m for VIIRS, 1 km for MODIS). Facility association is inferred from distance, not from ownership data.',
              'Confidence below 55% is presented as requiring review. Those records must not be treated as confirmed classification.',
              'Industrial facility context is a static registry; it does not reflect construction, closure, or change of operator.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[#C3A98C]">
                <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#F97316]" />
                {t}
              </li>
            ))}
          </ul>
        </Section>

        {/* ── Provenance / readiness ───────────────────────────────────── */}
        <Section title="Backend readiness" icon={<Database className="h-3 w-3" />}>
          <p className="max-w-[68ch] text-[13px] leading-relaxed text-[#C3CFDD]">
            The interface reads exclusively through a service layer that resolves to this
            deterministic demo dataset today and to a live{' '}
            <code className="font-mono text-[11.5px] text-[#8FE6FF]">NEXT_PUBLIC_API_URL</code> when
            one is configured. No component holds data of its own, so switching source requires
            no component changes. If the live backend is unreachable, the application degrades to
            demo data rather than failing.
          </p>
        </Section>

        <footer className="mt-10 border-t border-white/[0.07] pt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#5A6B7F]">
            SIH26162 · Industrial Thermal Intelligence · Smart India Hackathon 2026
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-3.5 flex items-center gap-2 border-b border-white/[0.07] pb-2">
        <span className="text-[#8798AC]">{icon}</span>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8EDF3]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'demo';
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</dt>
      <dd
        className="mt-0.5 truncate font-mono text-[11.5px]"
        style={{ color: tone === 'demo' ? '#FBBF24' : '#DCE4EE' }}
      >
        {value}
      </dd>
    </div>
  );
}
