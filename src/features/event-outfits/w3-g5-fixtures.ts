import { G } from '@/features/plan/w3-g4-fixtures';

import type { ThreadComment } from '@/components/event-outfits/CommentRow';
import type { PostedLook } from '@/features/event-outfits/types';

/**
 * Frozen fixture data for the Wave 3 Group 5 occasion frames — EV-01…EV-03,
 * CM-01/CM-02, LB-01/LB-02, SL-01/SL-02 and SL-01 / AX.
 *
 * ── DETERMINISM IS THE CONTRACT ───────────────────────────────────────────
 *
 * Every value is a literal. No `new Date()`, no `Date.now()`, no
 * `Math.random()`, no network, no `ActivityIndicator` and no shimmer — the
 * fixtures have to render identical pixels on every run, and both a spinner
 * and a shimmer spin forever and can never reproduce their own bytes.
 *
 * The `Date`s are built local-naive (`new Date(2026, 7, 7, 20, 0)`) rather than
 * parsed from a `Z` instant, for the same reason the plan's are: an occasion is
 * a calendar entry, and a UTC evening renders as a different day west of
 * Greenwich.
 *
 * ── The garments are the repository's own licensed set ────────────────────
 *
 * Imported from `features/plan/w3-g4-fixtures` rather than re-required here.
 * Two lanes each holding their own `Asset.fromModule` of the same photograph is
 * how a fixture set drifts; `G` is already the wave's one table of them, and
 * this module only reads it.
 */

/** Friday 7 August 2026, 8pm, local — the occasion every frame is read against. */
export const G5_STARTS_AT = new Date(2026, 7, 7, 20, 0);

/** The same evening, two hours later — a "now" past the start, for the locked frames. */
export const G5_AFTER_START = new Date(2026, 7, 7, 22, 0);

// ---------------------------------------------------------------------------
// Looks on the shared rail — LB-01, LB-02
// ---------------------------------------------------------------------------

/**
 * A posted look, complete enough for the card and no more.
 *
 * Cast at the boundary because `PostedLook` carries ids and timestamps the
 * frames never read; the same trick `w3-g4-fixtures` uses, and for the same
 * reason — a fixture that has to satisfy every field of a query row is a
 * fixture nobody maintains.
 */
function look(
  id: string,
  userId: string,
  caption: string,
  garments: readonly (typeof G)[keyof typeof G][],
  votes: number,
  voterIds: readonly string[],
  createdAt: Date,
): PostedLook {
  return {
    id,
    outfitId: `${id}-outfit`,
    eventId: 'ev-birthday',
    userId,
    caption,
    garments: [...garments],
    votes,
    voterIds: [...voterIds],
    createdAt,
  } as unknown as PostedLook;
}

export const G5_ME = 'u-me';
export const G5_SARAH = 'u-sarah';
export const G5_MARGUERITE = 'u-marguerite';

export const G5_NAMES: Record<string, string> = {
  [G5_ME]: 'You',
  [G5_SARAH]: 'Sarah',
  [G5_MARGUERITE]: 'Marguerite Okonkwo-Bell',
  'u-jonas': 'Jonas',
};

export const g5NameOf = (userId: string): string | null =>
  userId === G5_ME ? 'You' : (G5_NAMES[userId] ?? null);

/**
 * The two looks LB-01 draws. Sarah's caption is the SHORT case; Marguerite's
 * is audit 95's long case, which wraps to three lines and must not be
 * ellipsised — that is the whole point of the frame.
 */
export const G5_LOOK_SARAH = look(
  'look-sarah',
  G5_SARAH,
  'Cooler once the sun goes down, and I can walk home in these',
  [G.blouse, G.skirt, G.boots, G.crossbody],
  3,
  [G5_ME, 'u-jonas', G5_MARGUERITE],
  new Date(2026, 7, 5, 9, 0),
);

