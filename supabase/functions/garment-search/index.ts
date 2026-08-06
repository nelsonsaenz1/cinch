import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { OpenRouterError } from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';
import { parseGarmentSearchRequest } from './bounds.ts';
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
 * THREE ACTIONS, ONE FUNCTION
 *
 *   search   costs a model call and a web search — quota'd, consent-gated.
 *   resolve  reads ONE page the user pasted and returns its og:image and
 *            og:title. No model, no web search — but it is the action that
 *            turns a user-supplied string into an outbound fetch, so it is
 *            quota'd too (see `resolveLink` for why, and at what cost).
 *   import   downloads the chosen image and creates the item — no model, no
 *            quota unit. Charging twice for one garment would be charging the
 *            user for changing their mind, and the expensive half already ran.
 *
 * `search` and `resolve` are the two doors into the same room. One is for
 * somebody who knows what the garment is called; the other is for somebody who
 * is already looking at it in a shop's app and can share the link. They meet at
 * `import`, which is the only code path that writes anything.
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
      // bypassed and the rule is about what actually leaves the device. Both
      // actions are gated, not just the search — the import exists only to
      // complete a search, and an item created here is tagged by a model
      // moments later.
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
