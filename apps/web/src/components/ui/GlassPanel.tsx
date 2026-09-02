'use client';

import { cn } from '@/lib/utils';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated';
  as?: React.ElementType;
  onClick?: () => void;
}

export function GlassPanel({
  children,
  className,
  variant = 'default',
  as: Component = 'div',
  onClick,
}: GlassPanelProps) {
  const variantClasses = {
    default: 'glass',
    elevated: 'glass-elevated',
  };

  return (
    <Component
      className={cn(variantClasses[variant], className)}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
