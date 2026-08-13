import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { loadAiSettings } from '../_shared/ai-config.ts';
import { completeStructured, OpenRouterError, redactUrls } from '../_shared/openrouter.ts';
import {
  closetSchema,
  normalizeGarments,
  PARSE_SYSTEM_PROMPT,
  MAX_GARMENTS,
  type ParsedCloset,
} from '../_shared/intake-schema.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

/**
 * parse-closet — a spoken transcript becomes a list of garments.
 *
 * Invoked once per walkthrough, between V-04 and V-05. Unlike `tag-item` this
 * is NOT fanned out by the client: one transcript is one call, because the
 * garments in it are described relative to each other ("the same jacket in
 * black") and splitting the text would lose that.
 *
 * Extraction against a fixed schema, not open reasoning — which is why it sits
 * on the re-ranking-class model the tiers doc already sizes rather than
 * anything larger.
 *
 * CONTRACT: this function must never invent a garment. Everything it returns
 * carries a verbatim span from the transcript, and anything it could not turn
 * into a garment comes back in `unconsumed` so V-05 can show it. A silent drop
 * is how somebody loses a coat and never finds out.
 *
 * Drafts are written here rather than returned for the client to insert. The
 * procession has to survive a cold start (§5.1), and a list that only ever
 * existed in a JS array does not.
 */

/** Speech, not prose. Twelve minutes of talking is a lot of words, and the
 *  cap exists so a pathological payload cannot become a huge prompt. */
const MAX_TRANSCRIPT_CHARS = 24_000;

/** Extraction over a long transcript legitimately takes longer than a chat
 *  turn, and a re-run costs the user quota — so it gets room. */
const PARSE_TIMEOUT_MS = 60_000;

/** Enough for ~120 garments of structured output plus the unconsumed spans. */
const PARSE_MAX_TOKENS = 16_000;

