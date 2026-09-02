import { cn } from '@/lib/utils';
import { type ThermalClass } from '@/types/event';
import { SEVERITY_CONFIG, getSeverityFromClass } from '@/lib/severity';

interface BadgeProps {
  className?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  thermalClass?: ThermalClass;
  children: React.ReactNode;
}

export function Badge({ className, severity, thermalClass, children }: BadgeProps) {
  const level = severity || (thermalClass ? getSeverityFromClass(thermalClass) : 'low');
  const config = SEVERITY_CONFIG[level];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'font-mono text-[9px] uppercase tracking-[0.1em]',
        className
      )}
      style={{
        backgroundColor: `${config.color}10`,
        color: config.color,
        border: `1px solid ${config.color}26`,
      }}
    >
      {children}
    </span>
  );
}
