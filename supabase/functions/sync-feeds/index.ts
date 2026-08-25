import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { parseJoinedProgrammes } from '../_shared/joined-programmes.ts';

/**
 * sync-feeds — maintain the joined-programmes ledger, then pull approved
 * merchants' product feeds into `catalog_products`.
 *
 * ACTIVATED 2026-08-25 (awin-joined-programmes-directive.md) after two weeks
 * dormant — `docs/commerce/sync-feeds-dormant.md` records both states. The
 * objection that kept it unscheduled ("a job that fails on every tick") no
 * longer applies: phase 0 below always has real work — reading Awin's answer
 * to "which programmes is publisher 3030871 joined to" — and a run with zero
 * joined programmes simply fetches zero feeds and succeeds.
 *
 * PHASE 0 IS THE SOURCE OF TRUTH for `commerce_joined_programmes`. That table
 * is the only thing that may label a link `Paid link`, and it is written from
 * the API read alone — never by hand — so the label can only claim a
 * membership Awin itself reports. A programme that disappears from the answer
 * is deactivated the same day, because a lapsed approval stops paying without
 * telling anyone, and `Paid link` on an unpaid link is the disclosure being
 * wrong in the direction that matters.
 *
 * It is the second supplier: Datafeedr is breadth without approvals and a hard
 * 10,000-request monthly ceiling, Awin is depth with approvals and no ceiling.
 *
 * AND IT GATES NOTHING. Shop suggestions (`gap-shop-match`) and listing
 * photographs (`garment-search`) both read Datafeedr and work now. Believing
 * this function was the blocker for those is what the doc above exists to stop
 * happening twice.
 *
 * Invoked by cron, never by a person. There is no user in this path at all,
 * which is why it authenticates with a shared secret in the same shape as
 * `send-push`'s `x-cinch-cron` and `build-export`'s sweep header, and fails
 * closed when the secret is unset. The project's publishable key is also a JWT
 * that satisfies `verify_jwt`, so the platform edge alone is not a gate.
 *
 * AWIN ONLY, FOR NOW, AND WHY
 *
 * Awin publishes downloadable feeds; Rakuten answers a live Product Search API
 * instead. Those are different integrations, not two configurations of one, and
 * pretending otherwise behind a shared abstraction would produce a function
 * that is wrong about both. Rakuten arrives as a provider in `garment-search`
 * rather than as rows here — nothing to ingest when the catalogue is queried
 * live. `catalog_merchants.network` already carries the distinction so the
 * split is visible in the data rather than only in this comment.
 *
 * Feed endpoint, verified 2026-08-11 against Awin's own API documentation:
 *   GET https://api.awin.com/publishers/{publisherId}/awinfeeds/download/
 *       {advertiserId}-{vertical}-{locale}
 *   Authorization: Bearer {token}
 * The body is JSON Lines in Google's product-data shape: `id`, `title`, `link`,
 * `image_link`, `price`, `brand`, `color`, `availability`,
 * `google_product_category`.
 */

/** Awin documents no more than 5 requests/minute, and forbids concurrent
 *  requests to the same feed. One merchant at a time, with a gap. */
const FEED_GAP_MS = 13_000;

/** A single apparel feed can run to hundreds of thousands of rows. This is a
 *  memory and time bound, not a business rule — a merchant whose feed exceeds
 *  it is truncated and SAID SO in `sync_error`, never silently clipped. */
const MAX_PRODUCTS_PER_MERCHANT = 20_000;

/** Rows per upsert. Large enough to be few round trips, small enough that one
 *  failure does not lose a whole feed. */
const BATCH = 500;

/** Feeds are big and slow; this is generous on purpose. */
const FEED_TIMEOUT_MS = 120_000;

/** The programmes read is one small JSON document. */
const PROGRAMMES_TIMEOUT_MS = 30_000;

/** Google's taxonomy is a `>`-delimited path. Cinch needs one of ten slots.
 *  Order matters: the first match wins, so the most specific terms lead. */
const SLOT_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(shoe|sneaker|boot|loafer|sandal|heel|footwear|pump|clog)/i, 'footwear'],
  [/\b(handbag|tote|clutch|backpack|purse|satchel|luggage|bag)/i, 'bag'],
  [/\b(hat|cap|beanie|headwear|headband|beret)/i, 'headwear'],
  [/\b(jewelry|jewellery|necklace|bracelet|earring|ring\b|brooch)/i, 'jewelry'],
  [/\b(coat|jacket|outerwear|parka|blazer|overcoat|anorak)/i, 'outerwear'],
  [/\b(dress|gown|jumpsuit|romper)/i, 'dress'],
  [/\b(pant|trouser|jean|short|skirt|legging|chino|bottom)/i, 'bottom'],
  [/\b(shirt|top\b|blouse|sweater|jumper|hoodie|tee|t-shirt|cardigan|knitwear)/i, 'top'],
  [/\b(scarf|belt|glove|sunglass|tie\b|accessor)/i, 'accessory'],
];

