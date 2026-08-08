import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { OpenRouterError } from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';
import {
  parseGarmentSearchRequest,
  type ValidatedAttachRequest,
  type ValidatedMatchRequest,
} from './bounds.ts';
import { assertSafeUrl, guardedFetch, UnsafeUrlError } from './net.ts';
import {
  extractImageUrl,
  extractTitle,
  hostLabel,
  PAGE_ACCEPT,
  PAGE_MAX_BYTES,
  PAGE_TIMEOUT_MS,
} from './page-meta.ts';
import { openRouterWebProvider } from './provider.ts';

/**
 * garment-search — "describe it, don't photograph it".
 *
 * The category's biggest failure is an empty closet: people install a wardrobe
 * app, are asked to photograph forty garments, photograph three, and never come
 * back. This endpoint is the other door. A user types "Reformation midi dress,
 * size 2, navy", optionally attaches a quick photo of the actual colour, and
 * picks their garment out of a handful of product images found on the web.
 *
 * FIVE ACTIONS, ONE FUNCTION
 *
 *   search   costs a model call and a web search — quota'd, consent-gated.
 *   resolve  reads ONE page the user pasted and returns its og:image and
 *            og:title. No model, no web search — but it is the action that
 *            turns a user-supplied string into an outbound fetch, so it is
 *            quota'd too (see `resolveLink` for why, and at what cost).
 *   import   downloads the chosen image and creates the item — no model, no
 *            quota unit. Charging twice for one garment would be charging the
 *            user for changing their mind, and the expensive half already ran.
 *   match    the same search, entered from the other side: the garment is
 *            already photographed and in the closet, and the question is who
 *            made it and where it is sold. The item's own picture and tags are
 *            the query. Costs a model call and a web search — quota'd and
 *            gated exactly like `search`, on the same workload.
 *   attach   the confirm step for `match`: downloads the chosen listing image
 *            and records it ON the existing item rather than creating one.
 *            No model, no quota unit — the same rule `import` lives by.
 *
 * `search` and `resolve` are the two doors into the same room. One is for
 * somebody who knows what the garment is called; the other is for somebody who
 * is already looking at it in a shop's app and can share the link. They meet at
 * `import`, which creates the item. `match` and `attach` are the same pair for
 * a garment that already exists — the search and its confirmation — except the
 * confirmation decorates a row instead of creating one.
 *
 * THE DOWNLOAD HAPPENS HERE, NEVER ON THE CLIENT. Three reasons, in order of
 * how quickly they bite: a retailer's CDN does not send CORS headers, so the
 * fetch simply fails; the client would have to carry URL-vetting code that
 * belongs on a server; and an image the app displays should come from our own
 * Storage bucket rather than a third party who can swap it later.
 *
 * The imported item lands at `pending_tag`, which is the same state a
 * photographed garment reaches after upload — so it flows into the existing
 * tagging sweep with no new pipeline. That is the point: this function adds a
 * front door, not a second house.
 */

const BUCKET = 'garments';

/** Signed URL lifetime for the item's own photograph — only needs to outlive
 *  the model call. Same figure tag-item uses, for the same reason. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The workload's own enum value, added by migration 20260806091000.
 *
 * The cast is deliberate and temporary: `ALTER TYPE … ADD VALUE` cannot be
 * *used* in the transaction that adds it, so the generated types (and any
 * `ai_config` row) follow the migration rather than travelling with it. Once
 * `npm run gen:types` runs against a migrated database the cast becomes a
 * no-op — remove it then.
 */
const WORKLOAD = 'garment_search' as Database['public']['Enums']['ai_workload'];

/**
 * Model used when `ai_config` has no row for this workload yet.
 *
 * Vision-capable on purpose — the optional colour swatch is an image part — and
 * the same model the tagging workload already vets for strict structured
 * outputs. An operator who wants a different one inserts an `ai_config` row and
 * this constant stops being read; no deploy involved, which is the whole reason
 * that table exists.
 */
const DEFAULT_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct';
const DEFAULT_MAX_TOKENS = 1_024;
const DEFAULT_PARAMS: Record<string, unknown> = { temperature: 0.2 };

