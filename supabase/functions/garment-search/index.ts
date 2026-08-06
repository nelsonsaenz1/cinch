import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { OpenRouterError } from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';
import { parseGarmentSearchRequest } from './bounds.ts';
import { guardedFetch, UnsafeUrlError } from './net.ts';
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
 * TWO ACTIONS, ONE FUNCTION
 *
 *   search  costs a model call and a web search — quota'd, consent-gated.
 *   import  downloads the chosen image and creates the item — no model, no
 *           quota unit. Charging twice for one garment would be charging the
 *           user for changing their mind, and the expensive half already ran.
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
        return await importImage(db, admin, userId, request.imageUrl);
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
      await admin.from('ai_calls').insert({
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
 * Download the chosen product image and turn it into a closet item.
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
  const { data: item, error: insertError } = await db
    .from('items')
    .insert({ user_id: userId, status: 'pending_upload' })
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
