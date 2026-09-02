import { cn } from '@/lib/utils';

interface TechnicalMetricProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TechnicalMetric({
  label,
  value,
  unit,
  className,
  size = 'md',
}: TechnicalMetricProps) {
  const sizes = {
    sm: { label: 'text-[9px]', value: 'text-xs' },
    md: { label: 'text-[9px]', value: 'text-sm' },
    lg: { label: 'text-[10px]', value: 'text-base' },
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className={cn('section-label', sizes[size].label)}>{label}</span>
      <span className={cn('font-mono tabular-nums', sizes[size].value)}>
        {value}
        {unit && <span className="text-text-muted ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