/** Enough tiles to choose from, few enough to scan. Whering-sized grid. */
const MAX_CANDIDATES = 6;

/** Product photographs are hundreds of KB; ten megabytes is the abuse line. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;

/** Content types worth storing, and the extension each is saved under. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Does the payload actually start like the image it claims to be?
 *
 * `Content-Type` is chosen by whoever serves the file, so on its own it proves
 * nothing. A file stored as `original.jpg` and handed to the app through a
 * signed URL should be an image and not, say, a document — checking the first
 * bytes costs nothing and closes the gap between the label and the contents.
 */
function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return true;
  // WebP: "RIFF" ���� "WEBP"
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return riff && webp;
}

/** A stable code and a sentence a person can read. Never provider text. */
function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return fail('not_configured', 'Search is not available right now.', 500);
      }

      let request;
      try {
        request = parseGarmentSearchRequest(await readBoundedJson(req));
      } catch (err) {
        if (err instanceof BoundsError) {
          return fail('invalid_request', err.message, 400);
        }
        throw err;
      }

      // `withSupabase` returns an untyped client, so every query result widens
      // to `never` and column names stop being checked. Casting once here
      // restores that, exactly as tag-item does.
      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // ── AI processing consent (App Store Guideline 5.1.2(i)) ──────────────
      // Server-side, like every sibling: a client-side gate is trivially
      // bypassed and the rule is about what actually leaves the device. Every
      // action is gated, not just the searches — `import` and `attach` exist
      // only to complete one, and `match` sends the user's own photograph to a
      // model, which is precisely what the consent is about.
      const { data: profile } = await db
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      const { data: requiredVersion } = await admin.rpc('current_ai_consent_version');

      if (!profile?.ai_consent_version || profile.ai_consent_version < (requiredVersion ?? 1)) {
        return Response.json(
          { error: 'ai_consent_required', requiredVersion: requiredVersion ?? 1 },
          { status: 403 },
        );
      }

      if (request.action === 'import') {
        return await importImage(db, admin, userId, request.imageUrl, request.title);
      }

      if (request.action === 'resolve') {
        return await resolveLink(admin, userId, request.pageUrl);
      }

      if (request.action === 'attach') {
        return await attachListing(db, admin, userId, request);
      }

      if (request.action === 'match') {
        return await matchListing(db, admin, userId, apiKey, request);
      }

      // ── Model config, read at call time so a model swap is a DB update ────
      const { data: config } = await admin
        .from('ai_config')
        .select('model_id, params, max_tokens, enabled, provider')
        .eq('workload', WORKLOAD)
        .maybeSingle();

      // `maybeSingle` and a fallback rather than a hard requirement: the row
      // cannot be seeded by the same migration that creates the enum value, so
      // "no row" is the normal state on the day this ships and must mean
      // "defaults", not "broken". An explicit `enabled = false` is still a
      // kill switch.
      if (config && !config.enabled) {
        return fail('search_disabled', 'Search is turned off right now.', 503);
      }

      // ── Allowance, claimed after the kill switch, before the provider ─────
      // `claim_ai_quota` does not refund (a refund path is a free retry loop),
      // so a unit must not be spent on a request that was never going to reach
      // the model. The two other AI functions order it the same way.
      const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
      if (quotaResponse) return quotaResponse;

      const provider = openRouterWebProvider({
        apiKey,
        model: config?.model_id ?? DEFAULT_MODEL,
        maxTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
        params: (config?.params ?? DEFAULT_PARAMS) as Record<string, unknown>,
      });

      let result: Awaited<ReturnType<typeof provider.search>> | null = null;
      let failure: string | null = null;

      try {
        result = await provider.search({
          description: request.description,
          swatchDataUrl: request.swatchDataUrl,
          maxCandidates: MAX_CANDIDATES,
        });
      } catch (err) {
        // `OpenRouterError` messages are already URL-redacted; they go to the
        // accounting table for whoever is debugging cost, and never to the
        // client, which gets a code and a sentence.
        failure = err instanceof Error ? err.message : String(err);
      }

      // ── Accounting. Written for failures too: a failed search still costs a
      //    web-search charge and sometimes tokens, and hiding that skews every
      //    later decision about whether this feature pays for itself. ────────
      await recordAiCall(admin, {
        user_id: userId,
        workload: WORKLOAD,
        provider: config?.provider ?? provider.id,
        model_id: config?.model_id ?? DEFAULT_MODEL,
        prompt_tokens: result?.promptTokens ?? null,
        completion_tokens: result?.completionTokens ?? null,
        cost_usd: result?.costUsd ?? null,
        latency_ms: result?.latencyMs ?? null,
        succeeded: result !== null,
        error: failure,
      });

      if (!result) {
        return fail('search_failed', 'The search did not come back. Try again in a moment.', 502);
      }

      return Response.json({ ok: true, candidates: result.candidates });
    },
  ),
};

