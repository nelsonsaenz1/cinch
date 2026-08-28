/**
 * The recurring review ask — the decision half, with no React and no native
 * imports, so the node suite can execute every branch (the same split as
 * `rating-ask-core.ts` beside it).
 *
 * WHAT THIS IS, AND HOW IT DIFFERS FROM `rating-ask-core.ts`
 *
 * The settled-wear ask next door calls `StoreReview.requestReview()` — the
 * OS-owned card that iOS displays AT MOST three times per user per year, on
 * its own judgment. That budget cannot carry a per-session cadence, so this
 * ask goes to the other door Apple provides: the App Store's own
 * write-review page (`?action=write-review`), which is unlimited, is real
 * Apple UI, and takes both the star tap and a written review in one place.
 * What Cinch draws is only its own card asking the question; the rating
 * itself always happens on Apple's surface. Cinch never draws anything that
 * imitates the system rating card — an imitation is an App Review rejection
 * and worse.
 *
 * THE CADENCE (founder directive, 2026-08-28)
 *
 * From the SECOND session onward — never the session an account was created
 * in — the card appears once per session, after the reader has settled in:
 * {@link DWELL_MS} in the app, or {@link MOVES_BEFORE_PROMPT} page moves,
 * whichever comes first. It returns every session until the reader either
 * taps through to the store or says they already rated; both of those end it
 * permanently. "Not now" ends it for the session only.
 */

/** One row per launch — how many times this install has been opened. */
export const SESSION_COUNT_KEY = 'cinch.review.sessionCount.v1';

/**
 * Set once the ask's job is done — the reader went to the store, or said
 * they already had. Never set by a dismissal: "not now" is an answer about
 * today, not about the question.
 */
export const DONE_KEY = 'cinch.review.done.v1';

/** Session 1 belongs to onboarding. The ask starts at session 2. */
export const MIN_SESSION = 2;

/** "Within the first thirty seconds of being on the app." */
export const DWELL_MS = 30_000;

/** …or "scrolling through a few pages", whichever lands first. */
export const MOVES_BEFORE_PROMPT = 3;

/**
 * The App Store's write-review page for Cinch. The `action=write-review`
 * parameter opens the review composer directly — stars and the text field —
 * rather than the listing.
 */
export const WRITE_REVIEW_URL =
  'https://apps.apple.com/app/id6798479578?action=write-review';

/** The kv reads/writes, injected so tests run without expo-sqlite. */
export interface ReviewPromptIo {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

/**
 * Count this launch and return which session it is. A stored value that does
 * not parse is treated as zero rather than thrown on — a corrupted counter
 * must never take the app down, and under-counting only delays the ask.
 */
export function recordSession(io: ReviewPromptIo): number {
  const raw = io.read(SESSION_COUNT_KEY);
  const prev = raw && /^\d+$/.test(raw) ? parseInt(raw, 10) : 0;
  const next = prev + 1;
  io.write(SESSION_COUNT_KEY, String(next));
  return next;
}

/** Whether the ask may run at all this session. */
export function promptEligible(sessionNumber: number, io: ReviewPromptIo): boolean {
  if (sessionNumber < MIN_SESSION) return false;
  return io.read(DONE_KEY) !== 'true';
}

/**
 * Whether the settle-in threshold has been crossed: enough time on the app,
 * or enough movement through it.
 */
export function settledIn(elapsedMs: number, moves: number): boolean {
  return elapsedMs >= DWELL_MS || moves >= MOVES_BEFORE_PROMPT;
}

/** The reader acted — the ask never returns. */
export function markDone(io: ReviewPromptIo): void {
  io.write(DONE_KEY, 'true');
}
