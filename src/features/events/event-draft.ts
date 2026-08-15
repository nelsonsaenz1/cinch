/**
 * The New Occasion draft, on this device only (LP-08).
 *
 * The form asks five questions and the answer to the first one is a sentence
 * somebody thought about. Losing it to a phone call, a low-memory kill, or a
 * thumb on the back gesture is the kind of small betrayal that teaches people
 * not to start typing until they are sure — so the draft survives, and the
 * rules for when it stops surviving are written down here rather than spread
 * across a screen.
 *
 * ── Rules ──────────────────────────────────────────────────────────────────
 *
 * VERSIONED EXPLICITLY, in the key AND in the payload. The version is in the
 * key so a schema bump ORPHANS the old blob instead of decoding it into the
 * wrong shape; it is in the payload too so a hand-written or half-migrated
 * value is still refused on read.
 *
 * USER-SCOPED AND FORM-SCOPED. One key per (user, form). Signing out clears
 * it; signing in as somebody else reads a different key and can never see the
 * previous account's typing.
 *
 * CLEARED ON: explicit discard, and successful create — the latter ONLY after
 * the server has acknowledged the insert, because a draft cleared on optimistic
 * success is a draft lost to a failed write.
 *
 * PRESERVED ON: a failed submit, backgrounding, and navigation away.
 *
 * NEVER ANALYTICS. Nothing in this file is measured, and no caller may pass a
 * draft field to an event. The title of somebody's unposted occasion is not a
 * metric.
 *
 * ── Why this file imports nothing ──────────────────────────────────────────
 *
 * Pure by construction, storage injected by the caller. The unit runner is
 * esbuild over TypeScript with no React and no native shims, so an
 * `AsyncStorage` import at the top of this file would make the round-trip and
 * clearing rules untestable — which are exactly the rules worth testing.
 */

/** Bump this and every existing draft is orphaned rather than misread. */
export const EVENT_DRAFT_VERSION = 1;

/** The form this draft belongs to. A second form gets a second name, never a
 *  second meaning for this one. */
export const EVENT_DRAFT_FORM = 'event.new';

/**
 * 500ms. Long enough that a sentence is one write rather than forty; short
 * enough that the write has landed before a thumb reaches the home indicator.
 */
export const EVENT_DRAFT_DEBOUNCE_MS = 500;

/**
 * What is worth keeping.
 *
 * Dates are stored as the two halves the form actually holds — a local
 * calendar day and minutes-since-midnight — rather than as an instant. An ISO
 * string would re-hydrate in whatever zone the phone is in next, which is how
 * "Saturday 7pm" becomes "Sunday 2am" on a flight.
 */
export type EventDraft = {
  name: string;
  /** `YYYY-MM-DD`, local. Null while no date is picked. */
  day: string | null;
  /** Minutes since local midnight. Null while no time is picked. */
  minutes: number | null;
  placeText: string;
  placeAddress: string | null;
  coords: { latitude: number; longitude: number } | null;
  dressCode: string | null;
  note: string;
};

export function emptyEventDraft(): EventDraft {
  return {
    name: '',
    day: null,
    minutes: null,
    placeText: '',
    placeAddress: null,
    coords: null,
    dressCode: null,
    note: '',
  };
}

/**
 * Nothing worth restoring.
 *
 * The check that decides whether a stored draft is offered back, and whether a
 * change is worth a write at all. Whitespace is not an answer — a draft
 * holding one space would otherwise resurrect the discard prompt forever.
 */
export function isEventDraftEmpty(draft: EventDraft): boolean {
  return (
    draft.name.trim().length === 0 &&
    draft.day === null &&
    draft.minutes === null &&
    draft.placeText.trim().length === 0 &&
    draft.dressCode === null &&
    draft.note.trim().length === 0
  );
}

/**
 * The storage key.
 *
 * Version, form, then user, in that order, so a prefix scan can find every
 * draft of one version or one form. A signed-out user gets `anon`: the form is
 * unreachable signed out, but a key that can never be `undefined` is a key
 * that can never collide by accident.
 */
export function eventDraftKey(userId: string | null): string {
  return `cinch.draft.v${EVENT_DRAFT_VERSION}.${EVENT_DRAFT_FORM}.${userId ?? 'anon'}`;
}

