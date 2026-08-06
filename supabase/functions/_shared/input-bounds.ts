/**
 * Request bounds for the AI endpoints.
 *
 * Everything in this file exists because the string a caller sends becomes part
 * of a prompt we pay for by the token. A signed-in account that posts a
 * megabyte of text in `notes[]` costs real money per request even though every
 * field is "valid", and the outer body cap is the only thing that bounds the
 * bill before the provider is called.
 *
 * These are hand-written rather than declared with a schema library on purpose.
 * The `*-schema.ts` files next to this one look like they would fit, but they
 * are JSON Schema handed to OpenRouter to constrain *model output* — there is
 * no validator in this project, and pulling one into an Edge Function bundle to
 * enforce a dozen length limits would be the larger change. Every rejection
 * here names the field so the client can show something specific.
 *
 * Rejection is strict rather than truncating. The old code silently sliced
 * oversized candidate lists, which meant a client bug looked like a styling bug
 * and nobody found out.
 */

export class BoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundsError';
  }
}

/**
 * Ceiling on the whole request.
 *
 * Counted in characters of the raw body, not bytes — it is the prompt-shaped
 * quantity, and it is a backstop under the per-field limits below rather than
 * an exact accounting of transfer size.
 */
const MAX_BODY_CHARS = 64 * 1024;

/**
 * Shared field ceilings. Generous against real traffic, fatal to a loop.
 *
 * MAX_ID_CHARS must fit an outfit-candidate id, which the client builds by
 * joining up to four item UUIDs with '.' (`candidateId` in
 * src/features/stylist/use-chat.ts and src/features/styling/use-outfits.ts):
 * 4×36 + 3 = 147 chars. At 64 this bound silently 400'd every stylist-chat
 * and generate-outfits call the evening it shipped — the functions answered
 * in ~260ms, which looked healthy in the logs and was actually the validator
 * rejecting before the model. 160 covers the real maximum with headroom and
 * remains fatal to anything loop-shaped.
 */
const MAX_ID_CHARS = 160;
const MAX_ITEMS_PER_CANDIDATE = 12;
const MAX_ITEM_FIELD_CHARS = 120;
const MAX_NOTES_PER_CANDIDATE = 8;
const MAX_NOTE_CHARS = 240;
const MAX_SUMMARY_LINES = 24;
const MAX_SUMMARY_CHARS = 240;
const MAX_CITY_CHARS = 120;

/**
 * The questionnaire brief.
 *
 * Every value is a key from a fixed client-side vocabulary — `dinner`, `dark`,
 * `separates` — so 32 characters is roomy for the longest of them and far too
 * small to smuggle a prompt through. Deliberately not validated against the
 * enum itself: the vocabularies live in the app and ship on the App Store's
 * schedule, so a server that rejected an unknown key would break every user on
 * the old build the moment a mood was renamed. Bounding the length is what this
 * file is for; the prompt treats the values as labels either way.
 */
const MAX_BRIEF_VALUE_CHARS = 32;

/** Numbers reach the prompt through `Math.round`, so NaN and 1e308 both hurt. */
const MAX_ABS_NUMBER = 1e6;

/** Read the body with a size ceiling applied before anything is parsed. */
export async function readBoundedJson(req: Request): Promise<unknown> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    throw new BoundsError('Could not read the request body.');
  }

  if (raw.length > MAX_BODY_CHARS) {
    throw new BoundsError(
      `Request body is too large (${raw.length} characters, limit ${MAX_BODY_CHARS}).`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new BoundsError('Expected a JSON body.');
  }
}

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

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  if (value.length > max) {
    throw new BoundsError(`${field} is too long (${value.length} characters, limit ${max}).`);
  }
  return value;
}

function boundedArray(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BoundsError(`${field} must be an array.`);
  if (value.length > max) {
    throw new BoundsError(`${field} has too many entries (${value.length}, limit ${max}).`);
  }
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new BoundsError(`${field} must be a boolean.`);
  return value;
}

function boundedNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BoundsError(`${field} must be a finite number.`);
  }
  if (Math.abs(value) > MAX_ABS_NUMBER) {
    throw new BoundsError(`${field} is out of range.`);
  }
  return value;
}

function stringList(value: unknown, field: string, maxCount: number, maxChars: number): string[] {
  return boundedArray(value, field, maxCount).map((entry, i) =>
    requiredString(entry, `${field}[${i}]`, maxChars),
  );
}

