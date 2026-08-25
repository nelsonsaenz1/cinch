import type { PublisherIds } from './commerce.ts';

/**
 * The one `Deno.env` touch of the commerce module, split out so `commerce.ts`
 * stays importable by the node test suite (`tests/awin-link-construction.
 * test.ts` executes `trackingUrl` and inspects the produced URL — the same
 * split `gap-shop-match/policy.ts` makes against its own `index.ts`).
 */

/** Read publisher ids from the environment. Absent is a valid state — a
 *  network we have not been approved on yet simply yields no links. */
export function publisherIdsFromEnv(): PublisherIds {
  return {
    awinPublisherId: Deno.env.get('AWIN_PUBLISHER_ID') ?? undefined,
    rakutenTrackingId: Deno.env.get('RAKUTEN_TRACKING_ID') ?? undefined,
  };
}
