import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { CHAT_SYSTEM_PROMPT, chatSchema, type ChatResult } from '../_shared/chat-schema.ts';
import { completeStructured, OpenRouterError } from '../_shared/openrouter.ts';
import {
  BoundsError,
  CHAT_LIMITS,
  parseChatRequest,
  readBoundedJson,
  type ValidatedChatRequest,
} from '../_shared/input-bounds.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

/**
 * stylist-chat — conversational styling grounded in a real closet.
 *
 * The client parses the question on-device, builds a matching context, runs the
 * beam search, and sends up a shortlist. This function adds language and
 * judgement. It never sees the closet, only a digest and a list of assembled
 * outfits, so it cannot recommend a garment the user does not own.
 *
 * Conversation history is capped rather than replayed in full. A long thread
 * about one wardrobe adds tokens without adding information — the closet digest
 * and the shortlist already carry the state that matters.
 *
 * Those caps are now enforced rather than assumed. Everything in the body ends
 * up in a prompt we pay for by the token, and the only check used to be that
 * `message` was non-empty — so a signed-in account could put a megabyte of text
 * in `notes[]` and have us pay to send it. `_shared/input-bounds.ts` bounds
 * every field and the body as a whole before the provider is touched.
 */

/** The chat prompt is the largest of the three workloads but text-only. */
const CHAT_TIMEOUT_MS = 30_000;

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return Response.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 });
      }

      let body: ValidatedChatRequest;
      try {
        body = parseChatRequest(await readBoundedJson(req));
      } catch (err) {
        if (err instanceof BoundsError) {
          return Response.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
      const message = body.message;

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;

      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

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
        .eq('workload', 'stylist_chat')
        .single();

      if (!config?.enabled) {
        return Response.json({ error: 'The stylist is unavailable.' }, { status: 503 });
      }

      // ── Daily allowance. Claimed here: after the cheap rejections, before
      //    anything that costs money. ────────────────────────────────────────
      const quotaResponse = await enforceAiQuota(admin, userId, 'stylist_chat');
      if (quotaResponse) return quotaResponse;

      const candidates = body.candidates;

      const parts: string[] = [];
      if (body.digest) parts.push(`THEIR CLOSET\n${body.digest}`);

      if (body.weather) {
        const w = body.weather;
        parts.push(
          `WEATHER${body.city ? ` in ${body.city}` : ''}: feels like ${Math.round(w.feelsLikeC)}°C, ${Math.round(w.precipitationChance * 100)}% chance of rain.`,
        );
      }

      // The tapped answers, ahead of the taste summary and the shortlist so the
      // model reads the request before it reads the options. Printed as keys
      // rather than prose: they arrived as keys, and re-inflating them into a
      // sentence here would only re-create the ambiguity the taps removed.
      if (body.brief) {
        const b = body.brief;
        const lines = [`  occasion: ${b.occasion}`];
        if (b.silhouette) lines.push(`  silhouette: ${b.silhouette}`);
        if (b.mood) lines.push(`  mood: ${b.mood}`);
        if (b.dressForWeather !== undefined) {
          lines.push(`  mostly outside: ${b.dressForWeather ? 'yes' : 'no'}`);
        }
        parts.push(`WHAT THEY TAPPED\n${lines.join('\n')}`);
      }

      if (body.styleSummary.length) {
        parts.push(
          `WHAT YOU KNOW ABOUT THEIR TASTE\n${body.styleSummary.map((s) => `  - They ${s}.`).join('\n')}`,
        );
      }

      if (candidates.length) {
        parts.push(
          `OUTFITS THE ENGINE ASSEMBLED FOR THIS QUESTION (recommend by id)\n${candidates
            .map(
              (c) =>
                `  ${c.id}: ${c.items.map((i) => `${i.color} ${i.name}`.trim()).join(', ')} (fit ${Math.round(c.score * 100)})${c.notes.length ? ` [${c.notes.join('; ')}]` : ''}`,
            )
            .join('\n')}`,
        );
      } else {
        parts.push(
          'The engine could not assemble a complete outfit for this question from their closet. Say so honestly and suggest what would unlock it.',
        );
      }

      parts.push(`THEY ASKED\n${message}`);

      // Already bounded to CHAT_LIMITS.maxHistoryTurns by the parser, which
      // rejects an over-long thread instead of quietly trimming it: a client
      // sending more than it should is a bug worth seeing, not one to absorb.
      const history = body.history.slice(-CHAT_LIMITS.maxHistoryTurns).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      let result: ChatResult | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;
      const startedAt = Date.now();

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const completion = await completeStructured<ChatResult>({
            apiKey,
            model: config.model_id,
            messages: [
              { role: 'system', content: CHAT_SYSTEM_PROMPT },
              ...history,
              { role: 'user', content: parts.join('\n\n') },
            ],
            schema: chatSchema as unknown as Record<string, unknown>,
            schemaName: 'stylist_reply',
            maxTokens: config.max_tokens,
            params: (config.params ?? {}) as Record<string, unknown>,
            timeoutMs: CHAT_TIMEOUT_MS,
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
        workload: 'stylist_chat',
        provider: config.provider,
        model_id: config.model_id,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: result !== null,
        error: failure,
      });

      if (!result) {
        return Response.json({ ok: false, reason: 'stylist_offline', error: failure });
      }

      // Drop fabricated ids. A strict schema constrains shape, not truthfulness,
      // and an unrecognised id would render as an outfit made of nothing.
      const valid = new Set(candidates.map((c) => c.id));
      const outfitIds = result.outfitIds.filter((id) => valid.has(id)).slice(0, 3);

      return Response.json({
        ok: true,
        reply: result.reply,
        outfitIds,
        followUp: result.followUp,
        usage: { promptTokens, completionTokens, costUsd, latencyMs },
      });
    },
  ),
};
