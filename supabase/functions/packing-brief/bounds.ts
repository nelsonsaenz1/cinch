import { BoundsError } from '../_shared/input-bounds.ts';

/**
 * Request bounds for packing-brief.
 *
 * Same reasoning as `_shared/input-bounds.ts` — every string here becomes part
 * of a prompt billed by the token — but the shapes are this endpoint's own, so
 * they live beside it rather than widening the shared module, exactly as
 * `garment-search/bounds.ts` does.
 *
 * THE GARMENT LIST IS THE FIELD THAT MATTERS. It is the one place in the whole
 * AI surface where a closet inventory goes up rather than a digest, because a
 * packing list has to point at real pieces. The client caps it at 120 with a
 * per-slot balance; this rejects anything past 160 rather than trimming, on the
 * same principle the shared module states — a client sending more than it
 * should is a bug worth seeing, not one to absorb.
 *
 * The enum-ish fields (`vibe`, `companions`, `parts`) are bounded by length and
 * NOT validated against a vocabulary, for the reason the shared module gives:
 * the vocabularies ship on the App Store's schedule, and a server that rejected
 * an unknown key would break every user on the old build the day a vibe is
 * renamed. `parts` is the one exception — the schema hands the model a closed
 * enum, so an unrecognised part could not be answered anyway.
 */

const MAX_PLACE_CHARS = 120;
const MAX_LABEL_CHARS = 48;
const MAX_KEY_CHARS = 32;
const MAX_DIGEST_CHARS = 4_000;
const MAX_SUMMARY_LINES = 24;
const MAX_SUMMARY_CHARS = 240;
const MAX_GARMENTS = 160;
const MAX_GARMENT_FIELD_CHARS = 120;
const MAX_ID_CHARS = 64;
const MAX_DAYS = 30;

/**
 * The day parts the questionnaire asks for.
 *
 * Was `morning, day, night` until 2026-08-09, when atlas 28 replaced them with
 * these four. Both vocabularies are accepted: an old build sending `day` must
 * not 400, and `LEGACY_PARTS` maps it onto the closest new key rather than
 * dropping it — a brief with no day parts at all is a worse answer than a brief
 * for the daytime.
 */
const PARTS = ['daytime', 'evening', 'gym', 'travel'] as const;

const LEGACY_PARTS: Record<string, (typeof PARTS)[number]> = {
  morning: 'daytime',
  day: 'daytime',
  night: 'evening',
};
export type PartKey = (typeof PARTS)[number];

export type ValidatedGarment = {
  id: string;
  name: string;
  color: string;
  slot: string;
  formality: number;
  warmth: number;
};

export type ValidatedPackingRequest = {
  trip: {
    destination: string;
    country: string;
    days: number;
    companions: string;
    companionsLabel: string;
    /** At least one. Multi-select since atlas 28 — "pick as many as are true". */
    vibes: string[];
    vibeLabels: string[];
    parts: PartKey[];
    partLabels: string[];
    month: string;
  };
  digest?: string;
  styleSummary: string[];
  forecast?: { lowC: number; highC: number; rainDays: number };
  garments: ValidatedGarment[];
};

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BoundsError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new BoundsError(`${field} is required.`);
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

function optionalString(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

function boundedArray(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BoundsError(`${field} must be an array.`);
  if (value.length > max) {
    throw new BoundsError(`${field} has too many entries (${value.length}, limit ${max}).`);
  }
  return value;
}

/** Numbers reach the prompt through `Math.round`, so NaN and 1e308 both hurt. */
function boundedNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BoundsError(`${field} must be a finite number.`);
  }
  if (value < min || value > max) throw new BoundsError(`${field} is out of range.`);
  return value;
}

function parsePart(value: unknown, field: string): PartKey {
  if (typeof value === 'string' && (PARTS as readonly string[]).includes(value)) {
    return value as PartKey;
  }
  if (typeof value === 'string' && LEGACY_PARTS[value]) return LEGACY_PARTS[value]!;
  throw new BoundsError(`${field} must be one of ${PARTS.join(', ')}.`);
}

