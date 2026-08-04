import type { GarmentColor } from '@/lib/color';
import type { Database } from '@/types/database';

export type ItemRow = Database['public']['Tables']['items']['Row'];

/**
 * Where a garment sits in a look. Derived from category + subcategory rather
 * than stored, because the same DB category covers very different roles: a
 * t-shirt and a cardigan are both `top`, but one goes under the other.
 */
export type Slot =
  | 'base_top'
  | 'mid_layer'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'footwear'
  | 'bag'
  | 'headwear'
  | 'accessory';

/** How close to the body a garment is cut. Drives the volume-balance rule. */
export type Fit = 'fitted' | 'regular' | 'relaxed' | 'oversized';

/** Visual size of a print. Two patterns only coexist when their scales differ. */
export type PatternScale = 'none' | 'micro' | 'small' | 'medium' | 'large';

/**
 * A closet item reduced to everything the scorer needs and nothing it doesn't.
 *
 * Built once per generation pass and reused across every candidate, which is
 * what keeps enumeration cheap — the expensive work (colour conversion, keyword
 * inference) happens O(closet) rather than O(combinations).
 */
export type Garment = {
  id: string;
  slot: Slot;
  category: ItemRow['category'];
  subcategory: string | null;
  colors: GarmentColor[];
  /** Share of the visual field this garment occupies, before normalisation. */
  visualWeight: number;
  fit: Fit;
  pattern: string | null;
  patternScale: PatternScale;
  material: string | null;
  brand: string | null;
  formality: number; // 1..5
  warmth: number; // 1..5
  waterResistant: boolean;
  seasons: string[];
  occasions: string[];
  wearCount: number;
  lastWornAt: number | null; // epoch ms
  purchasePrice: number | null;
  thumbPath: string | null;
  cutoutPath: string | null;
};

export type WeatherContext = {
  /** Apparent temperature in Celsius — always feels-like, never raw. */
  feelsLikeC: number;
  highC: number;
  lowC: number;
  precipitationChance: number; // 0..1
  windKph: number;
  /** True when the day spans a range that a single warmth level cannot cover. */
  swing: boolean;
};

export type EventContext = {
  id: string;
  title: string;
  /** Minutes from midnight local. */
  startsAt: number;
  endsAt: number;
  /** 1..5, inferred from the event or supplied by the user. */
  formality: number;
  occasion: string | null;
  indoor: boolean;
};

export type StyleContext = {
  weather: WeatherContext | null;
  events: EventContext[];
  /** Free text the user typed: "dinner then drinks". */
  note: string | null;
  /** Target formality when there are no events to infer from. */
  targetFormality: number | null;
  targetOccasion: string | null;
  season: string | null;
  colorSeason: string | null;
  /** Epoch ms of "now", passed in so scoring stays pure and testable. */
  now: number;
};

/**
 * The named features every outfit is scored on.
 *
 * This shape is the contract for the whole system: the scorer produces it, the
 * UI explains it, and the learner updates one weight per key. Adding a feature
 * means adding it here and giving it a prior in DEFAULT_WEIGHTS — nothing else
 * needs to change.
 */
export type FeatureVector = {
  palette: number;
  formality: number;
  weather: number;
  occasion: number;
  proportion: number;
  pattern: number;
  season: number;
  freshness: number;
  affinity: number;
};

export type FeatureKey = keyof FeatureVector;

export const FEATURE_KEYS: FeatureKey[] = [
  'palette',
  'formality',
  'weather',
  'occasion',
  'proportion',
  'pattern',
  'season',
  'freshness',
  'affinity',
];

export type OutfitCandidate = {
  items: Garment[];
  features: FeatureVector;
  /** Weighted total, 0..1. */
  score: number;
  /** Human-readable notes keyed by the feature that produced them. */
  notes: Partial<Record<FeatureKey, string>>;
  /** Colour schemes that fired, for the reasoning string. */
  harmonies: string[];
};
