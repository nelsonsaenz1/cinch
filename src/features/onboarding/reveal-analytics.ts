/**
 * The Reveal's analytics allowlist — three additions, all bounded.
 *
 * A `.ts` with no import of `@/lib/posthog`, on the convention this wave set:
 * that module pulls in expo-updates and the PostHog SDK and cannot be executed
 * by the node suite, while the PROPERTY SHAPES are the part worth testing,
 * because they are where an identifier would leak in.
 *
 * ── WHY THE COUNT IS BUCKETED ───────────────────────────────────────────────
 *
 * The exact outfit count is the most identifying number this app computes. It
 * is a deterministic function of one person's wardrobe composition, and it has
 * a long tail: "184" is close to unique, and joined against a timestamp it is
 * a fingerprint. So the raw count NEVER travels. What travels is which of five
 * buckets it fell into, which answers every question the funnel actually asks
 * — did the reveal land on nothing, on one, on a handful, on a real closet —
 * without carrying the person along with the answer.
 *
 * ── WHAT MAY NEVER BE SENT ──────────────────────────────────────────────────
 *
 * A garment id, an outfit id, an image path or URL, a city, coordinates,
 * calendar text, free text, a user identity, or the raw count as an unbucketed
 * field. `tests/reveal-analytics.test.ts` asserts this against every builder
 * across every legal input rather than against a copy of this paragraph.
 */

/** The three names, mirrored locally so the union membership is checkable. */
export const REVEAL_EVENTS = {
  phase: 'reveal_phase',
  exit: 'reveal_exit',
  countBucket: 'outfit_count_bucket',
} as const;

/** Which beat the sequence reached. Never how long it took, never what it drew. */
export type RevealPhaseName =
  | 'arriving'
  | 'computing'
  | 'counting'
  | 'settled'
  | 'cascade'
  | 'complete'
  | 'zero';

/**
 * How the reader left.
 *
 * `dismissed` and `unavailable` are kept apart because they are different
 * facts — a person who saw the sheet and said no, and a person the sheet never
 * reached — even though both land on exactly the same screen with the same free
 * tier intact. Collapsing them would make a campaign outage look like refusal.
 */
export type RevealExit =
  | 'open_today'
  | 'dismissed'
  | 'unavailable'
  | 'purchase'
  | 'zero_repair'
  | 'zero_open_today'
  /** Left from the read-failed frame — the wardrobe query never settled. */
  | 'read_failed';

/**
 * WHICH zero a zero was — the closed vocabulary the zero phase may carry.
 * Declared here (the allowlist) so the builders keep their zero-dependency
 * contract; the decision logic that produces one lives in reveal-zero-core.
 */
export type ZeroReason = 'unpairable' | 'unread' | 'no_consent' | 'query_failed';

/** Exported so the privacy test walks every legal value rather than a sample. */
export const ZERO_REASONS: readonly ZeroReason[] = [
  'unpairable',
  'unread',
  'no_consent',
  'query_failed',
];

/** The five buckets the count is allowed to travel as. */
export type CountBucket = '0' | '1' | '2-9' | '10-49' | '50+';

export const COUNT_BUCKETS: readonly CountBucket[] = ['0', '1', '2-9', '10-49', '50+'];

export type RevealProps = Record<string, string | number | boolean>;

/**
 * A count reduced to its bucket.
 *
 * Total and clamped: a negative or fractional input cannot fall through to
 * `undefined` and be sent as one, and anything at or past fifty lands on the
 * open-ended bucket rather than on a number.
 */
export function countBucket(count: number): CountBucket {
  const n = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  if (n === 0) return '0';
  if (n === 1) return '1';
  if (n < 10) return '2-9';
  if (n < 50) return '10-49';
  return '50+';
}

/**
 * The phase, and — on `zero` alone — WHICH zero, from the closed vocabulary in
 * reveal-zero-core.ts. A word, never a count: "unread" travels, "eleven
 * unread" does not, for the same reason the outfit count travels as a bucket.
 * The 8/31 incident was classified by joining three systems by hand; this one
 * bounded word is what makes the next classification a single query.
 */
export const revealPhaseProps = (
  phase: RevealPhaseName,
  zeroReason?: ZeroReason,
): RevealProps => ({
  phase,
  ...(phase === 'zero' && zeroReason ? { zero_reason: zeroReason } : {}),
});

export const revealExitProps = (exit: RevealExit): RevealProps => ({ exit });

/** The bucket, and nothing beside it that could narrow the bucket back down. */
export const countBucketProps = (count: number): RevealProps => ({ bucket: countBucket(count) });

/**
 * The one pre-existing event this screen sends, kept verbatim.
 *
 * `count: 1` is not the outfit count — it is the number of PLATES that were on
 * screen when the impression was recorded, which is the same field every other
 * surface sends and is bounded by `MAX_PLATES`. It fires once, and only after a
 * real plate exists, because a reveal that ended at the honest zero is a screen
 * where no outfit was seen.
 */
export const revealSetViewedProps = (plates: number, offline: boolean): RevealProps => ({
  surface: 'reveal',
  count: Math.max(0, Math.trunc(plates)),
  offline,
});

/** Exported so the privacy test can walk every legal value rather than a sample. */
export const REVEAL_PHASES: readonly RevealPhaseName[] = [
  'arriving',
  'computing',
  'counting',
  'settled',
  'cascade',
  'complete',
  'zero',
];

export const REVEAL_EXITS: readonly RevealExit[] = [
  'open_today',
  'dismissed',
  'unavailable',
  'purchase',
  'zero_repair',
  'zero_open_today',
  'read_failed',
];
