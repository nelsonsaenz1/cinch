import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { completeStructured, OpenRouterError } from '../_shared/openrouter.ts';
import {
  OUTFIT_SYSTEM_PROMPT,
  outfitSchema,
  type OutfitRerank,
} from '../_shared/outfit-schema.ts';
import {
  BoundsError,
  parseOutfitRequest,
  readBoundedJson,
  type ValidatedCandidate,
  type ValidatedOutfitRequest,
} from '../_shared/input-bounds.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

/**
 * generate-outfits — re-rank a shortlist and write the reasoning.
 *
 * The name is a slight misnomer inherited from the spec: this function does not
 * generate outfits. The on-device beam search does that, in about ten
 * milliseconds, and sends up its best dozen. This adds taste and language.
 *
 * Two consequences worth stating plainly, because they shaped the design:
 *
 *   - Outfit generation degrades rather than fails. If this function is down,
 *     rate-limited, or the user is offline, the client still has real, ranked,
 *     weather-appropriate outfits and falls back to the engine's own generated
 *     explanation. The AI layer is never silently mocked — the client shows an
 *     explicit "styling offline" state — but the feature keeps working.
 *
 *   - The model physically cannot hallucinate clothes. It returns ids drawn
 *     from a list, and anything unrecognised is dropped below.
 *
 * What the candidate cap never covered: the count of candidates was bounded but
 * nothing inside them was, so fourteen candidates could still carry unbounded
 * item names and notes straight into a prompt we pay for. Shape and size are now
 * both checked in `_shared/input-bounds.ts` before the provider is called.
 */

/** Text-only re-rank; the shared default is the right budget. */
const OUTFIT_TIMEOUT_MS = 30_000;

type Candidate = ValidatedCandidate;

const describeCandidate = (c: Candidate): string => {
  const pieces = c.items
    .map((i) => `${i.color} ${i.name}`.trim())
    .join(', ');
  const notes = c.notes.length ? ` [${c.notes.join('; ')}]` : '';
  return `${c.id}: ${pieces} (fit score ${Math.round(c.score * 100)})${notes}`;
};

const describeContext = (ctx: ValidatedOutfitRequest): string => {
  const lines: string[] = [];

  if (ctx.weather) {
    const w = ctx.weather;
    lines.push(
      `Weather${ctx.city ? ` in ${ctx.city}` : ''}: feels like ${Math.round(w.feelsLikeC)}°C, ` +
        `high ${Math.round(w.highC)}°, low ${Math.round(w.lowC)}°, ` +
        `${Math.round(w.precipitationChance * 100)}% chance of rain, wind ${Math.round(w.windKph)} km/h.`,
    );
  }

  if (ctx.events.length) {
    lines.push('Today:');
    for (const e of ctx.events) {
      lines.push(`  - ${e.startsAt} ${e.title} (formality ${e.formality}/5)`);
    }
  }

  if (ctx.note) lines.push(`The user says: "${ctx.note}"`);
  return lines.length ? lines.join('\n') : 'No context supplied.';
};

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return Response.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 });
      }

      let body: ValidatedOutfitRequest;
      try {
        body = parseOutfitRequest(await readBoundedJson(req));
      } catch (err) {
        if (err instanceof BoundsError) {
          return Response.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }

      const candidates = body.candidates;

      // `withSupabase` returns an untyped client, so every query result widens to
      // `never` and column names stop being checked at all. Casting once here
      // restores that — the generated Database types live beside this file
      // because Supabase bundles only supabase/functions/ on deploy, and
      // `npm run gen:types` regenerates both copies together so they cannot drift.
      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;
      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

      // ── AI processing consent, server-side. Same reasoning as tag-item: the
      //    rule is about what actually leaves the device. ─────────────────────
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

      const { data: config } = await admin
        .from('ai_config')
        .select('model_id, params, max_tokens, enabled, provider')
        .eq('workload', 'outfit_generation')
        .single();

      if (!config?.enabled) {
        return Response.json({ error: 'Styling is disabled.' }, { status: 503 });
      }

      // ── Daily allowance. Claimed after the free rejections above and before
      //    the provider, so a disabled workload never spends one. ────────────
      const quotaResponse = await enforceAiQuota(admin, userId, 'outfit_generation');
      if (quotaResponse) return quotaResponse;

      const count = body.count;
      const styleSummary = body.styleSummary.length
        ? `\n\nWhat you know about this person's taste, learned from their reactions:\n${body.styleSummary.map((s) => `  - They ${s}.`).join('\n')}`
        : '';

      const userPrompt = [
        describeContext(body),
        '',
        `Candidate outfits (each is a fixed set of clothes this person owns):`,
        ...candidates.map((c) => `  ${describeCandidate(c)}`),
        styleSummary,
        '',
        `Choose the ${count} best and explain each.`,
      ].join('\n');

      let picks: OutfitRerank | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;
      const startedAt = Date.now();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await completeStructured<OutfitRerank>({
            apiKey,
            model: config.model_id,
            messages: [
              { role: 'system', content: OUTFIT_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            schema: outfitSchema as unknown as Record<string, unknown>,
            schemaName: 'outfit_picks',
            maxTokens: config.max_tokens,
            params: (config.params ?? {}) as Record<string, unknown>,
            timeoutMs: OUTFIT_TIMEOUT_MS,
          });

          picks = result.parsed;
          promptTokens = result.promptTokens;
          completionTokens = result.completionTokens;
          costUsd = result.costUsd;
          latencyMs = result.latencyMs;
          failure = null;
          break;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
          // Wall clock across the failed attempts. The provider only reports
          // latency on a response, so failures used to be logged as 0 ms —
          // which read as instant and free, and they are neither.
          latencyMs = Date.now() - startedAt;
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      await admin.from('ai_calls').insert({
        user_id: userId,
        workload: 'outfit_generation',
        provider: config.provider,
        model_id: config.model_id,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: picks !== null,
        error: failure,
      });

      if (!picks) {
        // 200, not 5xx. The client has perfectly good outfits already — this is
        // a degraded response, not a failed request, and modelling it as an
        // error would push the client into a retry loop for no benefit.
        return Response.json({ ok: false, reason: 'styling_offline', error: failure });
      }

      // Drop anything that does not correspond to a real candidate. Strict
      // schemas constrain shape, not truthfulness, and a fabricated id would
      // otherwise surface as an outfit made of nothing.
      const valid = new Set(candidates.map((c) => c.id));
      const seen = new Set<string>();
      const cleaned = picks.picks.filter((p) => {
        if (!valid.has(p.candidateId) || seen.has(p.candidateId)) return false;
        seen.add(p.candidateId);
        return true;
      });

      if (!cleaned.length) {
        return Response.json({ ok: false, reason: 'styling_offline', error: 'No valid picks.' });
      }

      return Response.json({
        ok: true,
        picks: cleaned.slice(0, count),
        usage: { promptTokens, completionTokens, costUsd, latencyMs },
      });
    },
  ),
};