function slotFor(category: string | null | undefined, title: string): string | null {
  // Category first — it is the merchant's own classification. Title is the
  // fallback because a feed row with a missing category is common and a
  // guessable title is better than dropping a usable product.
  for (const [pattern, slot] of SLOT_RULES) {
    if (category && pattern.test(category)) return slot;
  }
  for (const [pattern, slot] of SLOT_RULES) {
    if (pattern.test(title)) return slot;
  }
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Google feeds write price as "49.99 USD". Minor units, or null when the
 *  string is not what the spec promises — a wrong price is worse than none. */
function parsePrice(raw: unknown): { cents: number | null; currency: string | null } {
  if (typeof raw !== 'string') return { cents: null, currency: null };
  const match = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Z]{3})$/);
  if (!match) return { cents: null, currency: null };
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return { cents: null, currency: null };
  return { cents: Math.round(amount * 100), currency: match[2] };
}

type ProductRow = Database['public']['Tables']['catalog_products']['Insert'];

/** One feed line to one row, or null if the line cannot make a usable product.
 *  Both URLs are required and both must be https — an http image would be
 *  blocked by ATS on the device, so a row without them is a broken tile. */
function rowFrom(merchantId: string, line: Record<string, unknown>): ProductRow | null {
  const externalId = typeof line.id === 'string' ? line.id.slice(0, 64) : null;
  const title = typeof line.title === 'string' ? line.title.trim().slice(0, 150) : null;
  const imageUrl = typeof line.image_link === 'string' ? line.image_link : null;
  const productUrl = typeof line.link === 'string' ? line.link : null;

  if (!externalId || !title || !imageUrl || !productUrl) return null;
  if (!imageUrl.startsWith('https://') || !productUrl.startsWith('https://')) return null;

  const availability =
    typeof line.availability === 'string' &&
    ['in_stock', 'out_of_stock', 'preorder', 'backorder'].includes(line.availability)
      ? line.availability
      : 'in_stock';

  const category =
    typeof line.google_product_category === 'string' ? line.google_product_category : null;
  const { cents, currency } = parsePrice(line.price);

  return {
    merchant_id: merchantId,
    external_id: externalId,
    title,
    brand: typeof line.brand === 'string' ? line.brand.trim().slice(0, 70) || null : null,
    colour: typeof line.color === 'string' ? line.color.trim().slice(0, 100) || null : null,
    price_cents: cents,
    currency,
    image_url: imageUrl,
    product_url: productUrl,
    availability,
    google_category: category?.slice(0, 500) ?? null,
    slot: slotFor(category, title),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Phase 0 — reconcile `commerce_joined_programmes` against Awin's own answer.
 *
 * Three writes, in an order chosen so a failure part-way leaves the safe
 * state behind:
 *
 *  1. Upsert every reported programme as active. `joined_at` is deliberately
 *     not in the payload, so the insert default records first sight and a
 *     re-upsert does not rewrite history.
 *  2. Deactivate Awin rows the answer no longer contains (never Rakuten's —
 *     that network's memberships are not this API's to assert). Deactivation
 *     before feed ingest, so a revoked merchant's links stop reading `paid`
 *     on the same run that notices.
 *  3. Insert missing `catalog_merchants` rows with the default feed id
 *     (`retail-en_US`, the vertical-locale Awin's US retail feeds use), so a
 *     new approval starts feeding on the next run with no engineering.
 *     INSERT-ONLY (`ignoreDuplicates`): an operator's hand-set locale or a
 *     deliberate `active = false` must survive every future sync.
 */
async function syncJoinedProgrammes(
  admin: SupabaseClient<Database>,
  publisherId: string,
  token: string,
): Promise<{ joined: number; deactivated: number }> {
  const response = await fetch(
    `https://api.awin.com/publishers/${encodeURIComponent(publisherId)}/programmes?relationship=joined`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PROGRAMMES_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`programmes ${response.status}: ${body.slice(0, 200)}`);
  }

  const joined = parseJoinedProgrammes(await response.json());

  if (joined.length > 0) {
    const { error } = await admin.from('commerce_joined_programmes').upsert(
      joined.map((p) => ({
        network: 'awin',
        merchant_id: p.id,
        merchant_name: p.name,
        active: true,
      })),
      { onConflict: 'network,merchant_id' },
    );
    if (error) throw new Error(`programmes upsert failed: ${error.message}`);
  }

  // Ids are digits-only by the parser's own check, so the `in`-filter list is
  // safe to assemble. An empty answer deactivates every Awin row, which is
  // exactly what "Awin reports no memberships" has to mean.
  let deactivate = admin
    .from('commerce_joined_programmes')
    .update({ active: false }, { count: 'exact' })
    .eq('network', 'awin')
    .eq('active', true);
  if (joined.length > 0) {
    deactivate = deactivate.not('merchant_id', 'in', `(${joined.map((p) => p.id).join(',')})`);
  }
  const { count: deactivated, error: deactivateError } = await deactivate;
  if (deactivateError) {
    throw new Error(`programmes deactivate failed: ${deactivateError.message}`);
  }

  if (joined.length > 0) {
    const { error } = await admin.from('catalog_merchants').upsert(
      joined.map((p) => ({
        network: 'awin',
        external_id: p.id,
        name: p.name,
        feed_locale: 'retail-en_US',
      })),
      { onConflict: 'network,external_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(`catalog_merchants insert failed: ${error.message}`);
  }

  return { joined: joined.length, deactivated: deactivated ?? 0 };
}

/**
 * Stream one feed, line by line, upserting in batches.
 *
 * Streaming rather than `await response.text()`: a 200MB feed read into one
 * string is how an edge function dies without saying why. Returns the count so
 * the caller can record a truncation honestly.
 */
async function ingestFeed(
  admin: SupabaseClient<Database>,
  merchantId: string,
  url: string,
  token: string,
): Promise<{ written: number; truncated: boolean }> {
  // No Accept header. `application/jsonl` is not a registered media type and
  // Awin's server answers it with a bare 406 rather than ignoring it —
  // observed live 2026-08-25 on the first CICYBELL fetch; removing the header
  // is what fixed it. The `.jsonl` path extension already names the format.
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`feed ${response.status}: ${body.slice(0, 200)}`);
  }
  if (!response.body) throw new Error('feed returned no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let batch: ProductRow[] = [];
  let written = 0;
  let truncated = false;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await admin
      .from('catalog_products')
      .upsert(batch, { onConflict: 'merchant_id,external_id' });
    if (error) throw new Error(`upsert failed: ${error.message}`);
    written += batch.length;
    batch = [];
  };

  outer: for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const raw = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!raw) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // One malformed line is a bad row, not a bad feed.
        continue;
      }

      const row = rowFrom(merchantId, parsed);
      if (!row) continue;
      batch.push(row);

      if (batch.length >= BATCH) await flush();
      if (written + batch.length >= MAX_PRODUCTS_PER_MERCHANT) {
        truncated = true;
        await reader.cancel().catch(() => {});
        break outer;
      }
    }
  }

  await flush();
  return { written, truncated };
}

