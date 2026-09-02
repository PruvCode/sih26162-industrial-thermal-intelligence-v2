'use client';

/**
 * INVESTIGATION MODE.
 *
 * Selecting an event does not open a detail drawer — it changes what the
 * application is for. The header carries the five facts an analyst needs to
 * decide whether to keep reading (what, where, how sure, how urgent, since
 * when), and the four tabs each answer one question:
 *
 *   OVERVIEW  what happened, in one paragraph
 *   EVIDENCE  why the model said what it said
 *   HISTORY   has this source been seen before
 *   CONTEXT   what is physically around it
 */

import { X, Target, FileText, Star, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type InvestigationTab } from '@/store/useAppStore';
import { useEventDetails } from '@/features/events/hooks';
import { CLASS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, describeConfidence, EVENT_COLORS } from '@/lib/constants';
import { eventClass, eventConfidence, eventPriorityScore } from '@/data/derive';
import { formatEventId } from '@/lib/formatters';
import { Badge, Button, ErrorState, IconButton, Skeleton } from '@/components/ui/primitives';
import { OverviewTab } from './OverviewTab';
import { EvidenceTab } from './EvidenceTab';
import { HistoryTab } from './HistoryTab';
import { ContextTab } from './ContextTab';
import { ReportModal } from './ReportModal';

const TABS: Array<{ id: InvestigationTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'history', label: 'History' },
  { id: 'context', label: 'Context' },
];

export function InvestigationPanel() {
  const eventId = useAppStore((s) => s.selectedEventId);
  const tab = useAppStore((s) => s.investigationTab);
  const setTab = useAppStore((s) => s.setInvestigationTab);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatch = useAppStore((s) => s.toggleWatch);
  const reportOpen = useAppStore((s) => s.reportOpen);
  const setReportOpen = useAppStore((s) => s.setReportOpen);

  const { data, isLoading, isError, refetch } = useEventDetails(eventId);
  const detail = data?.data ?? null;

  const watched = eventId ? watchlist.includes(eventId) : false;

  if (!eventId) return null;

  return (
    <>
      <aside
        data-testid="investigation-panel"
        data-cursor="panel"
        className="pointer-events-auto flex h-full w-[400px] flex-col overflow-hidden rounded-glass glass-elevated"
        style={{ animation: 'slideInRight 420ms cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError || !detail ? (
          <ErrorState
            title="Event unavailable"
            detail="This event could not be loaded. It may have been filtered out of the current view."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-[8px] w-[8px] shrink-0 rounded-full"
                      style={{
                        background: EVENT_COLORS[eventClass(detail.event)],
                        boxShadow: `0 0 9px ${EVENT_COLORS[eventClass(detail.event)]}99`,
                      }}
                    />
                    <h2 className="font-mono text-[15px] tracking-[0.04em] text-[#F2F6FA]">
                      {formatEventId(detail.event.id)}
                    </h2>
                  </div>
                  <p className="mt-1.5 font-display text-[20px] leading-tight text-[#E8EDF3]">
                    {CLASS_LABELS[eventClass(detail.event)]}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8798AC]">
                    {detail.breadcrumb.slice(1).join(' · ')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                    active={watched}
                    onClick={() => toggleWatch(detail.event.id)}
                  >
                    {watched ? <Star className="h-3 w-3 fill-current" /> : <StarOff className="h-3 w-3" />}
                  </IconButton>
                  <IconButton label="Generate intelligence report" onClick={() => setReportOpen(true)}>
                    <FileText className="h-3 w-3" />
                  </IconButton>
                  <IconButton label="Close investigation" onClick={() => selectEvent(null)}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>

              {/* The four deciding facts */}
              <div className="mt-3.5 grid grid-cols-4 gap-2.5">
                <Fact
                  label="Confidence"
                  value={`${Math.round(eventConfidence(detail.event) * 100)}%`}
                  color={describeConfidence(eventConfidence(detail.event)).color}
                />
                <Fact
                  label="Priority"
                  value={PRIORITY_LABELS[detail.priorityBand]}
                  color={PRIORITY_COLORS[detail.priorityBand]}
                />
                <Fact
                  label="Persistence"
                  value={`${detail.source?.activeDays ?? 1}/${30}d`}
                  color="#A9B6C6"
                />
                <Fact
                  label="FRP"
                  value={`${(detail.event.frp ?? 0).toFixed(1)} MW`}
                  color="#A9B6C6"
                />
              </div>

              {describeConfidence(eventConfidence(detail.event)).requiresReview && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.07)] px-2.5 py-2">
                  <Target className="mt-[1px] h-3 w-3 shrink-0 text-[#F97316]" />
                  <p className="text-[11px] leading-relaxed text-[#FDBA74]">
                    Requires review — {describeConfidence(eventConfidence(detail.event)).note}
                  </p>
                </div>
              )}
            </header>

            {/* ── Tabs ───────────────────────────────────────────────── */}
            <div
              role="tablist"
              aria-label="Investigation sections"
              className="flex shrink-0 border-b border-white/[0.07]"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  data-cursor="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex-1 px-2 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-200',
                    tab === t.id ? 'text-[#8FE6FF]' : 'text-[#6B7C90] hover:text-[#DCE4EE]'
                  )}
                >
                  {t.label}
                  <span
                    className="absolute inset-x-2 bottom-0 h-px transition-all duration-300"
                    style={{ background: tab === t.id ? '#00D9FF' : 'transparent' }}
                  />
                </button>
              ))}
            </div>

            {/* ── Body ───────────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {tab === 'overview' && <OverviewTab detail={detail} />}
              {tab === 'evidence' && <EvidenceTab detail={detail} />}
              {tab === 'history' && <HistoryTab detail={detail} />}
              {tab === 'context' && <ContextTab detail={detail} />}
            </div>

            {/* ── Footer actions ─────────────────────────────────────── */}
            <footer className="flex shrink-0 items-center gap-2 border-t border-white/[0.07] px-4 py-2.5">
              <Badge color={describeConfidence(eventConfidence(detail.event)).color}>
                {describeConfidence(eventConfidence(detail.event)).label}
              </Badge>
              <span className="font-mono text-[9px] tabular-nums text-[#6B7C90]">
                Score {eventPriorityScore(detail.event)}
              </span>
              <Button
                variant="ghost"
                className="ml-auto"
                data-testid="report-button"
                onClick={() => setReportOpen(true)}
              >
                Report
              </Button>
            </footer>
          </>
        )}
      </aside>

      {reportOpen && eventId && <ReportModal eventId={eventId} onClose={() => setReportOpen(false)} />}
    </>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</span>
      <span className="font-mono text-[13px] leading-none tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