/** One assembled outfit, as the on-device engine sends it up. */
export type ValidatedCandidate = {
  id: string;
  items: { slot: string; name: string; color: string; formality: number }[];
  score: number;
  notes: string[];
};

export function parseCandidates(
  value: unknown,
  field: string,
  maxCandidates: number,
): ValidatedCandidate[] {
  return boundedArray(value, field, maxCandidates).map((entry, i) => {
    const c = asObject(entry, `${field}[${i}]`);
    const items = boundedArray(c.items, `${field}[${i}].items`, MAX_ITEMS_PER_CANDIDATE).map(
      (rawItem, j) => {
        const item = asObject(rawItem, `${field}[${i}].items[${j}]`);
        return {
          slot: requiredString(item.slot, `${field}[${i}].items[${j}].slot`, MAX_ITEM_FIELD_CHARS),
          name: requiredString(item.name, `${field}[${i}].items[${j}].name`, MAX_ITEM_FIELD_CHARS),
          // Colour is allowed to be empty: the engine sends '' for a garment
          // whose palette has not been extracted yet.
          color:
            optionalString(item.color, `${field}[${i}].items[${j}].color`, MAX_ITEM_FIELD_CHARS) ??
            '',
          formality: boundedNumber(item.formality, `${field}[${i}].items[${j}].formality`),
        };
      },
    );

    return {
      id: requiredString(c.id, `${field}[${i}].id`, MAX_ID_CHARS),
      items,
      score: boundedNumber(c.score, `${field}[${i}].score`),
      notes: stringList(
        c.notes,
        `${field}[${i}].notes`,
        MAX_NOTES_PER_CANDIDATE,
        MAX_NOTE_CHARS,
      ),
    };
  });
}

// ── stylist-chat ───────────────────────────────────────────────────────────

/** Caps matching what the client actually sends (10 candidates, 8 prior turns). */
export const CHAT_LIMITS = {
  maxMessageChars: 2_000,
  maxHistoryTurns: 8,
  maxTurnChars: 4_000,
  maxDigestChars: 4_000,
  maxCandidates: 10,
} as const;

/** Its own function so the literal union survives, which inline narrowing of an
 *  `unknown` property does not. */
function chatRole(value: unknown, field: string): 'user' | 'assistant' {
  if (value === 'user') return 'user';
  if (value === 'assistant') return 'assistant';
  throw new BoundsError(`${field} must be "user" or "assistant".`);
}

/** What the person tapped through, when they used the guided opening. */
export type ValidatedBrief = {
  occasion: string;
  silhouette?: string;
  mood?: string;
  dressForWeather?: boolean;
};

export type ValidatedChatRequest = {
  message: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  digest?: string;
  candidates: ValidatedCandidate[];
  weather?: { feelsLikeC: number; precipitationChance: number };
  city?: string;
  styleSummary: string[];
  brief?: ValidatedBrief;
};

function parseBrief(value: unknown): ValidatedBrief | undefined {
  if (value === undefined || value === null) return undefined;
  const b = asObject(value, 'brief');
  return {
    occasion: requiredString(b.occasion, 'brief.occasion', MAX_BRIEF_VALUE_CHARS),
    silhouette: optionalString(b.silhouette, 'brief.silhouette', MAX_BRIEF_VALUE_CHARS),
    mood: optionalString(b.mood, 'brief.mood', MAX_BRIEF_VALUE_CHARS),
    dressForWeather: optionalBoolean(b.dressForWeather, 'brief.dressForWeather'),
  };
}

export function parseChatRequest(raw: unknown): ValidatedChatRequest {
  const body = asObject(raw, 'body');

  const history = boundedArray(body.history, 'history', CHAT_LIMITS.maxHistoryTurns).map(
    (entry, i) => {
      const turn = asObject(entry, `history[${i}]`);
      return {
        role: chatRole(turn.role, `history[${i}].role`),
        text: requiredString(turn.text, `history[${i}].text`, CHAT_LIMITS.maxTurnChars),
      };
    },
  );

  const context = body.context === undefined || body.context === null
    ? {}
    : asObject(body.context, 'context');

  let weather: ValidatedChatRequest['weather'];
  if (context.weather !== undefined && context.weather !== null) {
    const w = asObject(context.weather, 'context.weather');
    weather = {
      feelsLikeC: boundedNumber(w.feelsLikeC, 'context.weather.feelsLikeC'),
      precipitationChance: boundedNumber(
        w.precipitationChance,
        'context.weather.precipitationChance',
      ),
    };
  }

  return {
    message: requiredString(body.message, 'message', CHAT_LIMITS.maxMessageChars),
    history,
    digest: optionalString(body.digest, 'digest', CHAT_LIMITS.maxDigestChars),
    candidates: parseCandidates(body.candidates, 'candidates', CHAT_LIMITS.maxCandidates),
    weather,
    city: optionalString(context.city, 'context.city', MAX_CITY_CHARS),
    styleSummary: stringList(
      body.styleSummary,
      'styleSummary',
      MAX_SUMMARY_LINES,
      MAX_SUMMARY_CHARS,
    ),
    brief: parseBrief(body.brief),
  };
}

