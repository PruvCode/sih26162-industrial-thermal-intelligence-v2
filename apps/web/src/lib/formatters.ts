import { type ThermalClass } from '@/types/event';
import { getSeverityFromClass } from './severity';

export function formatBrightness(kelvin: number): string {
  return `${kelvin.toFixed(0)}K`;
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)}m`;
  return `${km.toFixed(1)}km`;
}

export function formatFrp(mw: number): string {
  if (mw < 1) return `${(mw * 1000).toFixed(0)}kW`;
  return `${mw.toFixed(1)}MW`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatEventId(id: string): string {
  // `evt_001` -> `#EVT-001`. The previous `id.slice(-5)` chopped the prefix off
  // and rendered `#T_001`.
  return `#${id.toUpperCase().replace(/_/g, '-')}`;
}

export function formatClassLabel(className: ThermalClass): string {
  return className
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function formatDuration(days: number): string {
  if (days === 0) return 'Same day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

export function getSeverityBorderColor(className: ThermalClass | undefined): string {
  const severity = getSeverityFromClass(className);
  const colors = {
    critical: 'border-severity-fire/30',
    high: 'border-severity-persistent/30',
    medium: 'border-severity-wildfire/30',
    low: 'border-severity-other/30',
  };
  return colors[severity];
}
