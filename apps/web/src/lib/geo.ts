/**
 * Geographic math shared by the cinematic globe and the operational map.
 *
 * The critical correctness rule: the globe and the map must agree on where
 * India is. Both read their targets from this module, so the hand-off from
 * "planet in space" to "MapLibre surface" is geographically continuous rather
 * than two unrelated cameras that happen to be near each other.
 */

import * as THREE from 'three';
import type { FacingKey } from './constants';

const D2R = Math.PI / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Convert lat/lng to a point on a unit sphere using the three.js
 * `SphereGeometry` + equirectangular-texture convention.
 *
 * three.js builds its sphere as
 *   x = -r·cos(2πu)·sin(φ),  y = r·cos(φ),  z = r·sin(2πu)·sin(φ)
 * with `u = (lng + 180) / 360` and `φ = (90 - lat)` in radians. Anything else
 * here and the planet's day-map lands 90° or 180° away from where the camera
 * thinks India is — which is exactly how the previous build ended up flying to
 * the Americas.
 */
export function latLngToUnit(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = (90 - lat) * D2R;
  const theta = (lng + 180) * D2R;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    -Math.cos(theta) * sinPhi * radius,
    Math.cos(phi) * radius,
    Math.sin(theta) * sinPhi * radius
  );
}

/** Inverse of `latLngToUnit` — used only by the dev-only target marker. */
export function unitToLatLng(v: THREE.Vector3): LatLng {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) / D2R;
  let theta = Math.atan2(n.z, -n.x) / D2R;
  let lng = theta - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return { lat, lng };
}

/**
 * Rotation that brings a lat/lng surface point to face the +Z axis (the
 * camera). Shortest-arc, so the globe never takes the scenic route through the
 * Pacific on its way to India.
 */
export function facingQuaternion(lat: number, lng: number): THREE.Quaternion {
  const target = latLngToUnit(lat, lng);
  const forward = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(target, forward);
  return q;
}

// ── The India journey ─────────────────────────────────────────────────────

/**
 * Camera-facing keyframes for the cinematic descent.
 *
 * Order matters: the sequence runs WEST → EAST across the old world
 * (East Africa → Arabian Sea → South Asia → India → operational centre).
 * With identity orientation the camera looks at longitude ~0 (the Americas);
 * every keyframe here is deliberately east of that so the journey can never
 * show the Americas, Greenland, the Pacific or ice.
 */
export const JOURNEY_FACING: Record<FacingKey, { lat: number; lng: number }> = {
  /** Whole Earth, Atlantic/Africa side — the "planet" establishing shot. */
  EARTH: { lat: 8, lng: 28 },
  /** Drift east: Arabian peninsula, Red Sea, Iran. */
  ASIA_APPROACH: { lat: 18, lng: 48 },
  /** South Asia framed: India, Pakistan, Bay of Bengal coming into view. */
  ASIA: { lat: 26, lng: 66 },
  /** India centred. */
  INDIA: { lat: 22.5, lng: 78.9 },
  /** India + surrounding region — the final operational framing. */
  REGION: { lat: 21, lng: 79 },
};

/** Approximate geographic centre of India. */
export const INDIA_CENTER: LatLng = { lat: 22.5, lng: 78.9 };

/**
 * The operational map framing: India plus the surrounding context the brief
 * requires — Pakistan, Nepal, Bhutan, Bangladesh, Sri Lanka, and meaningful
 * portions of Afghanistan, China and Myanmar. Deliberately excludes Africa,
 * Europe, the Americas and Australia.
 */
export const INDIA_AOI_BOUNDS: [number, number, number, number] = [66.5, 5.5, 92.5, 36.5];

/** Centre of the AOI — the globe's final descent target and the map's anchor. */
export const AOI_CENTER: [number, number] = [
  (INDIA_AOI_BOUNDS[0] + INDIA_AOI_BOUNDS[2]) / 2,
  (INDIA_AOI_BOUNDS[1] + INDIA_AOI_BOUNDS[3]) / 2,
];

/**
 * Panel-aware padding for `fitBounds`. Panels float over the map, so the
 * geographic centre of interest must be inset by the width of the navigator
 * (left), the intelligence panel (right), the nav bar (top) and the timeline
 * (bottom). Returned in CSS pixels.
 */
export function mapPaddingForViewport(width: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  if (width < 900) {
    // Panels collapse to sheets on small viewports.
    return { top: 72, bottom: 96, left: 24, right: 24 };
  }
  if (width < 1280) {
    return { top: 76, bottom: 104, left: 300, right: 300 };
  }
  return { top: 88, bottom: 116, left: 352, right: 416 };
}

/**
 * Padding used when flying to a single event. Smaller than the framing
 * padding: the point must sit comfortably inside the visible band but it does
 * not need the full panel inset, and a large asymmetric padding makes the
 * camera drift in a way that reads as a bug.
 */
export function flyToPaddingForViewport(width: number): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  if (width < 900) return { top: 64, bottom: 90, left: 24, right: 24 };
  if (width < 1280) return { top: 80, bottom: 110, left: 240, right: 240 };
  return { top: 96, bottom: 140, left: 300, right: 360 };
}

/** Great-circle distance in km. */
export function distanceKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Compass bearing from point A to point B, in degrees. */
export function bearingDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const φ1 = lat1 * D2R;
  const φ2 = lat2 * D2R;
  const Δλ = (lng2 - lng1) * D2R;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}

export function formatLatLng(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}