// ── generate-outfits ───────────────────────────────────────────────────────

/** The client sends a shortlist of 12; 14 leaves headroom without a rewrite. */
export const OUTFIT_LIMITS = {
  maxCandidates: 14,
  maxEvents: 20,
  maxEventTitleChars: 200,
  maxEventTimeChars: 32,
  maxNoteChars: 500,
  maxCount: 5,
} as const;

export type ValidatedOutfitRequest = {
  candidates: ValidatedCandidate[];
  weather?: {
    feelsLikeC: number;
    highC: number;
    lowC: number;
    precipitationChance: number;
    windKph: number;
  };
  events: { title: string; startsAt: string; formality: number }[];
  note?: string;
  city?: string;
  styleSummary: string[];
  count: number;
};

export function parseOutfitRequest(raw: unknown): ValidatedOutfitRequest {
  const body = asObject(raw, 'body');

  const candidates = parseCandidates(body.candidates, 'candidates', OUTFIT_LIMITS.maxCandidates);
  if (!candidates.length) throw new BoundsError('candidates is required.');

  const context = body.context === undefined || body.context === null
    ? {}
    : asObject(body.context, 'context');

  let weather: ValidatedOutfitRequest['weather'];
  if (context.weather !== undefined && context.weather !== null) {
    const w = asObject(context.weather, 'context.weather');
    weather = {
      feelsLikeC: boundedNumber(w.feelsLikeC, 'context.weather.feelsLikeC'),
      highC: boundedNumber(w.highC, 'context.weather.highC'),
      lowC: boundedNumber(w.lowC, 'context.weather.lowC'),
      precipitationChance: boundedNumber(
        w.precipitationChance,
        'context.weather.precipitationChance',
      ),
      windKph: boundedNumber(w.windKph, 'context.weather.windKph'),
    };
  }

  const events = boundedArray(context.events, 'context.events', OUTFIT_LIMITS.maxEvents).map(
    (entry, i) => {
      const e = asObject(entry, `context.events[${i}]`);
      return {
        title: requiredString(e.title, `context.events[${i}].title`, OUTFIT_LIMITS.maxEventTitleChars),
        startsAt: requiredString(
          e.startsAt,
          `context.events[${i}].startsAt`,
          OUTFIT_LIMITS.maxEventTimeChars,
        ),
        formality: boundedNumber(e.formality, `context.events[${i}].formality`),
      };
    },
  );

  // Clamped rather than rejected: `count` only decides how many picks come
  // back, so a bad value is a client bug with a harmless sane reading, and it
  // has been clamped since the endpoint shipped.
  const rawCount = body.count === undefined || body.count === null
    ? 3
    : boundedNumber(body.count, 'count');
  const count = Math.min(Math.max(Math.round(rawCount), 1), OUTFIT_LIMITS.maxCount);

  return {
    candidates,
    weather,
    events,
    note: optionalString(context.note, 'context.note', OUTFIT_LIMITS.maxNoteChars),
    city: optionalString(context.city, 'context.city', MAX_CITY_CHARS),
    styleSummary: stringList(
      body.styleSummary,
      'styleSummary',
      MAX_SUMMARY_LINES,
      MAX_SUMMARY_CHARS,
    ),
    count,
  };
}

// ── tag-item ───────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ValidatedTagRequest = { itemId: string; force: boolean };

export function parseTagRequest(raw: unknown): ValidatedTagRequest {
  const body = asObject(raw, 'body');
  const itemId = requiredString(body.itemId, 'itemId', MAX_ID_CHARS);

  // Checked here rather than left to Postgres: the id is used as a claim key
  // before it is used as a lookup, and a malformed uuid would surface as an
  // opaque 500 from the claim instead of a 400 naming the field.
  if (!UUID.test(itemId)) throw new BoundsError('itemId must be a uuid.');

  if (body.force !== undefined && typeof body.force !== 'boolean') {
    throw new BoundsError('force must be a boolean.');
  }

  return { itemId, force: body.force === true };
}
