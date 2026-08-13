/**
 * The nine catalogue events, and the reason they are the only nine.
 *
 * §7 of the handoff lists them with their properties and their buckets, and
 * then says the thing that matters: "Never query text, transcript, brand,
 * product title, colour name, URL or image reference."
 *
 * That sentence is easy to agree with and easy to break, because every one of
 * those values is in scope at the exact moment an event fires — `track` takes
 * `Record<string, unknown>`, and adding `{ brand }` to a call would compile,
 * ship, and be indistinguishable from correct until somebody read the PostHog
 * table. So this module does not expose a general emitter. Each event is a
 * named function whose parameters are the bucket types, raw values have no
 * parameter to be passed in, and `tests/catalogue-analytics.test.ts` asserts
 * that every property this file can emit is one of the bounded vocabularies
 * below.
 *
 * THE AGGREGATE NELSON ASKED FOR IS NOT HERE. "What are people searching for
 * most" needs the query text, which is precisely what may not be sent. It is a
 * server-side aggregate over data Cinch already holds — Packet 4 — and it is
 * NOT approximated here with a high-cardinality client property, because a
 * "top queries" board assembled out of raw client telemetry is the privacy
 * failure wearing the feature's clothes.
 */

import { track } from '@/lib/posthog';

import {
  causeBucket,
  countBucket,
  latencyBucket,
  rankBucket,
  selectionBucket,
} from './buckets';
import type { CataloguePath } from './query';

export * from './buckets';

// ---------------------------------------------------------------------------
// The nine events
// ---------------------------------------------------------------------------

/** CPV2-01, CPV2-02, CPV2-V01 — on display. */
export function catalogueSearchOffered(path: CataloguePath): void {
  track('catalogue_search_offered', { path });
}

/**
 * CPV2-01, CPV2-03, CPV2-V02 — on submit.
 *
 * `had_colour_reference` is a BOOLEAN, and that is the whole design of it: the
 * question worth answering is whether people name colours when they search, and
 * the colour itself answers a different question nobody asked at the cost of
 * putting "heather grey" in an event.
 */
export function catalogueSearchStarted(path: CataloguePath, hadColourReference: boolean): void {
  track('catalogue_search_started', { path, had_colour_reference: hadColourReference });
}

/** CPV2-04, and CPV2-09 with a zero bucket. */
export function catalogueSearchCompleted(familyCount: number, latencyMs: number): void {
  track('catalogue_search_completed', {
    result_family_count_bucket: countBucket(familyCount),
    latency_bucket: latencyBucket(latencyMs),
  });
}

/** CPV2-04 → CPV2-05. */
export function catalogueFamilyOpened(position: number): void {
  track('catalogue_family_opened', { rank_bucket: rankBucket(position) });
}

/** CPV2-05 → CPV2-06. */
export function catalogueColoursSelected(count: number): void {
  track('catalogue_colours_selected', { count_bucket: selectionBucket(count) });
}

/** CPV2-06. */
export function catalogueImportStarted(count: number): void {
  track('catalogue_import_started', { count_bucket: selectionBucket(count) });
}

/** CPV2-07, CPV2-08. Both counts, because a partial import is the interesting one. */
export function catalogueImportCompleted(successCount: number, failureCount: number): void {
  track('catalogue_import_completed', {
    success_count_bucket: countBucket(successCount),
    failure_count_bucket: countBucket(failureCount),
  });
}

/** CPV2-10. */
export function catalogueSearchFailed(code: string | null): void {
  track('catalogue_search_failed', { cause_bucket: causeBucket(code) });
}

/** CPV2-07 retry, CPV2-10 retry. */
export function catalogueSearchRecovered(code: string | null): void {
  track('catalogue_search_recovered', { cause_bucket: causeBucket(code) });
}
