'use client';

import type { AnalyticsSummary } from '@/types/event';
import { formatCount } from '@/lib/formatters';
import {
  getSeverityColor,
  getSeverityFromClass,
  SEVERITY_CONFIG,
} from '@/lib/severity';

interface AnalyticsPanelProps {
  data: AnalyticsSummary;
}

export function AnalyticsPanel({ data }: AnalyticsPanelProps) {
  const totalEvents = data.totals.events;

  return (
    <div
      data-cursor="panel"
      className="glass-panel flex w-[240px] flex-col rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] px-3 py-2.5">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#94A3B8]">
          System Status
        </span>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {/* Total Events */}
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#64748B]">
            Total Events
          </span>
          <span className="font-mono text-xl font-medium tabular-nums text-[#F8FAFC]">
            {formatCount(totalEvents)}
          </span>
          <span className="font-mono text-[9px] tabular-nums text-[#64748B]">
            {data.totals.classified} classified · {data.totals.unclassified} pending
          </span>
        </div>

        {/* Classification bar */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#64748B]">
            Classification
          </span>
          <div className="flex h-1.5 overflow-hidden rounded-full">
            {data.byClass.map((item) => {
              const color = getSeverityColor(item.class);
              const pct = (item.count / totalEvents) * 100;
              return (
                <div
                  key={item.class}
                  className="h-full"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            {data.byClass.map((item) => {
              const color = getSeverityColor(item.class);
              const severity = getSeverityFromClass(item.class);
              const config = SEVERITY_CONFIG[severity];
              const pct = (item.count / totalEvents) * 100;
              return (
                <div key={item.class} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[9px] text-[#64748B]">{config.shortLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] tabular-nums text-[#94A3B8]">
                      {formatCount(item.count)}
                    </span>
                    <span className="font-mono text-[8px] tabular-nums text-[#64748B]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Clusters */}
        {data.topClusters.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#64748B]">
              Top Clusters
            </span>
            <div className="flex flex-col gap-1">
              {data.topClusters.slice(0, 3).map((cluster, i) => {
                const color = getSeverityColor(cluster.dominantClass);
                return (
                  <div
                    key={cluster.clusterId}
                    className="flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 font-mono text-[9px] text-[#64748B]">{i + 1}.</span>
                      <span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-mono text-[9px] text-[#94A3B8]">#{cluster.clusterId}</span>
                    </div>
                    <span className="font-mono text-[9px] tabular-nums text-[#64748B]">
                      {cluster.detectionCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sources */}
        {data.bySource.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#64748B]">
              Sources
            </span>
            <div className="flex flex-col gap-1">
              {data.bySource.map((src) => {
                const pct = (src.count / totalEvents) * 100;
                return (
                  <div key={src.source} className="flex items-center justify-between">
                    <span className="flex-1 truncate text-[9px] text-[#64748B]">
                      {src.source.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-[#94A3B8]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
