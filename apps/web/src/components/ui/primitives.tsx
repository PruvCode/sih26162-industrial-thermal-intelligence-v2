'use client';

/**
 * Shared UI primitives.
 *
 * Glass is used selectively — navigation, navigator, investigation panel,
 * timeline and floating controls. It is deliberately NOT applied to every
 * surface: on a dark map with dark panels, glassifying everything flattens the
 * depth hierarchy into mush.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Panel ──────────────────────────────────────────────────────────────────

export function GlassPanel({
  children,
  className,
  elevated = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-glass border border-white/[0.07]',
        elevated ? 'glass-elevated' : 'glass-panel',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── Labels ─────────────────────────────────────────────────────────────────

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[9px] uppercase tracking-[0.18em] text-[#8798AC]', className)}>
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: 'default' | 'accent' | 'warn' | 'good';
}) {
  const toneClass = {
    default: 'text-[#E8EDF3]',
    accent: 'text-[#7FE0FF]',
    warn: 'text-[#FCA34D]',
    good: 'text-[#6BD98A]',
  }[tone];
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <span className={cn('font-mono text-[15px] leading-none tabular-nums', toneClass)}>{value}</span>
      {sub && <span className="font-mono text-[9px] text-[#6B7C90]">{sub}</span>}
    </div>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────

export function Badge({
  children,
  color,
  variant = 'soft',
  className,
}: {
  children: ReactNode;
  color?: string;
  variant?: 'soft' | 'outline' | 'solid';
  className?: string;
}) {
  const c = color ?? '#8798AC';
  const style =
    variant === 'solid'
      ? { background: c, color: '#05070B' }
      : variant === 'outline'
        ? { borderColor: `${c}66`, color: c }
        : { background: `${c}1F`, color: c, borderColor: `${c}33` };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.14em]',
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}

export function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
      style={{
        background: color,
        boxShadow: `0 0 7px ${color}99`,
        animation: pulse ? 'statusPulse 2.6s ease-in-out infinite' : undefined,
      }}
    />
  );
}

// ── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; active?: boolean }
>(function Button({ className, variant = 'quiet', active = false, children, ...rest }, ref) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-mono text-[10px] uppercase tracking-[0.14em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40';
  const variants: Record<ButtonVariant, string> = {
    primary:
      'border border-[rgba(0,217,255,0.35)] bg-[rgba(0,217,255,0.08)] px-4 py-2 text-[#8FE6FF] hover:border-[rgba(0,217,255,0.6)] hover:bg-[rgba(0,217,255,0.14)]',
    ghost:
      'border border-white/[0.09] bg-white/[0.02] px-3.5 py-2 text-[#C3CFDD] hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-[#E8EDF3]',
    quiet:
      'border border-transparent px-2.5 py-1.5 text-[#8798AC] hover:bg-white/[0.04] hover:text-[#DCE4EE]',
    danger:
      'border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2 text-[#FCA5A5] hover:border-[rgba(239,68,68,0.55)] hover:bg-[rgba(239,68,68,0.14)]',
  };
  return (
    <button
      ref={ref}
      type="button"
      data-cursor="button"
      className={cn(
        base,
        variants[variant],
        active && 'border-[rgba(0,217,255,0.5)] bg-[rgba(0,217,255,0.12)] text-[#8FE6FF]',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Square icon button used throughout the floating chrome. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }
>(function IconButton({ className, label, active, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      data-cursor="button"
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-200',
        active
          ? 'border-[rgba(0,217,255,0.45)] bg-[rgba(0,217,255,0.12)] text-[#8FE6FF]'
          : 'border-white/[0.08] bg-white/[0.02] text-[#8798AC] hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-[#DCE4EE]',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

// ── States: loading / empty / error / degraded ──────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-white/[0.05]', className)} />;
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="h-8 w-8 rounded-full border border-dashed border-white/[0.14]" />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A9B6C6]">{title}</span>
      {detail && <p className="max-w-[34ch] text-[12px] leading-relaxed text-[#8798AC]">{detail}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="h-8 w-8 rounded-full border border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.08)]" />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#FCA5A5]">{title}</span>
      {detail && <p className="max-w-[38ch] text-[12px] leading-relaxed text-[#8798AC]">{detail}</p>}
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Thin banner shown over the map when the basemap could not be reached. */
export function DegradedBanner({ detail }: { detail: string }) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-md border border-[rgba(249,115,22,0.32)] bg-[rgba(38,22,8,0.72)] px-3 py-2 backdrop-blur-md"
    >
      <Dot color="#F97316" pulse />
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#FDBA74]">Degraded basemap</span>
      <span className="text-[11px] text-[#C3A98C]">{detail}</span>
    </div>
  );
}

// ── Data provenance chip (product trust) ───────────────────────────────────

export function ProvenanceChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'demo';
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#6B7C90]">{label}</span>
      <span
        className="font-mono text-[9px] uppercase tracking-[0.1em]"
        style={{ color: tone === 'demo' ? '#FBBF24' : '#A9B6C6' }}
      >
        {value}
      </span>
    </span>
  );
}
