import { Asset } from 'expo-asset';

import type { SentItemDetail, SentPhoto } from '@/features/auth/use-ai-privacy';
import type { DataExport } from '@/features/privacy/format';

/**
 * The frozen data behind every `dev-w3-g4-*` route.
 *
 * HARD DETERMINISM. Not one value here is computed: no `new Date()`, no
 * `Date.now()`, no `Math.random()`, no query. `dev-privacy.tsx`'s `daysAgo()`
 * helper is deliberately not reused — a fixture whose dates move with the
 * calendar produces a different screenshot every day, and a screenshot whose
 * bytes cannot be reproduced is not evidence of anything.
 *
 * The dates are ISO literals in the past, except `LINKS_UNTIL`, which has to be
 * in the future or `exportStateOf` derives `expired` from the clock and the
 * Ready frame turns into a different frame. It is far enough out that the
 * derivation does not change between now and any plausible capture.
 *
 * The photographs are the repository's own licensed garment set, resolved to
 * local asset URIs — no network, and no signing step, because the real screen
 * only ever hands the component an already-signed result.
 */

const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const LOAFERS = Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri;

/** The consent record CN-03 reads from. */
export const GRANTED_AT = '2026-03-03T09:12:00.000Z';
/** CN-02: the state a user chose, and the day they chose it. */
export const REVOKED_AT = '2026-07-31T18:04:00.000Z';
export const CONSENT_VERSION = 2;

/** CN-03 · the itemised half of the ledger. One row per piece, newest first. */
export const SENT_PHOTOS: SentPhoto[] = [
  { itemId: 'i-blouse', sentAt: '2026-08-10T09:12:00.000Z' },
  { itemId: 'i-trousers', sentAt: '2026-08-03T14:40:00.000Z' },
  { itemId: 'i-loafers', sentAt: '2026-07-20T11:26:00.000Z' },
];

export const SENT_DETAILS: Record<string, SentItemDetail> = {
  'i-blouse': { id: 'i-blouse', thumbPath: BLOUSE, cutoutPath: null, name: 'Blouse' },
  'i-trousers': { id: 'i-trousers', thumbPath: TROUSERS, cutoutPath: null, name: 'Trousers' },
  'i-loafers': { id: 'i-loafers', thumbPath: LOAFERS, cutoutPath: null, name: 'Loafers' },
};

/** The fixture's signing step, which is no step: the paths are already URIs. */
export const resolveThumb = (cutoutPath: string | null, thumbPath: string | null) =>
  cutoutPath ?? thumbPath ?? undefined;

/** The second door, counted separately — never added to the first. */
export const LISTING_SENDS = 4;

/** CN-04 · pieces filed while naming was off. Counted, never estimated. */
export const UNTAGGED_COUNT = 61;

/** PV-01 · the AI row's live gist, as `app/privacy.tsx` composes it. */
export const CONSENT_DETAIL_GRANTED = 'Given 3 March 2026 · describing and matching';

// ── PV-03 · the export states ──────────────────────────────────────────────

/** Beyond any plausible capture date, so `exportStateOf` never derives expiry. */
const LINKS_UNTIL = '2030-01-12T09:00:00.000Z';

export const EXPORT_BUILDING: DataExport = {
  id: 'x-building',
  requestedAt: '2026-08-12T09:38:00.000Z',
  status: 'pending',
  readyAt: null,
  bytes: null,
  expiresAt: null,
  error: null,
};

export const EXPORT_READY: DataExport = {
  id: 'x-ready',
  requestedAt: '2026-08-12T09:38:00.000Z',
  status: 'ready',
  readyAt: '2026-08-12T09:44:00.000Z',
  // Measured off the assembled archive by the worker, never estimated here.
  bytes: 3_940_000,
  expiresAt: LINKS_UNTIL,
  error: null,
};

export const EXPORT_FAILED: DataExport = {
  id: 'x-failed',
  requestedAt: '2026-08-12T09:38:00.000Z',
  status: 'failed',
  readyAt: null,
  bytes: null,
  expiresAt: null,
  // Null on purpose: the frame shows the component's own two-fact sentence,
  // which is the branch a reader hits when the worker wrote nothing.
  error: null,
};