export const G5_LOOK_MARGUERITE = look(
  'look-marguerite',
  G5_MARGUERITE,
  'Warmer, and it is the coat everyone comments on, which is the only real argument for it on a night like this',
  [G.coat, G.mohair, G.trousers, G.loafers],
  2,
  ['u-jonas', G5_SARAH],
  new Date(2026, 7, 5, 11, 30),
);

/** LB-02's first half: both at three, so nothing is ahead. */
export const G5_LOOKS_TIED: PostedLook[] = [
  { ...G5_LOOK_SARAH, votes: 3 },
  { ...G5_LOOK_MARGUERITE, votes: 3 },
];

export const G5_LOOKS_OPEN: PostedLook[] = [G5_LOOK_SARAH, G5_LOOK_MARGUERITE];

// ---------------------------------------------------------------------------
// The thread — CM-01, CM-02
// ---------------------------------------------------------------------------

const comment = (
  over: Partial<ThreadComment> & { id: string; userId: string; body: string; createdAt: Date },
): ThreadComment => ({
  eventId: 'ev-birthday',
  postId: null,
  reported: false,
  hidden: false,
  ...over,
});

/**
 * CM-01's three rows. The second author's name is the long case in situ — a
 * 24-character name — and its body wraps to three lines, which is precisely
 * the pair audit 93's fixed column exists to make behave identically to the
 * first. The third is a reply, indented 26 and narrowed to 235.
 */
export const G5_THREAD: ThreadComment[] = [
  comment({
    id: 'c-1',
    userId: G5_SARAH,
    body: 'Table is booked for eight thirty, not eight, so nobody needs to rush. Wear whatever you want — it is not that kind of place.',
    createdAt: new Date(2026, 7, 4, 10, 12),
  }),
  comment({
    id: 'c-2',
    userId: G5_MARGUERITE,
    body: 'I am bringing the wine from the place on Pearl. Does anyone need a lift from the north side?',
    createdAt: new Date(2026, 7, 5, 14, 5),
  }),
  comment({
    id: 'c-3',
    userId: 'u-jonas',
    body: '@Marguerite Yes please, if you are coming down Broadway.',
    createdAt: new Date(2026, 7, 5, 15, 40),
  }),
];

/** CM-02's own rows, one per state, drawn together on one canvas. */
export const G5_SENDING: ThreadComment = comment({
  id: 'c-sending',
  userId: G5_ME,
  body: 'Eight thirty is much better',
  createdAt: new Date(2026, 7, 6, 9, 0),
  pending: true,
});

export const G5_FAILED: ThreadComment = comment({
  id: 'c-failed',
  userId: G5_ME,
  body: 'Eight thirty is much better, I can get there straight from work',
  createdAt: new Date(2026, 7, 6, 9, 1),
  failed: true,
});

export const G5_HIDDEN: ThreadComment = comment({
  id: 'c-hidden',
  userId: 'u-jonas',
  body: 'Something the host took down',
  createdAt: new Date(2026, 7, 6, 9, 2),
  hidden: true,
});

export const G5_REPORTED: ThreadComment = comment({
  id: 'c-reported',
  userId: 'u-jonas',
  body: 'Something under review',
  createdAt: new Date(2026, 7, 6, 9, 3),
  reported: true,
});

// ---------------------------------------------------------------------------
// The picker — SL-01, SL-02, SL-01 / AX
// ---------------------------------------------------------------------------

/** Nine pieces: three grid rows of three, which is what audit 97 measures. */
export const G5_CANDIDATES = [
  G.blouse,
  G.skirt,
  G.boots,
  G.coat,
  G.mohair,
  G.crossbody,
  G.trousers,
  G.jeans,
  G.overshirt,
];

/** SL-01's three, in order — the numbers ARE the stack order. */
export const G5_STACK_THREE = [G.blouse, G.skirt, G.boots];

/** A full stack, for the seventh-tap refusal. */
export const G5_STACK_FULL = [
  G.blouse,
  G.skirt,
  G.boots,
  G.coat,
  G.mohair,
  G.crossbody,
];
