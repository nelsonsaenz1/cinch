import { withSupabase } from 'npm:@supabase/server@^1';

import {
  completeStructured,
  OpenRouterError,
  type ContentPart,
} from '../_shared/openrouter.ts';
import {
  normalizeTags,
  tagSchema,
  TAG_SYSTEM_PROMPT,
  type TagResult,
} from '../_shared/tag-schema.ts';

/**
 * tag-item — vision tagging for one garment.
 *
 * Invoked once per item by the client's upload queue at concurrency 3.
 * Deliberately NOT an orchestrator that fans out to itself: Supabase rate-limits
 * recursive Edge Function calls (outbound fetch between functions, March 2026),
 * so a "one call spawns 100" design gets throttled. The client drives the fan-out.
 *
 * Contract: this function must never lose an item. Every failure path leaves the
 * row present and marked `needs_review`, because a missing tag is recoverable in
 * the swipe deck and a missing garment is not.
 */

const BUCKET = 'garments';
/** Signed URL lifetime — only needs to outlive the model call. */
const SIGNED_URL_TTL_SECONDS = 300;

type Body = { itemId?: string };

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return Response.json(
          { error: 'OPENROUTER_API_KEY is not configured.' },
          { status: 500 },
        );
      }

      let body: Body;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
      }

      const itemId = body.itemId;
      if (!itemId) {
        return Response.json({ error: 'itemId is required.' }, { status: 400 });
      }

      const userId = ctx.userClaims?.sub as string | undefined;
      if (!userId) {
        return Response.json({ error: 'Not signed in.' }, { status: 401 });
      }

      // ── AI processing consent (App Store Guideline 5.1.2(i)) ──────────────
      // Checked server-side, not client-side. A client-side gate is trivially
      // bypassed, and the rule is about what actually leaves the device.
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      const { data: requiredVersion } = await ctx.supabaseAdmin.rpc(
        'current_ai_consent_version',
      );

      if (!profile?.ai_consent_version || profile.ai_consent_version < (requiredVersion ?? 1)) {
        return Response.json(
          { error: 'ai_consent_required', requiredVersion: requiredVersion ?? 1 },
          { status: 403 },
        );
      }

      // ── Load the item. `ctx.supabase` is RLS-scoped to the caller, so this
      //    also proves ownership without a manual user_id check. ─────────────
      const { data: item, error: itemError } = await ctx.supabase
        .from('items')
        .select('id, image_path, status')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return Response.json({ error: 'Item not found.' }, { status: 404 });
      }
      if (!item.image_path) {
        return Response.json({ error: 'Item has no image yet.' }, { status: 409 });
      }

      // ── Model config, read at call time so a model swap is a DB update ────
      const { data: config } = await ctx.supabaseAdmin
        .from('ai_config')
        .select('model_id, params, max_tokens, enabled, provider')
        .eq('workload', 'tagging')
        .single();

      if (!config?.enabled) {
        return Response.json({ error: 'Tagging is disabled.' }, { status: 503 });
      }

      // ── Signed URL for the image. The bucket is private, so the model needs a
      //    time-limited URL rather than a public one. ─────────────────────────
      const { data: signed, error: signError } = await ctx.supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(item.image_path, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed?.signedUrl) {
        return Response.json({ error: 'Could not read the image.' }, { status: 500 });
      }

      const content: ContentPart[] = [
        { type: 'image_url', image_url: { url: signed.signedUrl } },
        { type: 'text', text: 'Catalogue this garment.' },
      ];

      let tags: TagResult | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;

      // Two attempts. A retryable failure (429 / 5xx) is worth one more try;
      // anything else will fail identically and retrying only burns budget.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await completeStructured<TagResult>({
            apiKey,
            model: config.model_id,
            messages: [
              { role: 'system', content: TAG_SYSTEM_PROMPT },
              { role: 'user', content },
            ],
            schema: tagSchema as unknown as Record<string, unknown>,
            schemaName: 'garment_tags',
            maxTokens: config.max_tokens,
            params: (config.params ?? {}) as Record<string, unknown>,
          });

          tags = normalizeTags(result.parsed);
          promptTokens = result.promptTokens;
          completionTokens = result.completionTokens;
          costUsd = result.costUsd;
          latencyMs = result.latencyMs;
          failure = null;
          break;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      // ── Accounting. Written for both success and failure — a failed call still
      //    costs latency and sometimes tokens, and hiding that skews the model. ─
      await ctx.supabaseAdmin.from('ai_calls').insert({
        user_id: userId,
        workload: 'tagging',
        provider: config.provider,
        model_id: config.model_id,
        item_id: itemId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: tags !== null,
        error: failure,
      });

      // ── Failure: keep the item, badge it for review. Never lose an upload. ──
      if (!tags) {
        await ctx.supabase
          .from('items')
          .update({ status: 'needs_review' })
          .eq('id', itemId);

        return Response.json(
          { ok: false, status: 'needs_review', error: failure },
          { status: 200 },
        );
      }

      // ── Success ────────────────────────────────────────────────────────────
      const { error: updateError } = await ctx.supabase
        .from('items')
        .update({
          category: tags.category,
          subcategory: tags.subcategory,
          pattern: tags.pattern,
          material: tags.material,
          brand: tags.brand,
          formality_score: tags.formalityScore,
          warmth_score: tags.warmthScore,
          water_resistant: tags.waterResistant,
          // Feed the silhouette and print-mixing rules in the styling engine.
          fit: tags.fit,
          pattern_scale: tags.patternScale,
          seasons: tags.seasons,
          occasions: tags.occasions,
          description: tags.description,
          // Colour hex is extracted on-device from the actual pixels; the model
          // only supplies names. Stored as [{name}] and enriched client-side.
          colors: tags.colorNames.map((name) => ({ name })),
          ai_tags: tags,
          status: 'tagged',
        })
        .eq('id', itemId);

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }

      return Response.json({ ok: true, status: 'tagged', tags, costUsd });
    },
  ),
};