/**
 * The sentence for a page we reached and could not read.
 *
 * It names the real cause — no picture we could find — and gives the way
 * forward that always works, because a great many retailers render their
 * product pages in JavaScript and there is no honest way to promise otherwise
 * from inside an Edge Function with an eight-second budget and no browser.
 */
const UNREADABLE_MESSAGE =
  "Cinch couldn't find the picture on that page — photograph the item instead.";

/**
 * Turn a pasted product link into a preview: one picture, one name, one shop.
 *
 * WHY THIS IS A SEPARATE ROUND TRIP AND NOT PART OF `import`. The user pasted a
 * URL, not a garment. Between the paste and the closet there has to be a moment
 * where they see what Cinch actually found and can say no — retailer links are
 * shared from apps, carry tracking parameters, and sometimes point at a
 * category page rather than the dress. Adding the wrong item silently and
 * asking them to go delete it is the version of this feature nobody comes back
 * to. So: resolve returns, the sheet shows, the person confirms, `import`
 * writes.
 *
 * WHY A QUOTA UNIT, WHEN THERE IS NO MODEL CALL HERE. This action is the one
 * place in the app where a string a user typed becomes an outbound HTTP request
 * from inside Supabase's network. `net.ts` bounds WHERE that request may go and
 * HOW BIG the answer may be; nothing bounded HOW MANY, and an authenticated
 * script looping this is a page-fetching proxy with our name on the user agent.
 * `garment_search` is the allowance that already exists, is already monthly, and
 * is already sized to the onboarding burst this feature serves — 20 on free.
 *
 * It is an over-charge and worth saying so plainly: a link resolve costs us
 * about nothing, where a described search costs ~$0.008 in web search. The
 * honest fix is a separate, much larger `link_import` counter, which needs a
 * migration deployed ahead of the function. Until then this errs toward the
 * bound that exists rather than shipping an unbounded fetch primitive.
 *
 * A failed resolve still spends the unit, exactly as a failed search does —
 * `claim_ai_quota` has no refund path on purpose (see `_shared/quota.ts`), since
 * a refund is a free retry loop for anyone willing to provoke failures.
 */
