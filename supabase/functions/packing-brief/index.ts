import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { recordAiCall } from '../_shared/ai-calls.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { completeStructured, OpenRouterError } from '../_shared/openrouter.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

import { parsePackingRequest, type ValidatedPackingRequest } from './bounds.ts';
import { packingSchema, PACKING_SYSTEM_PROMPT, type PackingResult } from './schema.ts';

/**
 * packing-brief — read a destination, pack it from a real closet.
 *
 * The trip questionnaire on the Plan tab collects five answers; this turns them
 * into a brief. What the model contributes is knowledge of a place — how warm,
 * how dressed-up, what people there actually wear — and a shortlist of garments
 * per part of the day, drawn from ids it was handed. It cannot pack a coat the
 * user does not own: unrecognised ids are dropped below, the same guarantee
 * `generate-outfits` and `stylist-chat` make.
 *
 * NO NEW VENDOR AND NO NEW KEY. This calls OpenRouter through the same shared
 * client and the same credential as every other workload. "Research the
 * destination" is the model's own knowledge, stated plainly and hedged where it
 * should be — not a live web lookup, and the prompt forbids claiming otherwise.
 *
 * WHY IT SPENDS THE `stylist_chat` ALLOWANCE
 *
 * `ai_workload` is a Postgres enum and `claim_ai_quota` takes one of its
 * values, so a workload of its own is a migration plus an `ai_config` row plus
 * a `PLAN_LIMITS` entry — three files this change does not own. Rather than
 * ship unmetered (the one thing `_shared/plans.ts` exists to prevent) it claims
 * the stylist's allowance, which is the right shape for a second reason:
 *
 *   free is EXCLUDED from `stylist_chat`, not merely rationed.
 *
 * So a free account gets 402 `plan_upgrade_required` here, independently of the
 * client-side gate in `features/plan/use-packing-access.ts`. The app fails
 * closed and the server fails closed, for different reasons, which is what
 * makes the membership boundary a boundary rather than a screen.
 *
 * The cost of that choice is honest and worth writing down: a Standard user's
 * 30 monthly stylist messages are the same 30 a packing brief spends from, and
 * `ai_calls` rows for this endpoint are labelled `stylist_chat`. When packing
 * earns its own budget, add the enum value, the config row and the limits, and
 * change the two constants below.
 */

/** Text-only, but a longer output than a chat turn: five sections, not two. */
const PACKING_TIMEOUT_MS = 30_000;

/** See the docblock. Both constants move together when packing gets its own. */
const WORKLOAD = 'stylist_chat' as Database['public']['Enums']['ai_workload'];
const QUOTA_KIND = 'stylist_chat' as const;

/**
 * Used only when `ai_config` has no row for this workload.
 *
 * There is one for `stylist_chat` today (`z-ai/glm-5.2`, seeded by migration
 * 20260803183000), so this is a floor rather than a default — but `maybeSingle`
 * plus a fallback is what keeps "no row" meaning defaults instead of broken,
 * which is the state this function starts in the day packing gets a workload of
 * its own. Same model as the stylist deliberately: this is the stylist's voice
 * on a longer question, and it is already vetted for strict structured output.
 */
const DEFAULT_MODEL = 'z-ai/glm-5.2';
const DEFAULT_MAX_TOKENS = 2_048;
const DEFAULT_PARAMS: Record<string, unknown> = { temperature: 0.8 };

/** Enough to dress a part of the day; few enough to read as a packed set. */
const MAX_PICKS_PER_PART = 6;
/** The spec line is a caption, not a paragraph. */
const MAX_SPEC_FRAGMENTS = 4;

/** A stable code and a sentence a person can read. Never provider text. */
function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

