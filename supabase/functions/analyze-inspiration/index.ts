import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { loadAiSettings } from '../_shared/ai-config.ts';
import {
  INSPIRATION_SYSTEM_PROMPT,
  inspirationSchema,
  normalizeInspiration,
  type InspirationResult,
} from '../_shared/inspiration-schema.ts';
import { BoundsError, parseInspirationRequest, readBoundedJson } from '../_shared/input-bounds.ts';
import {
  completeStructured,
  OpenRouterError,
  type ContentPart,
} from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

/**
 * analyze-inspiration — vision analysis of one saved outfit photograph, for
 * "Recreate this look".
 *
 * The model reads the photograph into structured pieces and NOTHING else: it
 * never sees the closet, so it cannot recommend a garment, and the matching
 * against what the user actually owns is arithmetic that runs on the device
 * (`src/features/recreate/match.ts`). Same economics argument as the outfit
 * re-ranker — no closet dump up the wire, no way to hallucinate ownership.
 *
 * Statelessness is deliberate. Nothing about the analysis is persisted here:
 * the photograph is the user's own Storage object (uploaded by the client to
 * their folder, retained or deleted by them), the pieces go back down in the
 * response, and a recreated outfit only touches the database if the user
 * SAVES it — a plain owner-RLS `outfits` insert the client makes itself.
 *
 * Cost discipline is tag-item's, in tag-item's order: bounded input, an
 * ownership check that costs nothing, the kill switch, a signable image, and
 * the allowance claimed LAST — `claim_ai_quota` does not refund, so a unit
 * must never be burnt by a request that was going to fail anyway.
 */

const BUCKET = 'garments';
/** Only needs to outlive the model call. */
const SIGNED_URL_TTL_SECONDS = 300;
/** Vision with a fetched image — tag-item's ceiling, for tag-item's reason. */
const ANALYZE_TIMEOUT_MS = 45_000;

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

      let path: string;
      try {
        ({ path } = parseInspirationRequest(await readBoundedJson(req)));
      } catch (err) {
        if (err instanceof BoundsError) {
          return Response.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      const userId = ctx.userClaims?.id;
      if (!userId) {
        return Response.json({ error: 'Not signed in.' }, { status: 401 });
      }

      // ── Ownership. The bucket's RLS scopes objects by first path segment;
      //    the admin client signs anything, so the same rule is asserted here
      //    before a URL exists. The `inspiration/` segment keeps this endpoint
      //    off garment originals — those already have tag-item, and an
      //    endpoint that analyses any object in the folder is an endpoint
      //    that re-analyses a whole closet one call at a time. ───────────────
      if (!path.startsWith(`${userId}/inspiration/`)) {
        return Response.json({ error: 'Not your photograph.' }, { status: 403 });
      }

      // ── AI processing consent (5.1.2(i)) — server-side, as everywhere. ────
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

      // ── Model config. Its own workload row when the operator writes one;
      //    the TAGGING row's model otherwise, because that is the proven
      //    vision model this deployment already pays for, and a brand-new
      //    workload with no configured row must not be a dead endpoint. ──────
      const { data: taggingRow } = await admin
        .from('ai_config')
        .select('model_id, params, max_tokens, provider, enabled')
        .eq('workload', 'tagging')
        .single();

      const settings = await loadAiSettings(admin, 'inspiration', {
        modelId: taggingRow?.model_id ?? '',
        maxTokens: taggingRow?.max_tokens ?? 1024,
        timeoutMs: ANALYZE_TIMEOUT_MS,
        provider: taggingRow?.provider ?? 'openrouter',
        params: (taggingRow?.params ?? {}) as Record<string, unknown>,
      });

      // Either kill switch stops spend: the workload's own, or tagging's when
      // tagging is what supplies the model.
      if (!settings.enabled || (!settings.configured && !taggingRow?.enabled)) {
        return Response.json({ error: 'Inspiration analysis is disabled.' }, { status: 503 });
      }
      if (!settings.modelId) {
        return Response.json({ error: 'No vision model is configured.' }, { status: 503 });
      }

      // ── Signed URL — the image must prove readable before a unit is spent.
      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed?.signedUrl) {
        return Response.json({ error: 'Could not read the photograph.' }, { status: 404 });
      }

      // ── Allowance, claimed LAST. ──────────────────────────────────────────
      const quotaResponse = await enforceAiQuota(admin, userId, 'inspiration');
      if (quotaResponse) return quotaResponse;

      const content: ContentPart[] = [
        { type: 'image_url', image_url: { url: signed.signedUrl } },
        { type: 'text', text: 'Break this outfit into its pieces.' },
      ];

      let result: InspirationResult | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;
      let attemptsMade = 0;
      const startedAt = Date.now();

      // Two attempts, tag-item's rule: a 429/5xx earns one more try, anything
      // else fails identically and retrying only burns budget.
      for (let attempt = 0; attempt < 2; attempt++) {
        attemptsMade = attempt + 1;
        try {
          const call = await completeStructured<InspirationResult>({
            apiKey,
            model: settings.modelId,
            messages: [
              { role: 'system', content: INSPIRATION_SYSTEM_PROMPT },
              { role: 'user', content },
            ],
            schema: inspirationSchema as unknown as Record<string, unknown>,
            schemaName: 'inspiration_pieces',
            maxTokens: settings.maxTokens,
            params: settings.params,
            timeoutMs: settings.timeoutMs,
          });

          promptTokens = call.promptTokens;
          completionTokens = call.completionTokens;
          costUsd = call.costUsd;
          latencyMs = call.latencyMs;
          result = normalizeInspiration(call.parsed);
          failure = null;
          break;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
          latencyMs = Date.now() - startedAt;
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      // ── Accounting, success or not — a failed call still cost money. ──────
      await recordAiCall(admin, {
        user_id: userId,
        workload: 'inspiration',
        provider: settings.provider,
        model_id: settings.modelId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: result !== null,
        attempts: attemptsMade,
        error: failure,
      });

      if (!result) {
        return Response.json(
          { error: 'Could not read the outfit. Try a clearer photograph.', detail: failure },
          { status: 502 },
        );
      }

      // An empty read is a real answer — a photo with no discernible clothes
      // in it — and the client words it; a 200 with zero pieces is honest.
      return Response.json({ ok: true, pieces: result.pieces });
    },
  ),
};