type EventDraftEnvelope = {
  v: number;
  form: string;
  savedAt: number;
  draft: EventDraft;
};

export function encodeEventDraft(draft: EventDraft, savedAt = Date.now()): string {
  const envelope: EventDraftEnvelope = {
    v: EVENT_DRAFT_VERSION,
    form: EVENT_DRAFT_FORM,
    savedAt,
    draft,
  };
  return JSON.stringify(envelope);
}

/** One field of the stored blob as a string, or the fallback. jsonb this is
 *  not — but the value came off a device store that anything can write to. */
function str(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function nullableStr(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

function nullableNum(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function coords(raw: unknown): EventDraft['coords'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { latitude, longitude } = raw as { latitude?: unknown; longitude?: unknown };
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/**
 * A stored blob back into a draft, or null.
 *
 * Validating rather than casting, for the same reason `parseVenueMeta` does:
 * the value survives app upgrades and this is the only place that can refuse
 * it. A wrong version, a wrong form, malformed JSON, or a draft with nothing
 * in it all come back as null — one branch at the call site, "there is a
 * draft" or "there is not".
 */
export function decodeEventDraft(raw: string | null | undefined): EventDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const envelope = parsed as Partial<EventDraftEnvelope>;
  if (envelope.v !== EVENT_DRAFT_VERSION) return null;
  if (envelope.form !== EVENT_DRAFT_FORM) return null;

  const body = envelope.draft;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const day = nullableStr((body as EventDraft).day);

  const draft: EventDraft = {
    name: str((body as EventDraft).name),
    // A malformed day would re-seat the When row on a date nobody picked.
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    minutes: nullableNum((body as EventDraft).minutes),
    placeText: str((body as EventDraft).placeText),
    placeAddress: nullableStr((body as EventDraft).placeAddress),
    coords: coords((body as EventDraft).coords),
    dressCode: nullableStr((body as EventDraft).dressCode),
    note: str((body as EventDraft).note),
  };

  // A time with no day is not restorable — the form cannot show it, and the
  // instant it would build is not one the user picked.
  if (draft.day === null) draft.minutes = null;
  // Coordinates only mean something attached to the text they resolved from.
  if (draft.placeText.trim().length === 0) {
    draft.placeAddress = null;
    draft.coords = null;
  }

  return isEventDraftEmpty(draft) ? null : draft;
}

// ---------------------------------------------------------------------------
// Local date <-> the form's two halves
// ---------------------------------------------------------------------------

/** A `Date` as the local calendar day it falls on. Never `toISOString()`,
 *  which converts to UTC and moves the day for half the planet. */
export function toDraftDay(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` back to a local `Date` at midnight, or null. */
export function fromDraftDay(day: string | null): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

/** The two calls this needs from a key-value store. `AsyncStorage` satisfies
 *  it; so does a Map in a test, which is the point. */
export type DraftStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type EventDraftStore = {
  load(userId: string | null): Promise<EventDraft | null>;
  save(userId: string | null, draft: EventDraft): Promise<void>;
  clear(userId: string | null): Promise<void>;
};

/**
 * The draft store over an injected key-value store.
 *
 * Every method swallows storage faults: the encrypted-storage adapter can
 * throw on a Keychain failure, and a form that refuses to open because it
 * could not read a draft has traded a small loss for a total one.
 *
 * `save` of an empty draft REMOVES the key rather than writing an empty blob.
 * Deleting the last character of a name is a decision, and the next launch
 * should not offer it back.
 */
export function createEventDraftStore(storage: DraftStorage): EventDraftStore {
  return {
    async load(userId) {
      try {
        return decodeEventDraft(await storage.getItem(eventDraftKey(userId)));
      } catch {
        return null;
      }
    },
    async save(userId, draft) {
      const key = eventDraftKey(userId);
      try {
        if (isEventDraftEmpty(draft)) await storage.removeItem(key);
        else await storage.setItem(key, encodeEventDraft(draft));
      } catch {
        // Nothing to report and nothing to retry — the form is still holding
        // everything the user typed.
      }
    },
    async clear(userId) {
      try {
        await storage.removeItem(eventDraftKey(userId));
      } catch {
        /* see above */
      }
    },
  };
}
