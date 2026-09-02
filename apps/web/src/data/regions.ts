/**
 * Geographic and industrial context for the seeded demo dataset.
 *
 * Coordinates are real. Facility names are real where they are publicly and
 * unambiguously known (Jamnagar, Paradip, Jharia, …); the thermal *detections*
 * attached to them are entirely synthetic. See DATA_PROVENANCE.
 */

export type IndustrialType =
  | 'refinery'
  | 'power_plant'
  | 'steel_plant'
  | 'coal_mine'
  | 'cement_plant'
  | 'chemical_complex'
  | 'port'
  | 'aluminium_smelter'
  | 'gas_flare'
  | 'metal_smelter';

export interface IndustrialFacility {
  id: number;
  name: string;
  type: IndustrialType;
  state: string;
  lng: number;
  lat: number;
  /** Typical thermal character — gas flares show up every night. */
  profile: 'flare' | 'process' | 'combustion';
}

/**
 * Industrial facilities across India. These anchor the "industrial_fire" and
 * "persistent_thermal_source" classes and drive the nearest-facility context.
 */
export const INDUSTRIAL_FACILITIES: IndustrialFacility[] = [
  // ── Gujarat ────────────────────────────────────────────────────────────
  { id: 1, name: 'Reliance Jamnagar Refinery', type: 'refinery', state: 'Gujarat', lng: 70.06, lat: 22.35, profile: 'flare' },
  { id: 2, name: 'Kandla Port Industrial Estate', type: 'port', state: 'Gujarat', lng: 70.13, lat: 23.03, profile: 'process' },
  { id: 3, name: 'Hazira Industrial Complex', type: 'chemical_complex', state: 'Gujarat', lng: 72.66, lat: 21.15, profile: 'flare' },
  { id: 4, name: 'Vadodara Petrochemical Complex', type: 'chemical_complex', state: 'Gujarat', lng: 73.18, lat: 22.31, profile: 'process' },
  { id: 5, name: 'Ankleshwar Industrial Estate', type: 'chemical_complex', state: 'Gujarat', lng: 72.98, lat: 21.62, profile: 'process' },
  { id: 6, name: 'Dahej Petrochemical Hub', type: 'chemical_complex', state: 'Gujarat', lng: 72.6, lat: 21.7, profile: 'flare' },
  { id: 7, name: 'Vapi Chemical Belt', type: 'chemical_complex', state: 'Gujarat', lng: 72.9, lat: 20.37, profile: 'process' },
  { id: 8, name: 'Kutch Lignite Power Cluster', type: 'power_plant', state: 'Gujarat', lng: 69.85, lat: 23.24, profile: 'combustion' },
  { id: 9, name: 'Sikka Thermal Power Station', type: 'power_plant', state: 'Gujarat', lng: 69.85, lat: 22.42, profile: 'combustion' },
  { id: 10, name: 'Bhavnagar Industrial Zone', type: 'chemical_complex', state: 'Gujarat', lng: 72.14, lat: 21.76, profile: 'process' },

  // ── Maharashtra ────────────────────────────────────────────────────────
  { id: 11, name: 'BPCL Mumbai Refinery', type: 'refinery', state: 'Maharashtra', lng: 72.87, lat: 19.04, profile: 'flare' },
  { id: 12, name: 'HPCL Mumbai Refinery', type: 'refinery', state: 'Maharashtra', lng: 72.81, lat: 19.08, profile: 'flare' },
  { id: 13, name: 'Chandrapur Super Thermal Station', type: 'power_plant', state: 'Maharashtra', lng: 79.3, lat: 19.95, profile: 'combustion' },
  { id: 14, name: 'Nagpur Industrial Belt', type: 'metal_smelter', state: 'Maharashtra', lng: 79.09, lat: 21.15, profile: 'process' },
  { id: 15, name: 'Taloja Industrial Estate', type: 'chemical_complex', state: 'Maharashtra', lng: 73.1, lat: 19.07, profile: 'process' },
  { id: 16, name: 'Wardha Coal Power Cluster', type: 'power_plant', state: 'Maharashtra', lng: 78.6, lat: 20.75, profile: 'combustion' },

  // ── Odisha ─────────────────────────────────────────────────────────────
  { id: 17, name: 'Angul–Talcher Coal Complex', type: 'coal_mine', state: 'Odisha', lng: 85.03, lat: 20.83, profile: 'combustion' },
  { id: 18, name: 'Paradip Refinery', type: 'refinery', state: 'Odisha', lng: 86.61, lat: 20.32, profile: 'flare' },
  { id: 19, name: 'Jharsuguda Aluminium Smelter', type: 'aluminium_smelter', state: 'Odisha', lng: 84.0, lat: 21.85, profile: 'process' },
  { id: 20, name: 'Rourkela Steel Plant', type: 'steel_plant', state: 'Odisha', lng: 84.85, lat: 22.26, profile: 'combustion' },
  { id: 21, name: 'Kalinga Nagar Steel Hub', type: 'steel_plant', state: 'Odisha', lng: 86.03, lat: 20.98, profile: 'combustion' },
  { id: 22, name: 'Ib Valley Coalfield', type: 'coal_mine', state: 'Odisha', lng: 83.9, lat: 21.7, profile: 'combustion' },

  // ── Jharkhand ──────────────────────────────────────────────────────────
  { id: 23, name: 'Jharia Coalfield', type: 'coal_mine', state: 'Jharkhand', lng: 86.43, lat: 23.75, profile: 'combustion' },
  { id: 24, name: 'Bokaro Steel Plant', type: 'steel_plant', state: 'Jharkhand', lng: 85.97, lat: 23.67, profile: 'combustion' },
  { id: 25, name: 'Ramgarh Coalfield', type: 'coal_mine', state: 'Jharkhand', lng: 85.52, lat: 23.63, profile: 'combustion' },
  { id: 26, name: 'Dhanbad Industrial Belt', type: 'coal_mine', state: 'Jharkhand', lng: 86.43, lat: 23.8, profile: 'combustion' },
  { id: 27, name: 'Sindri Fertiliser Complex', type: 'chemical_complex', state: 'Jharkhand', lng: 86.3, lat: 23.68, profile: 'process' },

  // ── West Bengal ────────────────────────────────────────────────────────
  { id: 28, name: 'Durgapur Steel & Power', type: 'steel_plant', state: 'West Bengal', lng: 87.32, lat: 23.55, profile: 'combustion' },
  { id: 29, name: 'Asansol Industrial Belt', type: 'coal_mine', state: 'West Bengal', lng: 86.98, lat: 23.68, profile: 'combustion' },
  { id: 30, name: 'Haldia Petrochemicals', type: 'refinery', state: 'West Bengal', lng: 88.06, lat: 22.06, profile: 'flare' },
  { id: 31, name: 'Raniganj Coalfield', type: 'coal_mine', state: 'West Bengal', lng: 87.13, lat: 23.62, profile: 'combustion' },

  // ── Chhattisgarh ───────────────────────────────────────────────────────
  { id: 32, name: 'Bhilai Steel Plant', type: 'steel_plant', state: 'Chhattisgarh', lng: 81.38, lat: 21.21, profile: 'combustion' },
  { id: 33, name: 'Korba Super Thermal Power', type: 'power_plant', state: 'Chhattisgarh', lng: 82.68, lat: 22.36, profile: 'combustion' },
  { id: 34, name: 'Raigarh Industrial Cluster', type: 'metal_smelter', state: 'Chhattisgarh', lng: 83.4, lat: 21.9, profile: 'process' },

  // ── Assam / North East ─────────────────────────────────────────────────
  { id: 35, name: 'Digboi Oil Field', type: 'refinery', state: 'Assam', lng: 95.62, lat: 27.39, profile: 'flare' },
  { id: 36, name: 'Numaligarh Refinery', type: 'refinery', state: 'Assam', lng: 93.7, lat: 26.62, profile: 'flare' },
  { id: 37, name: 'Guwahati Refinery', type: 'refinery', state: 'Assam', lng: 91.74, lat: 26.14, profile: 'flare' },
  { id: 38, name: 'Margherita Coal Belt', type: 'coal_mine', state: 'Assam', lng: 95.68, lat: 27.28, profile: 'combustion' },
  { id: 39, name: 'Duliajan Oil Complex', type: 'gas_flare', state: 'Assam', lng: 94.62, lat: 27.36, profile: 'flare' },

  // ── South ──────────────────────────────────────────────────────────────
  { id: 40, name: 'Visakhapatnam Steel Plant', type: 'steel_plant', state: 'Andhra Pradesh', lng: 83.3, lat: 17.69, profile: 'combustion' },
  { id: 41, name: 'Visakhapatnam Refinery', type: 'refinery', state: 'Andhra Pradesh', lng: 83.19, lat: 17.59, profile: 'flare' },
  { id: 42, name: 'Kakinada Industrial Corridor', type: 'chemical_complex', state: 'Andhra Pradesh', lng: 82.24, lat: 16.99, profile: 'process' },
  { id: 43, name: 'Chennai Petroleum Refinery', type: 'refinery', state: 'Tamil Nadu', lng: 80.33, lat: 13.23, profile: 'flare' },
  { id: 44, name: 'Ennore Thermal Corridor', type: 'power_plant', state: 'Tamil Nadu', lng: 80.33, lat: 13.22, profile: 'combustion' },
  { id: 45, name: 'Tuticorin Industrial Complex', type: 'metal_smelter', state: 'Tamil Nadu', lng: 78.13, lat: 8.8, profile: 'process' },
  { id: 46, name: 'Mangalore Refinery', type: 'refinery', state: 'Karnataka', lng: 74.84, lat: 12.91, profile: 'flare' },
  { id: 47, name: 'Ballari Mining Belt', type: 'metal_smelter', state: 'Karnataka', lng: 76.93, lat: 15.14, profile: 'process' },
  { id: 48, name: 'Ramagundam Thermal Station', type: 'power_plant', state: 'Telangana', lng: 79.45, lat: 18.76, profile: 'combustion' },

  // ── North / Central ────────────────────────────────────────────────────
  { id: 49, name: 'Panipat Refinery', type: 'refinery', state: 'Haryana', lng: 76.97, lat: 29.39, profile: 'flare' },
  { id: 50, name: 'Mathura Refinery', type: 'refinery', state: 'Uttar Pradesh', lng: 77.67, lat: 27.49, profile: 'flare' },
  { id: 51, name: 'Barauni Refinery', type: 'refinery', state: 'Bihar', lng: 85.98, lat: 25.28, profile: 'flare' },
  { id: 52, name: 'Singrauli Power Cluster', type: 'power_plant', state: 'Madhya Pradesh', lng: 82.67, lat: 24.2, profile: 'combustion' },
  { id: 53, name: 'Bina Refinery', type: 'refinery', state: 'Madhya Pradesh', lng: 78.19, lat: 24.18, profile: 'flare' },
  { id: 54, name: 'Kota Industrial Belt', type: 'chemical_complex', state: 'Rajasthan', lng: 75.86, lat: 25.18, profile: 'process' },
  { id: 55, name: 'Kutch Cement Cluster', type: 'cement_plant', state: 'Gujarat', lng: 69.72, lat: 22.85, profile: 'process' },
];

