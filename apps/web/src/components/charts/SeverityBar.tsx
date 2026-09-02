'use client';

import { cn } from '@/lib/utils';
import type { ThermalClass } from '@/types/event';
import { getSeverityColor, getSeverityFromClass, SEVERITY_CONFIG } from '@/lib/severity';

interface SeverityBarProps {
  data: Array<{ class: ThermalClass; count: number }>;
  total: number;
  className?: string;
}

export function SeverityBar({ data, total, className }: SeverityBarProps) {
  if (total === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
        {data.map((item) => {
          const pct = (item.count / total) * 100;
          const color = getSeverityColor(item.class);
          return (
            <div
              key={item.class}
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}40`,
              }}
            />
          );
        })}
      </div>
      <div className="flex">
        {data.map((item) => {
          const pct = (item.count / total) * 100;
          const severity = getSeverityFromClass(item.class);
          const config = SEVERITY_CONFIG[severity];
          return (
            <div
              key={item.class}
              className="flex items-center gap-1.5"
              style={{ width: `${pct}%` }}
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: getSeverityColor(item.class) }}
              />
              <span className="truncate font-mono text-[9px] text-[#64748B]">
                {config.shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
