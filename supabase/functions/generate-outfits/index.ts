import { withSupabase } from 'npm:@supabase/server@^1';

import { completeStructured, OpenRouterError } from '../_shared/openrouter.ts';
import {
  OUTFIT_SYSTEM_PROMPT,
  outfitSchema,
  type OutfitRerank,
} from '../_shared/outfit-schema.ts';

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
 */

const MAX_CANDIDATES = 14;

type Candidate = {
  id: string;
  items: {
    slot: string;
    name: string;
    color: string;
    formality: number;
  }[];
  score: number;
  /** Grounded notes from the scorer, e.g. "rain-ready", "complementary palette". */
  notes: string[];
};

type Body = {
  candidates?: Candidate[];
  context?: {
    weather?: {
      feelsLikeC: number;
      highC: number;
      lowC: number;
      precipitationChance: number;
      windKph: number;
    } | null;
    events?: { title: string; startsAt: string; formality: number }[];
    note?: string | null;
    city?: string | null;
  };
  /** Plain-language description of the learned preferences. */
  styleSummary?: string[];
  count?: number;
};

const describeCandidate = (c: Candidate): string => {
  const pieces = c.items
    .map((i) => `${i.color} ${i.name}`.trim())
    .join(', ');
  const notes = c.notes.length ? ` [${c.notes.join('; ')}]` : '';
  return `${c.id}: ${pieces} (fit score ${Math.round(c.score * 100)})${notes}`;
};

const describeContext = (ctx: Body['context']): string => {
  if (!ctx) return 'No context supplied.';
  const lines: string[] = [];

  if (ctx.weather) {
    const w = ctx.weather;
    lines.push(
      `Weather${ctx.city ? ` in ${ctx.city}` : ''}: feels like ${Math.round(w.feelsLikeC)}°C, ` +
        `high ${Math.round(w.highC)}°, low ${Math.round(w.lowC)}°, ` +
        `${Math.round(w.precipitationChance * 100)}% chance of rain, wind ${Math.round(w.windKph)} km/h.`,
    );
  }

  if (ctx.events?.length) {
    lines.push('Today:');
    for (const e of ctx.events) {
      lines.push(`  - ${e.startsAt} ${e.title} (formality ${e.formality}/5)`);
    }
  }

  if (ctx.note) lines.push(`The user says: "${ctx.note}"`);
  return lines.join('\n');
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

      const candidates = (body.candidates ?? []).slice(0, MAX_CANDIDATES);
      if (!candidates.length) {
        return Response.json({ error: 'candidates is required.' }, { status: 400 });
      }

      const userId = ctx.userClaims?.sub as string | undefined;
      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

      // ── AI processing consent, server-side. Same reasoning as tag-item: the
      //    rule is about what actually leaves the device. ─────────────────────
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      const { data: requiredVersion } = await ctx.supabaseAdmin.rpc('current_ai_consent_version');

      if (!profile?.ai_consent_version || profile.ai_consent_version < (requiredVersion ?? 1)) {
        return Response.json(
          { error: 'ai_consent_required', requiredVersion: requiredVersion ?? 1 },
          { status: 403 },
        );
      }

      const { data: config } = await ctx.supabaseAdmin
        .from('ai_config')
        .select('model_id, params, max_tokens, enabled, provider')
        .eq('workload', 'outfit_generation')
        .single();

      if (!config?.enabled) {
        return Response.json({ error: 'Styling is disabled.' }, { status: 503 });
      }

      const count = Math.min(Math.max(body.count ?? 3, 1), 5);
      const styleSummary = body.styleSummary?.length
        ? `\n\nWhat you know about this person's taste, learned from their reactions:\n${body.styleSummary.map((s) => `  - They ${s}.`).join('\n')}`
        : '';

      const userPrompt = [
        describeContext(body.context),
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
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      await ctx.supabaseAdmin.from('ai_calls').insert({
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