/** Vegetation / forest regions that produce the natural_wildfire class. */
export interface WildfireRegion {
  id: number;
  name: string;
  state: string;
  lng: number;
  lat: number;
  /** Spread in degrees — forest fires move across a wider area than flares. */
  spread: number;
}

export const WILDFIRE_REGIONS: WildfireRegion[] = [
  { id: 101, name: 'Similipal Biosphere', state: 'Odisha', lng: 86.2, lat: 21.9, spread: 0.42 },
  { id: 102, name: 'Satkosia Wildlife Sanctuary', state: 'Odisha', lng: 84.8, lat: 20.5, spread: 0.3 },
  { id: 103, name: 'Kandhamal Forest Belt', state: 'Odisha', lng: 84.0, lat: 20.3, spread: 0.35 },
  { id: 104, name: 'Bandhavgarh–Umaria', state: 'Madhya Pradesh', lng: 80.99, lat: 23.7, spread: 0.34 },
  { id: 105, name: 'Kanha–Balaghat', state: 'Madhya Pradesh', lng: 80.58, lat: 22.33, spread: 0.38 },
  { id: 106, name: 'Panna–Chhatarpur', state: 'Madhya Pradesh', lng: 79.9, lat: 24.4, spread: 0.28 },
  { id: 107, name: 'Nilgiri–Mudumalai', state: 'Tamil Nadu', lng: 76.7, lat: 11.4, spread: 0.3 },
  { id: 108, name: 'Bandipur–Nagarhole', state: 'Karnataka', lng: 76.4, lat: 11.9, spread: 0.32 },
  { id: 109, name: 'Uttara Kannada Ghats', state: 'Karnataka', lng: 74.75, lat: 14.3, spread: 0.3 },
  { id: 110, name: 'Kaziranga–Karbi Anglong', state: 'Assam', lng: 93.4, lat: 26.6, spread: 0.4 },
  { id: 111, name: 'Manas–Chirang', state: 'Assam', lng: 90.85, lat: 26.7, spread: 0.3 },
  { id: 112, name: 'Sundarbans Buffer', state: 'West Bengal', lng: 88.8, lat: 21.9, spread: 0.22 },
  { id: 113, name: 'Corbett–Nainital', state: 'Uttarakhand', lng: 78.9, lat: 29.5, spread: 0.32 },
  { id: 114, name: 'Girnar–Gir', state: 'Gujarat', lng: 70.8, lat: 21.1, spread: 0.24 },
  { id: 115, name: 'Melghat–Amravati', state: 'Maharashtra', lng: 77.2, lat: 21.4, spread: 0.34 },
  { id: 116, name: 'Tadoba–Chandrapur', state: 'Maharashtra', lng: 79.35, lat: 20.25, spread: 0.3 },
  { id: 117, name: 'Nallamala–Nandyal', state: 'Andhra Pradesh', lng: 78.6, lat: 15.5, spread: 0.36 },
  { id: 118, name: 'Saranda–West Singhbhum', state: 'Jharkhand', lng: 85.3, lat: 22.4, spread: 0.32 },
  { id: 119, name: 'Palamu–Latehar', state: 'Jharkhand', lng: 84.2, lat: 23.6, spread: 0.36 },
  { id: 120, name: 'Bastar–Dantewada', state: 'Chhattisgarh', lng: 81.35, lat: 18.95, spread: 0.42 },
  { id: 121, name: 'Ranthambore–Sawai Madhopur', state: 'Rajasthan', lng: 76.4, lat: 26.0, spread: 0.26 },
  { id: 122, name: 'Nagzira–Bhandara', state: 'Maharashtra', lng: 79.9, lat: 21.2, spread: 0.26 },
];

/**
 * States used for the admin breadcrumb. Bounding boxes are approximate and
 * only used to label synthetic detections, never for geometry.
 */
export const STATE_LABELS = [
  'Gujarat',
  'Maharashtra',
  'Odisha',
  'Jharkhand',
  'Chhattisgarh',
  'West Bengal',
  'Assam',
  'Madhya Pradesh',
  'Karnataka',
  'Tamil Nadu',
  'Andhra Pradesh',
  'Telangana',
  'Uttar Pradesh',
  'Rajasthan',
  'Bihar',
  'Haryana',
  'Uttarakhand',
] as const;

export type StateName = (typeof STATE_LABELS)[number];

/**
 * The operational framing box: India plus the surrounding context the brief
 * requires (Pakistan, Nepal, Bhutan, Bangladesh, Sri Lanka, and portions of
 * Afghanistan, China and Myanmar).
 */
export const INDIA_CONTEXT_BOUNDS: [number, number, number, number] = [
  60.5, // west — into Pakistan / eastern Iran edge
  5.5, // south — below Sri Lanka
  97.5, // east — into Myanmar
  37.0, // north — into Afghanistan / China
];