async function resolveLink(
  admin: SupabaseClient<Database>,
  userId: string,
  pageUrl: string,
): Promise<Response> {
  const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
  if (quotaResponse) return quotaResponse;

  const started = Date.now();

  /** One accounting row per unit spent, so quota and `ai_calls` reconcile. */
  const record = async (succeeded: boolean, error: string | null) => {
    await admin.from('ai_calls').insert({
      user_id: userId,
      workload: WORKLOAD,
      // Not a model and not pretending to be one. This row exists so "how many
      // garment_search units went to links" is answerable in SQL.
      provider: 'link-import',
      model_id: 'none',
      cost_usd: 0,
      latency_ms: Date.now() - started,
      succeeded,
      error,
    });
  };

  let page;
  try {
    page = await guardedFetch(pageUrl, {
      accept: PAGE_ACCEPT,
      maxBytes: PAGE_MAX_BYTES,
      timeoutMs: PAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      await record(false, `unsafe: ${err.message}`);
      // Deliberately one message for every reason the guard refuses — "not
      // https", "private address", "too many redirects", "too large". Which
      // one it was is only useful to somebody probing the guard.
      return fail(
        'link_rejected',
        "Cinch can't open that link. Paste the product page from the shop's own site.",
        400,
      );
    }
    await record(false, 'unreachable');
    return fail(
      'link_unreachable',
      "That page didn't answer. Check the link, or photograph the item instead.",
      502,
    );
  }

  if (page.status !== 200) {
    await record(false, `status ${page.status}`);
    return fail(
      'link_unreachable',
      "That page didn't answer. Check the link, or photograph the item instead.",
      502,
    );
  }

  const contentType = page.contentType.split(';')[0].trim();

  // Someone who long-pressed a product photograph and copied the image address
  // has already done the extraction by hand. Handing that straight to the
  // preview is a better answer than telling them their link isn't a page.
  if (contentType.startsWith('image/')) {
    await record(true, null);
    return Response.json({
      ok: true,
      imageUrl: page.url.toString(),
      title: null,
      source: hostLabel(page.url),
    });
  }

  if (!contentType.includes('html')) {
    await record(false, `content-type ${contentType || 'unknown'}`);
    return fail(
      'link_not_a_page',
      "That link isn't a product page. Open the item on the shop's site and copy that link.",
      415,
    );
  }

  // `fatal: false` because a retailer serving a mislabelled encoding should cost
  // us a few replacement characters in a title, never the whole import.
  const html = new TextDecoder('utf-8', { fatal: false }).decode(page.body);

  const imageUrl = extractImageUrl(html, page.url);
  if (!imageUrl) {
    await record(false, 'no image on page');
    return fail('link_no_image', UNREADABLE_MESSAGE, 422);
  }

  // Vetted now so a preview that could never be imported is never shown. The
  // import re-checks, because that is the call that downloads bytes.
  try {
    assertSafeUrl(imageUrl);
  } catch {
    await record(false, 'image url unsafe');
    return fail('link_no_image', UNREADABLE_MESSAGE, 422);
  }

  await record(true, null);

  return Response.json({
    ok: true,
    imageUrl,
    // May be null. The client offers its own field rather than inventing a name.
    title: extractTitle(html, page.url),
    source: hostLabel(page.url),
  });
}

/**
 * Download the chosen product image and turn it into a closet item.
 *
 * The single write path, reached from both doors: a tapped candidate tile and a
 * confirmed link preview arrive here with the same three facts.
 *
 * ORDER MATTERS. The download runs BEFORE the row is created, so a blocked CDN
 * or an oversized file leaves nothing behind. The row is created second, which
 * is also where the closet-size trigger gets its say, and the object is written
 * third under the `{user_id}/{item_id}/` prefix the bucket policy authorizes on.
 * A failure after the row exists deletes it — an item with no image is a tile
 * the closet cannot render and a slot the user's plan is charged for.
 */
async function importImage(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  imageUrl: string,
  title?: string,
): Promise<Response> {
  let downloaded;
  try {
    downloaded = await guardedFetch(imageUrl, {
      accept: 'image/*',
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
    }
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  if (downloaded.status !== 200) {
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  // `image/jpeg; charset=binary` is a real header in the wild.
  const contentType = downloaded.contentType.split(';')[0].trim();
  const extension = IMAGE_EXTENSIONS[contentType];
  if (!extension || !looksLikeImage(downloaded.body)) {
    return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  // ── The row. RLS scopes `db` to the caller, so `user_id` cannot be spoofed,
  //    and `items_enforce_limit` refuses the insert when the plan is full. ───
  // `description` carries the product name because there is no `items.name`
  // column to carry it — the app derives a garment's title from its colour and
  // subcategory (`features/closet/item-name.ts`), which are tags, and an
  // untagged import has neither yet. So the words the user confirmed are what
  // identifies the piece in the window before tagging lands, and they are what
  // survives if tagging never does: `tag-item` writes `description` only on
  // SUCCESS, so a `needs_review` garment keeps "Reformation Gemma Dress"
  // instead of showing up blank.
  //
  // Stated plainly because it is a real limit: a SUCCESSFUL tag overwrites this
  // with the model's own description. Making a user's typed name outlive that
  // needs either a column or a change in `tag-item`, both outside this file.
  const { data: item, error: insertError } = await db
    .from('items')
    .insert({ user_id: userId, status: 'pending_upload', description: title ?? null })
    .select('id')
    .single();

  if (insertError || !item) {
    // The trigger raises `closet_limit_reached: N of M garments`. Recognising it
    // is what lets the client offer an upgrade instead of an apology.
    if (insertError?.message?.includes('closet_limit_reached')) {
      return fail('closet_limit_reached', 'Your closet is full on this plan.', 402);
    }
    return fail('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  const path = `${userId}/${item.id}/original.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, downloaded.body, { contentType, upsert: true });

  if (uploadError) {
    await db.from('items').delete().eq('id', item.id);
    return fail('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  // `thumb_path` points at the same object rather than a resize. There is no
  // image pipeline in an Edge Function, and Supabase's own transformations are
  // Pro-only and bill per origin image — the reason the client generates
  // thumbnails on-device. A product photograph is already small; pointing at
  // the original is honest, where a null would leave the grid with a hole.
  const { error: updateError } = await db
    .from('items')
    .update({ image_path: path, thumb_path: path, status: 'pending_tag' })
    .eq('id', item.id);

  if (updateError) {
    await db.from('items').delete().eq('id', item.id);
    return fail('import_failed', "That garment couldn't be added. Try again.", 500);
  }

  // Deliberately does NOT call tag-item: Supabase rate-limits Edge Functions
  // calling each other, and the client's own sweep already drives `pending_tag`
  // rows through tagging. Same pipeline as a photographed garment, from here on.
  return Response.json({ ok: true, itemId: item.id, status: 'pending_tag' });
}

/** The columns `match` reads. A pick so a renamed column fails the compile
 *  here, at the one place that depends on it. */
type MatchableItem = Pick<
  Database['public']['Tables']['items']['Row'],
  'category' | 'subcategory' | 'colors' | 'brand' | 'ai_tags' | 'description'
>;

/**
 * One line of what the closet already knows about a garment.
 *
 * The tags were written by `tag-item` and the columns are its output, so the
 * shapes here mirror what that function stores: `colors` is `[{ name }]`, and
 * `ai_tags` is the whole `TagResult` object, read defensively because a row
 * that predates a schema change is still a row somebody wants matched. The
 * photograph is the ground truth; this line only tells the model which words
 * to search with.
 */
function describeItem(item: MatchableItem): string {
  const tags =
    typeof item.ai_tags === 'object' && item.ai_tags !== null && !Array.isArray(item.ai_tags)
      ? (item.ai_tags as Record<string, unknown>)
      : {};

  const colorNames = (Array.isArray(item.colors) ? item.colors : [])
    .map((entry) =>
      typeof entry === 'object' && entry !== null && !Array.isArray(entry) &&
        typeof (entry as { name?: unknown }).name === 'string'
        ? (entry as { name: string }).name
        : null,
    )
    .filter((name): name is string => name !== null);

  const pattern = typeof tags.pattern === 'string' ? tags.pattern : null;
  const material = typeof tags.material === 'string' ? tags.material : null;

  const line = [
    item.brand,
    colorNames.slice(0, 3).join(' and '),
    material,
    // "solid" is the absence of a pattern; searching for it finds nothing.
    pattern && pattern !== 'solid' ? pattern : null,
    item.subcategory ?? item.category,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  // The model's own sentence about the garment beats a user-typed title here,
  // because it was written from the same photograph the model is about to see.
  const description =
    typeof tags.description === 'string' && tags.description ? tags.description : item.description;

  const full = description ? `${line}. ${description}` : line;
  // A belt against a description column edited by hand: the descriptor is
  // prompt text billed by the token, and 500 characters says everything a
  // search query can use.
  return full.slice(0, 500);
}

/**
 * Find listings for a garment the user already photographed.
 *
 * `search` starts from words because no photograph exists yet; this starts from
 * the photograph because one does. The item's picture — the cutout when the
 * background has been removed, since a clean silhouette is the best evidence,
 * else the thumb, else the original — is signed for just long enough to show
 * the model, and the tags become the search terms.
 *
 * The optional `brand` narrows the hunt to one maker's listings. Its ABSENCE is
 * the near-identical fallback, not a degraded mode: the model proposes up to
 * five brands from the photograph and returns lookalike listings unscoped, and
 * the client can re-run with one of those brands if the user confirms a guess.
 * One action, one quota unit either way.
 *
 * Loaded through the RLS-scoped client, so another user's item id is
 * indistinguishable from a missing one — a 404 either way, which is the honest
 * answer and leaks nothing.
 */
async function matchListing(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  apiKey: string,
  request: ValidatedMatchRequest,
): Promise<Response> {
  const { data: item } = await db
    .from('items')
    .select('id, category, subcategory, colors, brand, ai_tags, description, cutout_path, thumb_path, image_path')
    .eq('id', request.itemId)
    .maybeSingle();

  if (!item) {
    return fail('item_not_found', "That garment isn't in your closet.", 404);
  }

  const imagePath = item.cutout_path ?? item.thumb_path ?? item.image_path;
  if (!imagePath) {
    return fail('item_no_image', "That garment doesn't have a photo yet.", 409);
  }

  // ── Model config, read at call time so a model swap is a DB update ────────
  // Same workload as `search`: matching is searching, entered from a
  // photograph, and splitting the counter would let one door drain what the
  // other advertises.
  const { data: config } = await admin
    .from('ai_config')
    .select('model_id, params, max_tokens, enabled, provider')
    .eq('workload', WORKLOAD)
    .maybeSingle();

  if (config && !config.enabled) {
    return fail('search_disabled', 'Search is turned off right now.', 503);
  }

  // The signed URL comes before the quota claim on purpose: `claim_ai_quota`
  // does not refund, and an unreadable image would otherwise burn a unit on a
  // request that was never going to reach the model. tag-item orders these the
  // same way, for the same reason.
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return fail('item_image_unreadable', "That garment's photo couldn't be read.", 500);
  }

  const quotaResponse = await enforceAiQuota(admin, userId, 'garment_search');
  if (quotaResponse) return quotaResponse;

  const provider = openRouterWebProvider({
    apiKey,
    model: config?.model_id ?? DEFAULT_MODEL,
    maxTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
    params: (config?.params ?? DEFAULT_PARAMS) as Record<string, unknown>,
  });

  let result: Awaited<ReturnType<typeof provider.match>> | null = null;
  let failure: string | null = null;

  try {
    result = await provider.match({
      descriptor: describeItem(item),
      photoUrl: signed.signedUrl,
      brand: request.brand,
      maxCandidates: MAX_CANDIDATES,
    });
  } catch (err) {
    // `OpenRouterError` messages are already URL-redacted; they go to the
    // accounting table for whoever is debugging cost, and never to the
    // client, which gets a code and a sentence.
    failure = err instanceof Error ? err.message : String(err);
  }

  // ── Accounting. Written for failures too, exactly as the search records
  //    its own — a failed match still costs a web-search charge. ────────────
  await recordAiCall(admin, {
    user_id: userId,
    workload: WORKLOAD,
    provider: config?.provider ?? provider.id,
    model_id: config?.model_id ?? DEFAULT_MODEL,
    prompt_tokens: result?.promptTokens ?? null,
    completion_tokens: result?.completionTokens ?? null,
    cost_usd: result?.costUsd ?? null,
    latency_ms: result?.latencyMs ?? null,
    succeeded: result !== null,
    error: failure,
  });

  if (!result) {
    return fail('match_failed', 'The search did not come back. Try again in a moment.', 502);
  }

  return Response.json({
    ok: true,
    brands: result.brands,
    // Confidence stays server-side — it ordered the list, and that is its job.
    // `pageUrl` rides along because `attach` needs it back.
    candidates: result.candidates.map(({ title, imageUrl, pageUrl, source }) => ({
      title,
      imageUrl,
      pageUrl,
      source,
    })),
  });
}

/**
 * The confirm step for `match`: pin the chosen listing to the existing item.
 *
 * `import` creates a garment; this decorates one the user already owns, so
 * nothing here touches `status` or the tagging pipeline — the item keeps
 * whatever life it had, plus a listing photograph and a provenance line.
 *
 * NO QUOTA UNIT, for the same reason `import` charges none: the expensive half
 * (the match) already ran, and charging the confirmation would be charging the
 * user for making up their mind. The outbound fetch is not the unbounded
 * primitive `resolve` worries about, because it can only follow a `match` the
 * user already paid a unit for.
 *
 * The object lives under a `listing/` segment of the item's own prefix, at a
 * fixed filename, so re-confirming a different listing overwrites rather than
 * accumulates. The one wrinkle is the extension: a jpg replaced by a png lands
 * at a sibling path, so the previous object is removed best-effort — an
 * orphaned image in a private bucket is a few wasted kilobytes, never worth
 * failing a confirmation the user watched succeed.
 */
async function attachListing(
  db: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  request: ValidatedAttachRequest,
): Promise<Response> {
  // Ownership through RLS, before any bytes move: another user's item id reads
  // as missing, and a 404 up front beats discovering it after a download.
  const { data: item } = await db
    .from('items')
    .select('id, listing_path')
    .eq('id', request.itemId)
    .maybeSingle();

  if (!item) {
    return fail('item_not_found', "That garment isn't in your closet.", 404);
  }

  // The page URL is stored, not fetched — but a stored URL the app will render
  // as a tappable link deserves the same vetting as one we would fetch.
  let page: URL;
  try {
    page = assertSafeUrl(request.pageUrl);
  } catch {
    return fail(
      'link_rejected',
      "Cinch can't open that link. Paste the product page from the shop's own site.",
      400,
    );
  }

  // Same limits as `import`, because it is the same job: `guardedFetch`
  // re-vets the image URL itself, every redirect included.
  let downloaded;
  try {
    downloaded = await guardedFetch(request.imageUrl, {
      accept: 'image/*',
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: IMAGE_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
    }
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  if (downloaded.status !== 200) {
    return fail('image_unreachable', "That picture couldn't be reached. Try another one.", 502);
  }

  // `image/jpeg; charset=binary` is a real header in the wild.
  const contentType = downloaded.contentType.split(';')[0].trim();
  const extension = IMAGE_EXTENSIONS[contentType];
  if (!extension || !looksLikeImage(downloaded.body)) {
    return fail('image_rejected', "That picture couldn't be saved. Try another one.", 400);
  }

  // Inside the `{user_id}/{item_id}/` prefix the bucket policy authorizes on,
  // one level down so a listing can never collide with the garment's own
  // photographs. `upsert` is what makes re-confirmation an overwrite.
  const path = `${userId}/${request.itemId}/listing/original.${extension}`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, downloaded.body, { contentType, upsert: true });

  if (uploadError) {
    return fail('attach_failed', "That listing couldn't be saved. Try again.", 500);
  }

  const confirmedAt = new Date().toISOString();

  // The select-back is the guard: an RLS-refused update is a silent no-op, and
  // a confirmation that "succeeded" without writing anything is exactly the
  // kind of auth bug that hides for months. Zero rows back means fail loudly.
  const { data: updated, error: updateError } = await db
    .from('items')
    .update({
      listing_path: path,
      // The vetted, parsed form — normalized by the URL parser, not the raw
      // string off the wire.
      listing_source_url: page.toString(),
      listing_source_label: hostLabel(page),
      listing_confirmed_at: confirmedAt,
    })
    .eq('id', request.itemId)
    .select('id');

  if (updateError || !updated || updated.length !== 1) {
    // The row still points wherever it pointed before, so a freshly-written
    // object at a NEW path is litter — remove it. At the SAME path the old
    // bytes are already gone and the row is still consistent; nothing to undo.
    if (item.listing_path !== path) {
      await admin.storage.from(BUCKET).remove([path]);
    }
    return fail('attach_failed', "That listing couldn't be saved. Try again.", 500);
  }

  // Best-effort, after the row is safely updated: a previous listing at a
  // different extension is now unreachable and merely costs storage.
  if (item.listing_path && item.listing_path !== path) {
    await admin.storage.from(BUCKET).remove([item.listing_path]);
  }

  return Response.json({
    ok: true,
    itemId: request.itemId,
    listingPath: path,
    source: hostLabel(page),
    confirmedAt,
  });
}
