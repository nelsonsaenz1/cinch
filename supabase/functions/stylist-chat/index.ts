import { withSupabase } from 'npm:@supabase/server@^1';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { CHAT_SYSTEM_PROMPT, chatSchema, type ChatResult } from '../_shared/chat-schema.ts';
import { completeStructured, OpenRouterError } from '../_shared/openrouter.ts';

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
 */

const MAX_CANDIDATES = 10;
const MAX_HISTORY = 8;

type Body = {
  message?: string;
  sessionId?: string | null;
  history?: { role: 'user' | 'assistant'; text: string }[];
  digest?: string;
  candidates?: {
    id: string;
    items: { slot: string; name: string; color: string; formality: number }[];
    score: number;
    notes: string[];
  }[];
  context?: {
    weather?: { feelsLikeC: number; precipitationChance: number } | null;
    city?: string | null;
  };
  styleSummary?: string[];
};

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!apiKey) {
        return Response.json({ error: 'OPENROUTER_API_KEY is not configured.' }, { status: 500 });
      }

      let body: Body;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
      }

      const message = body.message?.trim();
      if (!message) return Response.json({ error: 'message is required.' }, { status: 400 });

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      const userId = (ctx.userClaims as { sub?: string } | undefined)?.sub;

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

      const candidates = (body.candidates ?? []).slice(0, MAX_CANDIDATES);

      const parts: string[] = [];
      if (body.digest) parts.push(`THEIR CLOSET\n${body.digest}`);

      if (body.context?.weather) {
        const w = body.context.weather;
        parts.push(
          `WEATHER${body.context.city ? ` in ${body.context.city}` : ''}: feels like ${Math.round(w.feelsLikeC)}°C, ${Math.round(w.precipitationChance * 100)}% chance of rain.`,
        );
      }

      if (body.styleSummary?.length) {
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

      const history = (body.history ?? []).slice(-MAX_HISTORY).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      let result: ChatResult | null = null;
      let failure: string | null = null;
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let costUsd: number | null = null;
      let latencyMs = 0;

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
