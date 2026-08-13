/**
 * The bounded vocabularies, and nothing that can reach a network.
 *
 * Split from `analytics.ts` for the same reason `features/intake/buckets.ts` is
 * split from its own: the emitter imports PostHog, PostHog imports React
 * Native, and the test runner bundles for Node — so a bucket function that
 * lived beside `track` could not be tested at all. The rules about what may be
 * sent are exactly the rules worth testing, so they live where a test can read
 * them.
 */

// ---------------------------------------------------------------------------
// The bucket vocabularies — §7, verbatim
// ---------------------------------------------------------------------------

/** family count `0 | 1 | 2 | 3–5 | 6+` */
export type CountBucket = '0' | '1' | '2' | '3-5' | '6+';
/** latency `under_2s | 2–5s | over_5s` */
export type LatencyBucket = 'under_2s' | '2_5s' | 'over_5s';
/** rank `1 | 2–3 | 4+` */
export type RankBucket = '1' | '2-3' | '4+';
/** selection count `1 | 2–3 | 4+` */
export type SelectionBucket = '1' | '2-3' | '4+';
/** cause `timeout | offline | quota | partner_unavailable | image_unavailable | no_results` */
export type CauseBucket =
  | 'timeout'
  | 'offline'
  | 'quota'
  | 'partner_unavailable'
  | 'image_unavailable'
  | 'no_results';

export const COUNT_BUCKETS: readonly CountBucket[] = ['0', '1', '2', '3-5', '6+'];
export const LATENCY_BUCKETS: readonly LatencyBucket[] = ['under_2s', '2_5s', 'over_5s'];
export const RANK_BUCKETS: readonly RankBucket[] = ['1', '2-3', '4+'];
export const SELECTION_BUCKETS: readonly SelectionBucket[] = ['1', '2-3', '4+'];
export const CAUSE_BUCKETS: readonly CauseBucket[] = [
  'timeout',
  'offline',
  'quota',
  'partner_unavailable',
  'image_unavailable',
  'no_results',
];

/**
 * Every value any of these events can carry, in one list.
 *
 * The test walks it. A property that is not a path, a bucket or a boolean
 * cannot be emitted by this module, which is a stronger statement than "we
 * remembered not to".
 */
export const ALLOWED_VALUES: readonly string[] = [
  'typed',
  'voice',
  'walkthrough',
  ...COUNT_BUCKETS,
  ...LATENCY_BUCKETS,
  ...RANK_BUCKETS,
  ...CAUSE_BUCKETS,
];

// ---------------------------------------------------------------------------
// The bucketing itself — one place, so two events cannot disagree
// ---------------------------------------------------------------------------

export function countBucket(n: number): CountBucket {
  if (n <= 0) return '0';
  if (n === 1) return '1';
  if (n === 2) return '2';
  if (n <= 5) return '3-5';
  return '6+';
}

export function latencyBucket(ms: number): LatencyBucket {
  if (ms < 2000) return 'under_2s';
  if (ms <= 5000) return '2_5s';
  return 'over_5s';
}

/** The family's position in the ranked list, 1-based as the user sees it. */
export function rankBucket(position: number): RankBucket {
  if (position <= 1) return '1';
  if (position <= 3) return '2-3';
  return '4+';
}

export function selectionBucket(n: number): SelectionBucket {
  if (n <= 1) return '1';
  if (n <= 3) return '2-3';
  return '4+';
}

/**
 * A server error code, reduced to one of the six causes §7 allows.
 *
 * Anything unrecognised becomes `partner_unavailable` rather than being passed
 * through: an unknown code is a string from the server, and a string from the
 * server is exactly the unbounded value this module exists to keep out. The
 * cost is one imprecise bucket; the alternative is a cardinality leak that
 * grows every time the function gains an error.
 */
export function causeBucket(code: string | null): CauseBucket {
  switch (code) {
    case 'no_results':
      return 'no_results';
    case 'offline':
      return 'offline';
    case 'timeout':
    case 'search_timeout':
      return 'timeout';
    case 'ai_quota_exceeded':
    case 'quota_unavailable':
    case 'quota':
      return 'quota';
    case 'image_unreachable':
    case 'image_rejected':
    case 'image_unavailable':
      return 'image_unavailable';
    default:
      return 'partner_unavailable';
  }
}