/** The prompt, assembled in the order the model should read it. */
function buildPrompt(body: ValidatedPackingRequest): string {
  const { trip } = body;
  const parts: string[] = [];

  const where = [trip.destination, trip.country].filter(Boolean).join(', ');
  const tripLines = [
    `  destination: ${where}`,
    `  month: ${trip.month || 'unspecified'}`,
    `  length: ${trip.days} days`,
    `  travelling: ${trip.companionsLabel || trip.companions}`,
    `  kind of trip: ${trip.vibeLabel || trip.vibe}`,
    `  parts of the day to dress: ${trip.parts.join(', ')}`,
  ];
  parts.push(`THE TRIP\n${tripLines.join('\n')}`);

  // Real weather outranks the model's sense of the month, and the prompt says
  // so in as many words — a warm September in a cold year is still cold.
  if (body.forecast) {
    const f = body.forecast;
    parts.push(
      `FORECAST FOR THOSE DATES (prefer this over your sense of the season)\n` +
        `  ${Math.round(f.lowC)}° to ${Math.round(f.highC)}° apparent, ` +
        `${f.rainDays} of ${trip.days} days with rain likely.`,
    );
  } else {
    parts.push(
      'No forecast was available for these dates. Say what the month is usually like, and do not pretend to know the weather.',
    );
  }

  if (body.digest) parts.push(`THEIR CLOSET, IN SHAPE\n${body.digest}`);

  if (body.styleSummary.length) {
    parts.push(
      `WHAT YOU KNOW ABOUT THEIR TASTE\n${body.styleSummary.map((s) => `  - They ${s}.`).join('\n')}`,
    );
  }

  // The inventory. Printed as ids first so the model reads the handle it must
  // return before the prose it would rather write.
  parts.push(
    `THEIR CLOSET, PIECE BY PIECE (pack by id; never use an id that is not here)\n${body.garments
      .map(
        (g) =>
          `  ${g.id}: ${`${g.color} ${g.name}`.trim()} — ${g.slot}, formality ${g.formality}/5, warmth ${g.warmth}/5`,
      )
      .join('\n')}`,
  );

  parts.push(
    `Write the brief for this trip and pack ${trip.parts.length === 1 ? 'the one part of the day' : 'each part of the day'} they asked for.`,
  );

  return parts.join('\n\n');
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return fail('not_configured', 'Packing briefs are not available right now.', 500);
      }

      let body: ValidatedPackingRequest;
      try {
        body = parsePackingRequest(await readBoundedJson(req));
      } catch (err) {
        if (err instanceof BoundsError) return fail('invalid_request', err.message, 400);
        throw err;
      }

      // `withSupabase` returns an untyped client, so every query result widens
      // to `never` and column names stop being checked. Casting once here
      // restores that, exactly as the sibling functions do.
      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;

      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;
      if (!userId) return fail('not_signed_in', 'Not signed in.', 401);

      // ── AI processing consent (App Store Guideline 5.1.2(i)) ──────────────
      // Server-side, like every sibling: the rule is about what actually leaves
      // the device, and a client-side gate is trivially bypassed.
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
        .eq('workload', WORKLOAD)
        .maybeSingle();

      if (config && !config.enabled) {
        return fail('packing_disabled', 'Packing briefs are turned off right now.', 503);
      }

      // ── Allowance. After the free rejections, before the provider — a unit
      //    is never refunded, so it must not be spent on a request that was
      //    never going to reach the model. ────────────────────────────────────
      const quotaResponse = await enforceAiQuota(admin, userId, QUOTA_KIND);
      if (quotaResponse) return quotaResponse;

      let result: PackingResult | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;
      const startedAt = Date.now();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const completion = await completeStructured<PackingResult>({
            apiKey,
            model: config?.model_id ?? DEFAULT_MODEL,
            messages: [
              { role: 'system', content: PACKING_SYSTEM_PROMPT },
              { role: 'user', content: buildPrompt(body) },
            ],
            schema: packingSchema as unknown as Record<string, unknown>,
            schemaName: 'packing_brief',
            maxTokens: config?.max_tokens ?? DEFAULT_MAX_TOKENS,
            params: (config?.params ?? DEFAULT_PARAMS) as Record<string, unknown>,
            timeoutMs: PACKING_TIMEOUT_MS,
          });

          result = completion.parsed;
          promptTokens = completion.promptTokens;
          completionTokens = completion.completionTokens;
          costUsd = completion.costUsd;
          latencyMs = completion.latencyMs;
          failure = null;
          break;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
          // Wall clock across the failed attempts. The provider only reports
          // latency on a response, so failures would otherwise be logged as
          // 0 ms — which reads as instant and free, and they are neither.
          latencyMs = Date.now() - startedAt;
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      await recordAiCall(admin, {
        user_id: userId,
        workload: WORKLOAD,
        provider: config?.provider ?? 'openrouter',
        model_id: config?.model_id ?? DEFAULT_MODEL,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: result !== null,
        error: failure,
      });

      if (!result) {
        // 502 rather than a 200 with `ok: false`, unlike generate-outfits. That
        // one degrades because the client already holds real outfits; here
        // there is nothing to degrade to, and the screen's retry needs a real
        // error to hang off.
        return fail('brief_failed', 'The brief did not come back. Try again in a moment.', 502);
      }

      // ── Truthfulness pass. A strict schema constrains shape, not honesty. ──
      // Every id is checked against what we sent, duplicates within a part are
      // dropped, and a part the user never asked for is discarded outright —
      // otherwise a hallucinated id renders as a garment made of nothing and an
      // unasked-for part renders as a section the questionnaire denies exists.
      const known = new Set(body.garments.map((g) => g.id));
      const asked = new Set<string>(body.trip.parts);

      const parts = body.trip.parts
        .map((part) => result!.parts.find((p) => p.part === part))
        .filter((p): p is PackingResult['parts'][number] => Boolean(p) && asked.has(p!.part))
        .map((p) => ({
          part: p.part,
          note: p.note,
          itemIds: [...new Set(p.itemIds.filter((id) => known.has(id)))].slice(0, MAX_PICKS_PER_PART),
        }));

      return Response.json({
        ok: true,
        brief: {
          headline: result.headline,
          spec: result.spec.slice(0, MAX_SPEC_FRAGMENTS),
          observation: result.observation,
          gaps: result.gaps,
          parts,
        },
        usage: { promptTokens, completionTokens, costUsd, latencyMs },
      });
    },
  ),
};