export default {
  async fetch(req: Request): Promise<Response> {
    const secret = Deno.env.get('FEED_SYNC_SECRET');
    if (!secret) {
      console.error('sync-feeds: FEED_SYNC_SECRET is not set — refusing to run');
      return Response.json({ error: 'not_configured' }, { status: 500 });
    }
    if (!constantTimeEqual(req.headers.get('x-cinch-feed-sync') ?? '', secret)) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const token = Deno.env.get('AWIN_API_TOKEN');
    const publisherId = Deno.env.get('AWIN_PUBLISHER_ID');
    if (!token || !publisherId) {
      console.error('sync-feeds: AWIN_API_TOKEN or AWIN_PUBLISHER_ID missing');
      return Response.json({ error: 'awin_not_configured' }, { status: 500 });
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    // Phase 0 first, so this run's feed list already reflects this run's
    // memberships. A failure here is reported and does NOT abort the feeds:
    // yesterday's joined list going one day stale is a smaller wrong than
    // skipping an ingest that was about to work.
    let programmes: { joined: number; deactivated: number } | { error: string };
    try {
      programmes = await syncJoinedProgrammes(admin, publisherId, token);
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`sync-feeds: joined-programmes sync failed: ${message}`);
      programmes = { error: message.slice(0, 200) };
    }

    const { data: merchants, error } = await admin
      .from('catalog_merchants')
      .select('id, external_id, name, feed_locale')
      .eq('network', 'awin')
      .eq('active', true);

    if (error) {
      console.error(`sync-feeds: cannot read merchants: ${error.message}`);
      return Response.json({ error: 'merchants_unreadable' }, { status: 503 });
    }

    const report: Array<Record<string, unknown>> = [];

    for (const [index, merchant] of (merchants ?? []).entries()) {
      // Awin's rate limit is per publisher, not per feed, so the gap goes
      // between merchants and not around each request.
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, FEED_GAP_MS));

      const locale = merchant.feed_locale ?? 'retail-en_US';
      const url =
        `https://api.awin.com/publishers/${encodeURIComponent(publisherId)}` +
        `/awinfeeds/download/${encodeURIComponent(merchant.external_id)}-${locale}.jsonl`;

      try {
        const { written, truncated } = await ingestFeed(admin, merchant.id, url, token);
        await admin
          .from('catalog_merchants')
          .update({
            synced_at: new Date().toISOString(),
            // A truncation is recorded in the same column an error would use,
            // because both mean "this catalogue is not the whole catalogue"
            // and the operator needs to see it either way.
            sync_error: truncated
              ? `truncated at ${MAX_PRODUCTS_PER_MERCHANT} products`
              : null,
          })
          .eq('id', merchant.id);
        report.push({ merchant: merchant.name, written, truncated });
      } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        // Named, not swallowed. A feed that has been failing for a week must
        // look different from a feed that has nothing new in it.
        console.error(`sync-feeds: ${merchant.name} (${merchant.external_id}) failed: ${message}`);
        await admin
          .from('catalog_merchants')
          .update({ synced_at: new Date().toISOString(), sync_error: message.slice(0, 500) })
          .eq('id', merchant.id);
        report.push({ merchant: merchant.name, error: message.slice(0, 200) });
      }
    }

    return Response.json({ programmes, merchants: report.length, report });
  },
};