export function parsePackingRequest(raw: unknown): ValidatedPackingRequest {
  const body = asObject(raw, 'body');
  const trip = asObject(body.trip, 'trip');

  const parts = boundedArray(trip.parts, 'trip.parts', PARTS.length).map((p, i) =>
    parsePart(p, `trip.parts[${i}]`),
  );
  if (!parts.length) throw new BoundsError('trip.parts is required.');

  /**
   * The vibe went from one choice to a set on 2026-08-09.
   *
   * A build older than that sends `vibe`/`vibeLabel` as strings, and the
   * function has to keep answering it — the bounds module's whole premise is
   * that a shape change must not 400 every user on yesterday's binary. The
   * array wins when both arrive.
   */
  const MAX_VIBES = 6;
  const rawVibes = trip.vibes ?? (trip.vibe === undefined ? undefined : [trip.vibe]);
  const rawVibeLabels =
    trip.vibeLabels ?? (trip.vibeLabel === undefined ? undefined : [trip.vibeLabel]);

  const vibes = boundedArray(rawVibes, 'trip.vibes', MAX_VIBES).map((v, i) =>
    requiredString(v, `trip.vibes[${i}]`, MAX_KEY_CHARS),
  );
  if (!vibes.length) throw new BoundsError('trip.vibes is required.');

  const vibeLabels = boundedArray(rawVibeLabels ?? [], 'trip.vibeLabels', MAX_VIBES).map((v, i) =>
    requiredString(v, `trip.vibeLabels[${i}]`, MAX_LABEL_CHARS),
  );

  const garments = boundedArray(body.garments, 'garments', MAX_GARMENTS).map((entry, i) => {
    const g = asObject(entry, `garments[${i}]`);
    return {
      id: requiredString(g.id, `garments[${i}].id`, MAX_ID_CHARS),
      name: requiredString(g.name, `garments[${i}].name`, MAX_GARMENT_FIELD_CHARS),
      // Empty is legal: the engine sends '' for a garment whose palette has not
      // been extracted yet, and a colourless piece is still packable.
      color: optionalString(g.color, `garments[${i}].color`, MAX_GARMENT_FIELD_CHARS),
      slot: requiredString(g.slot, `garments[${i}].slot`, MAX_GARMENT_FIELD_CHARS),
      formality: boundedNumber(g.formality, `garments[${i}].formality`, 0, 5),
      warmth: boundedNumber(g.warmth, `garments[${i}].warmth`, 0, 5),
    };
  });
  if (!garments.length) throw new BoundsError('garments is required.');

  let forecast: ValidatedPackingRequest['forecast'];
  if (body.forecast !== undefined && body.forecast !== null) {
    const f = asObject(body.forecast, 'forecast');
    forecast = {
      lowC: boundedNumber(f.lowC, 'forecast.lowC', -90, 60),
      highC: boundedNumber(f.highC, 'forecast.highC', -90, 60),
      rainDays: boundedNumber(f.rainDays, 'forecast.rainDays', 0, MAX_DAYS),
    };
  }

  return {
    trip: {
      destination: requiredString(trip.destination, 'trip.destination', MAX_PLACE_CHARS),
      country: optionalString(trip.country, 'trip.country', MAX_PLACE_CHARS),
      days: Math.round(boundedNumber(trip.days, 'trip.days', 1, MAX_DAYS)),
      companions: requiredString(trip.companions, 'trip.companions', MAX_KEY_CHARS),
      companionsLabel: optionalString(trip.companionsLabel, 'trip.companionsLabel', MAX_LABEL_CHARS),
      vibes,
      vibeLabels,
      parts,
      partLabels: boundedArray(trip.partLabels, 'trip.partLabels', PARTS.length).map((p, i) =>
        requiredString(p, `trip.partLabels[${i}]`, MAX_LABEL_CHARS),
      ),
      month: optionalString(trip.month, 'trip.month', MAX_LABEL_CHARS),
    },
    digest: optionalString(body.digest, 'digest', MAX_DIGEST_CHARS) || undefined,
    styleSummary: boundedArray(body.styleSummary, 'styleSummary', MAX_SUMMARY_LINES).map((s, i) =>
      requiredString(s, `styleSummary[${i}]`, MAX_SUMMARY_CHARS),
    ),
    forecast,
    garments,
  };
}
