/**
 * Affiliate tracking links — Awin and Rakuten.
 *
 * WHAT THIS FILE IS ALLOWED TO KNOW
 *
 * A destination URL, a merchant id, and our own publisher id. That is the whole
 * input. It is deliberately not given a user id, a session, a garment id, or a
 * request — because of the one rule this module exists to hold:
 *
 *   commerce-directive.md §6 refusal 7:
 *   **the click carries no identity to the merchant or the network.**
 *
 * Both networks offer a per-click reference field for exactly the kind of
 * attribution we are refusing — Awin's `clickref` (plus `clickref2`…`clickref6`)
 * and Rakuten's `u1`. **Neither is ever set.** They are named here so that a
 * later reader knows their absence is a decision rather than an oversight, and
 * so a search for "clickref" lands on this comment instead of on nothing.
 *
 * Awin additionally documents that `clickref`/`pref1` is transmitted onward to
 * the advertiser's own landing page, which would hand a third party whatever we
 * put in it. There is no version of that we want.
 *
 * THE LINK IS DERIVED, NEVER STORED
 *
 * `catalog_products.product_url` holds the merchant's plain URL. The tracking
 * URL is built here, at read time, every time. Storing it would bake today's
 * publisher id into rows that outlive it — and a publisher id changes when an
 * account is migrated, which is precisely when nobody remembers to re-write a
 * few hundred thousand cached strings.
 *
 * SOURCES for the two formats, both verified 2026-08-11 against the networks'
 * own documentation rather than from memory:
 *   Awin      https://help.awin.com/developers/docs/click-appends-dyn-params
 *   Rakuten   https://pubhelp.rakutenadvertising.com/hc/en-us/articles/
 *             11459139039373-Create-Deep-Links-Outside-the-Dashboard
 */

export type Network = 'awin' | 'rakuten';

/**
 * Our publisher identity per network.
 *
 * `awinPublisherId` is the numeric publisher id shown in Awin's control panel.
 *
 * `rakutenTrackingId` is **not** the SID. Rakuten's deep-link `id` parameter is
 * the 11-character case-sensitive encrypted tracking id from the publisher
 * dashboard; the SID is a different number used by the reporting APIs. Passing
 * the SID here produces a link that resolves to an error page rather than
 * failing loudly, which is the worst way for this to be wrong — so it is a
 * distinct field name and this comment exists.
 */
export type PublisherIds = {
  awinPublisherId?: string;
  rakutenTrackingId?: string;
};

export class CommerceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommerceConfigError';
  }
}

// `publisherIdsFromEnv` lives in `commerce-env.ts`, not here. This module is
// deliberately free of the `Deno` global so the node test suite can execute
// `trackingUrl` and inspect a real generated link — the only honest way to
// prove refusal 7 (`tests/awin-link-construction.test.ts`), since reading the
// builder proves what it says, not what it does.

/**
 * Build the tracking URL for one product.
 *
 * Throws rather than returning the untracked URL when the publisher id is
 * missing. A silent fallback would mean shipping a link that sends a user to a
 * merchant and earns nothing — indistinguishable, from the outside, from a link
 * that works. `Paid link` would be on screen next to a link that is not one,
 * which is the disclosure being wrong in the direction that matters.
 */
export function trackingUrl(
  network: Network,
  advertiserId: string,
  destinationUrl: string,
  ids: PublisherIds,
): string {
  // Only https destinations. The `ued`/`murl` parameter is a URL we hand to a
  // redirector; anything else here is a redirect primitive with our publisher
  // id attached to it.
  let destination: URL;
  try {
    destination = new URL(destinationUrl);
  } catch {
    throw new CommerceConfigError('destination is not a URL');
  }
  if (destination.protocol !== 'https:') {
    throw new CommerceConfigError(`destination must be https, got ${destination.protocol}`);
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(advertiserId)) {
    throw new CommerceConfigError('advertiserId is not a plausible id');
  }

  if (network === 'awin') {
    if (!ids.awinPublisherId) {
      throw new CommerceConfigError('AWIN_PUBLISHER_ID is not configured');
    }
    const url = new URL('https://www.awin1.com/cread.php');
    url.searchParams.set('awinmid', advertiserId);
    url.searchParams.set('awinaffid', ids.awinPublisherId);
    url.searchParams.set('ued', destination.toString());
    // No clickref. See the header.
    return url.toString();
  }

  if (!ids.rakutenTrackingId) {
    throw new CommerceConfigError('RAKUTEN_TRACKING_ID is not configured');
  }
  const url = new URL('https://click.linksynergy.com/deeplink');
  url.searchParams.set('id', ids.rakutenTrackingId);
  url.searchParams.set('mid', advertiserId);
  url.searchParams.set('murl', destination.toString());
  // No u1. See the header.
  return url.toString();
}

/**
 * The disclosure string, in one place.
 *
 * commerce-directive.md §6 refusal 8: **never abbreviated, greyed, or hidden
 * behind an icon.** It is exported as a constant so that the app and any future
 * surface render the same two words, and so a grep for the phrase finds every
 * place it appears rather than a dozen string literals that drifted.
 */
export const PAID_LINK_LABEL = 'Paid link';
