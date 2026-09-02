import { type ThermalClass } from '@/types/event';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityConfig {
  label: string;
  shortLabel: string;
  color: string;
  order: number;
  classes: ThermalClass[];
}

export const SEVERITY_CONFIG: Record<SeverityLevel, SeverityConfig> = {
  critical: {
    label: 'Industrial Fire',
    shortLabel: 'FIRE',
    color: '#EF4444',
    order: 0,
    classes: ['industrial_fire'],
  },
  high: {
    label: 'Persistent Source',
    shortLabel: 'PERSISTENT',
    color: '#F97316',
    order: 1,
    classes: ['persistent_thermal_source'],
  },
  medium: {
    label: 'Wildfire',
    shortLabel: 'WILDFIRE',
    color: '#FACC15',
    order: 2,
    classes: ['natural_wildfire'],
  },
  low: {
    label: 'Other',
    shortLabel: 'OTHER',
    color: '#64748B',
    order: 3,
    classes: ['other'],
  },
};

export function getSeverityFromClass(className: ThermalClass | undefined): SeverityLevel {
  if (!className) return 'low';
  for (const [severity, config] of Object.entries(SEVERITY_CONFIG)) {
    if (config.classes.includes(className)) {
      return severity as SeverityLevel;
    }
  }
  return 'low';
}

export function getSeverityColor(className: ThermalClass | undefined): string {
  return SEVERITY_CONFIG[getSeverityFromClass(className)].color;
}

export function getSeverityLabel(className: ThermalClass | undefined): string {
  return SEVERITY_CONFIG[getSeverityFromClass(className)].label;
}