/**
 * `deepseek-v4-flash-0731`, not `openai/gpt-oss-120b`.
 *
 * The original choice was the one model this repo had already measured and
 * rejected. `20260803220000_outfit_model.sql` records a four-way bake-off on a
 * comparable structured-extraction task and annotates gpt-oss-120b, in those
 * words, **"too slow"** — 45.4s against deepseek-v4-flash's 15-20s, both 3/3
 * correct.
 *
 * 45 seconds is not merely slow here, it is over budget: PARSE_TIMEOUT_MS is
 * 60s, so the margin was fifteen seconds on a good run. Verified today by
 * failing — a 350-character transcript, nine garments, timed out. That is the
 * shortest realistic input this function will ever see, and MAX_TRANSCRIPT_CHARS
 * allows 24,000. The failure is not deterministic, which is worse than if it
 * were: the same walkthrough succeeds and then fails, and the user loses a
 * closet they spent four minutes describing to a `parse_error`.
 *
 * deepseek-v4-flash is already the outfit-generation model, so it is proven in
 * production against a strict schema with `response_format` on. It costs about
 * three times as much per call ($0.0007 vs $0.00022) — an extra half a cent per
 * walkthrough, against a parse that currently has a real chance of not
 * returning at all.
 *
 * IT IS NOW A FLOOR RATHER THAN THE CHOICE. `ai_config` for `closet_parsing`
 * selects the model, the ceiling and the deadline; this is what runs when there
 * is no row. The workload is new in migration 20260813203052 — before it, this
 * call filed itself in the ledger as `tagging`, which made the parser's real
 * cost and failure rate inseparable from photo tagging. The QUOTA it spends is
 * deliberately unchanged and still `tagging`: that is a membership boundary,
 * and correcting the books is not a licence to move it.
 */
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash-0731';

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

      const db = ctx.supabase as unknown as SupabaseClient<Database>;
      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      const userId = ctx.userClaims?.id;

      if (!userId) {
        return Response.json({ error: 'unauthenticated' }, { status: 401 });
      }

      let sessionId: string;
      try {
        const body = await req.json();
        sessionId = String(body?.sessionId ?? '');
        if (!sessionId) throw new Error('sessionId is required');
      } catch {
        return Response.json({ error: 'bad_request' }, { status: 400 });
      }

      // Read through the USER's client, not admin: RLS is what proves this
      // session belongs to the caller, and going around it here would be the
      // one place in the path where ownership is taken on trust.
      const { data: session, error: sessionError } = await db
        .from('intake_sessions')
        .select('id, status, transcript')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError) {
        return Response.json({ error: 'session_unavailable' }, { status: 503 });
      }
      if (!session) {
        return Response.json({ error: 'not_found' }, { status: 404 });
      }
      if (!session.transcript || !session.transcript.trim()) {
        return Response.json({ error: 'no_transcript' }, { status: 409 });
      }

      // Idempotence. A client that retries after a timeout must not pay twice
      // or double the drafts — the procession reads by (session, ordinal) and
      // a second parse would collide on the unique constraint anyway.
      if (session.status === 'reviewing' || session.status === 'committed') {
        const { data: existing } = await db
          .from('intake_drafts')
          .select('*')
          .eq('session_id', sessionId)
          .order('ordinal');
        // `unconsumed` is READ BACK here rather than answered `[]`. This is the
        // resume path — taken whenever a session is reopened after a cold start
        // — and returning an empty list silently emptied V-05's "things I
        // didn't catch" disclosure, losing the record of what the app failed to
        // understand. Refusal 7 covers the spans as much as the garments.
        const { data: session2 } = await db
          .from('intake_sessions')
          .select('unconsumed')
          .eq('id', sessionId)
          .maybeSingle();
        return Response.json({
          garments: existing ?? [],
          unconsumed: session2?.unconsumed ?? [],
          reused: true,
        });
      }

      const transcript = session.transcript.slice(0, MAX_TRANSCRIPT_CHARS);

      await db.from('intake_sessions').update({ status: 'parsing' }).eq('id', sessionId);

      // Quota is claimed BEFORE the call and never refunded — same posture as
      // every other AI path here. See _shared/quota.ts on why a refund path is
      // a free retry loop for anyone willing to provoke failures.
      //
      // One unit for the parse itself. The per-garment charge the directive
      // asks for is applied below, once the count is known.
      const quotaResponse = await enforceAiQuota(admin, userId, 'tagging');
      if (quotaResponse) {
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'quota_exhausted' })
          .eq('id', sessionId);
        return quotaResponse;
      }

      const settings = await loadAiSettings(admin, 'closet_parsing', {
        modelId: DEFAULT_MODEL,
        maxTokens: PARSE_MAX_TOKENS,
        timeoutMs: PARSE_TIMEOUT_MS,
      });

      const startedAt = Date.now();
      let result;
      try {
        result = await completeStructured<ParsedCloset>({
          apiKey,
          model: settings.modelId,
          messages: [
            { role: 'system', content: PARSE_SYSTEM_PROMPT },
            { role: 'user', content: transcript },
          ],
          schema: closetSchema as unknown as Record<string, unknown>,
          schemaName: 'closet',
          maxTokens: settings.maxTokens,
          timeoutMs: settings.timeoutMs,
        });
      } catch (error) {
        const code = error instanceof OpenRouterError ? 'parse_failed' : 'parse_error';
        // Same discipline as transcribe-intake: `parse_error` means "something
        // that was not the provider threw", which is precisely the case nobody
        // can diagnose from the status alone.
        console.error(
          `parse-closet ${code} (session=${sessionId}, user=${userId}, model=${settings.modelId}, chars=${transcript.length}): ` +
            redactUrls(error instanceof Error ? `${error.name}: ${error.message}` : String(error)),
        );
        // The transcript survives. V-13's branch for this is "we heard you, we
        // could not read it" — with the words still on screen and a retry that
        // does not need the microphone again.
        // A failed parse is a call that happened: it spent latency, it may have
        // spent tokens, and it spent the user's quota. Recording only the
        // successes is what made the parser's failure rate invisible.
        await recordAiCall(admin, {
          user_id: userId,
          workload: 'closet_parsing',
          provider: settings.provider,
          model_id: settings.modelId,
          prompt_tokens: null,
          completion_tokens: null,
          cost_usd: null,
          latency_ms: Date.now() - startedAt,
          succeeded: false,
          attempts: 1,
          error: code,
        });
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: code })
          .eq('id', sessionId);
        return Response.json({ error: code }, { status: 502 });
      }

      const parsed = normalizeGarments(result.parsed, transcript);

      // Per-garment quota, so a 40-item walkthrough costs the same 40 units a
      // 40-photo import would (§7). Claimed AFTER the call because the count is
      // not knowable before it — a user who runs out mid-list still keeps every
      // garment; the ceiling they meet is the closet ceiling at commit, not
      // this one. Refusing here would mean charging for a parse and then
      // throwing the parse away.
      for (let i = 1; i < parsed.garments.length; i += 1) {
        await enforceAiQuota(admin, userId, 'tagging');
      }

      await recordAiCall(admin, {
        user_id: userId,
        workload: 'closet_parsing',
        provider: settings.provider,
        model_id: settings.modelId,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        cost_usd: result.costUsd,
        latency_ms: result.latencyMs,
        succeeded: true,
        // `completeStructured` does not retry, so one call is one attempt. A
        // hard-coded 1 where there is no loop is truthful; a null, which is
        // what this row carried before, is not readable in aggregate.
        attempts: 1,
      });

      if (parsed.garments.length === 0) {
        // V-13, "nothing parsed". Not an error status: the recording worked and
        // the transcript is intact, so the session stays reviewable and the
        // screen shows the words with nothing pulled out of them.
        await db.from('intake_sessions')
          .update({ status: 'reviewing', unconsumed: parsed.unconsumed })
          .eq('id', sessionId);
        return Response.json({ garments: [], unconsumed: parsed.unconsumed });
      }

      const rows = parsed.garments.slice(0, MAX_GARMENTS).map((g, index) => ({
        session_id: sessionId,
        user_id: userId,
        ordinal: index,
        utterance: g.utterance,
        name: g.name,
        slot: g.slot,
        colour_term: g.colour_term,
        // Deliberately null. The lexicon lives in the client bundle
        // (src/lib/color/families.ts) and resolving here would be a second copy
        // of it in a second runtime — the app fills this in as it walks the
        // procession, which is also when a correction can change it.
        colour_oklch: null,
        fabric: g.fabric,
        pattern: g.pattern,
        formality: g.formality,
        warmth: g.warmth,
        quantity: g.quantity,
        confidence: g.confidence,
        state: 'pending' as const,
      }));

      // Written through the user's client so the insert policy applies.
      //
      // `.select()` is not decoration. Without it this returned the payload it
      // had just built — rows with no `id` and no `created_at`, because those
      // are defaulted by Postgres and only exist once the row does. Every card
      // in a freshly-parsed procession would have had `id: undefined`: nothing
      // to key a list by, and nothing to save a correction against. The
      // `reused` branch above already selects, so the two paths returned
      // differently shaped garments for the same session depending on whether
      // it was the first call or a retry.
      const { data: inserted, error: insertError } = await db
        .from('intake_drafts')
        .insert(rows)
        .select('*')
        .order('ordinal');
      if (insertError) {
        await db.from('intake_sessions')
          .update({ status: 'failed', error_code: 'drafts_unwritable' })
          .eq('id', sessionId);
        return Response.json({ error: 'drafts_unwritable' }, { status: 500 });
      }

      await db.from('intake_sessions')
        .update({ status: 'reviewing', cursor: 0, unconsumed: parsed.unconsumed })
        .eq('id', sessionId);

      return Response.json({
        garments: inserted ?? rows,
        unconsumed: parsed.unconsumed,
      });
    },
  ),
};
