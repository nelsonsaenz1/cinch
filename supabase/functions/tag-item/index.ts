import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

import { recordAiCall } from '../_shared/ai-calls.ts';
import { loadAiSettings } from '../_shared/ai-config.ts';
import { validateTags } from '../_shared/tag-validate.ts';

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
import { BoundsError, parseTagRequest, readBoundedJson } from '../_shared/input-bounds.ts';
import { claimItemJob, completeItemJob, releaseItemJob } from '../_shared/job-claim.ts';
import { enforceAiQuota } from '../_shared/quota.ts';

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
 *
 * Cost discipline, added after review: a vision call is the most expensive thing
 * this app does, and the only gate used to be "is somebody signed in". Three
 * things now stand between a caller and the provider — bounded input, a daily
 * allowance, and an exclusive claim on the item — so re-tagging the same
 * photograph in a loop costs database rows rather than model calls.
 */

const BUCKET = 'garments';
/** Signed URL lifetime — only needs to outlive the model call. */
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Vision calls with a fetched image are the slowest workload here, so they get
 * more room than the shared default before the request is abandoned.
 */
const TAG_TIMEOUT_MS = 45_000;

/** Statuses that mean the garment already has tags worth keeping. */
const SETTLED: readonly string[] = ['tagged', 'verified'];

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

      let itemId: string;
      let force: boolean;
      try {
        const parsed = parseTagRequest(await readBoundedJson(req));
        itemId = parsed.itemId;
        force = parsed.force;
      } catch (err) {
        if (err instanceof BoundsError) {
          return Response.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }

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
      if (!userId) {
        return Response.json({ error: 'Not signed in.' }, { status: 401 });
      }

      // ── AI processing consent (App Store Guideline 5.1.2(i)) ──────────────
      // Checked server-side, not client-side. A client-side gate is trivially
      // bypassed, and the rule is about what actually leaves the device.
      const { data: profile } = await db
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      const { data: requiredVersion } = await admin.rpc(
        'current_ai_consent_version',
      );

      if (!profile?.ai_consent_version || profile.ai_consent_version < (requiredVersion ?? 1)) {
        return Response.json(
          { error: 'ai_consent_required', requiredVersion: requiredVersion ?? 1 },
          { status: 403 },
        );
      }

      // ── Load the item. `db` is RLS-scoped to the caller, so this
      //    also proves ownership without a manual user_id check. ─────────────
      const { data: item, error: itemError } = await db
        .from('items')
        .select('id, image_path, status, ai_tags')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return Response.json({ error: 'Item not found.' }, { status: 404 });
      }
      if (!item.image_path) {
        return Response.json({ error: 'Item has no image yet.' }, { status: 409 });
      }

      // ── Idempotency. The query above used to ignore `status`, so the same
      //    garment could be sent to the vision model an unlimited number of
      //    times, each one a fresh charge for an answer we already have. A
      //    settled item returns what it already knows and costs nothing.
      //
      //    `force` exists because re-tagging is sometimes the right thing —
      //    after a model change, or when a user rejects the tags — and the
      //    caller should have to say so rather than get it by accident. ──────
      if (SETTLED.includes(item.status) && !force) {
        return Response.json({
          ok: true,
          status: item.status,
          tags: item.ai_tags,
          skipped: 'already_tagged',
        });
      }

      // ── Exclusive claim. The upload queue runs at concurrency 3 and retries,
      //    so two invocations for one item genuinely overlap; without this both
      //    would call the provider. Forcing a re-tag drops the previous claim
      //    first, since that claim is the record of the run being replaced. ───
      if (force) await releaseItemJob(admin, itemId);

      let claim;
      try {
        claim = await claimItemJob(admin, itemId, userId, 'tag_item');
      } catch (err) {
        // The claim is the thing that stops us paying twice, so a claim we
        // could not take is a reason to stop, not to proceed hopefully.
        return Response.json(
          {
            error: 'Could not start tagging this item. Please try again.',
            detail: err instanceof Error ? err.message : String(err),
          },
          { status: 503 },
        );
      }

      if (!claim.claimed) {
        if (claim.reason === 'already_done') {
          return Response.json({
            ok: true,
            status: item.status,
            tags: item.ai_tags,
            skipped: 'already_tagged',
          });
        }
        // 409 rather than an error: nothing is wrong, another invocation is
        // simply mid-flight, and the client's queue can move on.
        return Response.json(
          { ok: false, status: 'in_progress', error: 'This item is already being tagged.' },
          { status: 409 },
        );
      }

      // ── Model config, read at call time so a model swap is a DB update ────
      const { data: config } = await admin
        .from('ai_config')
        .select('model_id, params, max_tokens, enabled, provider')
        .eq('workload', 'tagging')
        .single();

      /**
       * The same row, through the shared loader, for the two fields the direct
       * select above predates: `rescue_model_id` and `validator_policy`.
       *
       * Not a second read of a different truth — same table, same workload. The
       * original select stays because the rest of this function reads `config`
       * and rewriting all of it to prove one point would be a larger diff than
       * the packet needs.
       */
      const settings = await loadAiSettings(admin, 'tagging', {
        modelId: config?.model_id ?? '',
        maxTokens: config?.max_tokens ?? 1024,
        timeoutMs: TAG_TIMEOUT_MS,
      });

      if (!config?.enabled) {
        // Every early return from here on releases the claim: the item is
        // untouched, and leaving it claimed would block the retry that fixes it.
        await releaseItemJob(admin, itemId);
        return Response.json({ error: 'Tagging is disabled.' }, { status: 503 });
      }

      // ── Signed URL for the image. The bucket is private, so the model needs a
      //    time-limited URL rather than a public one. ─────────────────────────
      const { data: signed, error: signError } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(item.image_path, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed?.signedUrl) {
        await releaseItemJob(admin, itemId);
        return Response.json({ error: 'Could not read the image.' }, { status: 500 });
      }

      // ── Allowance, claimed LAST — after the kill switch and after the image
      //    has proven readable. `claim_ai_quota` does not refund (a refund
      //    path is a free retry loop for an attacker), so a unit claimed
      //    before those checks is a unit burnt by every retry against a
      //    disabled workload or a broken image: with the queue retrying at
      //    concurrency 3, flipping `ai_config.enabled = false` would drain a
      //    free user's month in seconds instead of stopping spend. The other
      //    two AI functions already order it this way.
      const quotaResponse = await enforceAiQuota(admin, userId, 'tagging');
      if (quotaResponse) {
        // Hand the claim back — the work never happened, and the item must
        // stay taggable once the allowance resets.
        await releaseItemJob(admin, itemId);
        return quotaResponse;
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
      /** Set when a deterministic rejection escalated to the rescue model. */
      let rescued = false;
      /** The failure codes that caused it, for the ledger. */
      let rejection: string | null = null;
      /**
       * Provider round trips actually made, retries and rescue included.
       *
       * The loop below can run twice for two entirely different reasons — a
       * retryable 429, or a deterministic rejection escalating to the rescue
       * model — and both cost a real call. Recording a hard 1 would have made
       * the tagger's true provider volume unknowable at exactly the moment the
       * rescue path started doubling it.
       */
      let attemptsMade = 0;
      const startedAt = Date.now();

      // Two attempts. A retryable failure (429 / 5xx) is worth one more try;
      // anything else will fail identically and retrying only burns budget.
      for (let attempt = 0; attempt < 2; attempt++) {
        attemptsMade = attempt + 1;
        try {
          const result = await completeStructured<TagResult>({
            apiKey,
            // The rescue model on the second pass, and only when a validator
            // rejection put us here — a retryable provider error re-runs the
            // primary, as it always did.
            model: rescued && settings.rescueModelId ? settings.rescueModelId : config.model_id,
            messages: [
              { role: 'system', content: TAG_SYSTEM_PROMPT },
              { role: 'user', content },
            ],
            schema: tagSchema as unknown as Record<string, unknown>,
            schemaName: 'garment_tags',
            maxTokens: config.max_tokens,
            params: (config.params ?? {}) as Record<string, unknown>,
            // Configured, not compiled. A provider that has become slow is
            // answered with a database update, not a release.
            timeoutMs: settings.timeoutMs,
          });

          promptTokens = result.promptTokens;
          completionTokens = result.completionTokens;
          costUsd = result.costUsd;
          latencyMs = result.latencyMs;

          /**
           * The deterministic gate.
           *
           * `normalizeTags` clamps what is merely out of range; `validateTags`
           * refuses what is CONTRADICTORY — a tote filed as a top, a solid with
           * a print scale, a wool coat claiming to shed rain. Those are not
           * values to coerce, they are answers that were not read off the
           * photograph, and coercing one files somebody's handbag as a shirt.
           *
           * It also resolves the brand against evidence and writes the
           * description from the fields that survived. See `tag-validate.ts`.
           */
          const checked = validateTags(normalizeTags(result.parsed), {
            // OCR is native and arrives in the next packet; a null here simply
            // means one of the three evidence routes is unavailable, and an
            // unsupported brand claim is dropped rather than trusted.
            ocrText: null,
            catalogueBrands: [],
            userBrand: null,
          });

          if (checked.ok) {
            tags = checked.tags;
            failure = null;
            break;
          }

          /**
           * ONE rescue, and only after a deterministic rejection.
           *
           * Not a second opinion on a result that passed — that is the pattern
           * the plan forbids, and it costs twice for one answer. This runs the
           * configured `rescue_model_id` on the same photograph exactly once;
           * if that also fails validation the item becomes `needs_review`,
           * which is a state the user can act on. There is no loop.
           */
          rejection = checked.failures.join(',');
          if (attempt === 0 && settings.validatorPolicy === 'rescue' && settings.rescueModelId) {
            rescued = true;
            continue;
          }
          if (settings.validatorPolicy === 'accept') {
            tags = normalizeTags(result.parsed);
            failure = null;
            break;
          }
          failure = `validator_rejected:${rejection}`;
          break;
        } catch (err) {
          failure = err instanceof Error ? err.message : String(err);
          // Wall clock, including the failed attempts and the backoff between
          // them. The provider reports latency only on a response, so this used
          // to be logged as 0 — which read as "free and instant" for exactly
          // the calls that are neither.
          latencyMs = Date.now() - startedAt;
          const retryable = err instanceof OpenRouterError && err.retryable;
          if (!retryable || attempt === 1) break;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }

      // ── Accounting. Written for both success and failure — a failed call still
      //    costs latency and sometimes tokens, and hiding that skews the model. ─
      await recordAiCall(admin, {
        user_id: userId,
        workload: 'tagging',
        provider: config.provider,
        model_id: rescued && settings.rescueModelId ? settings.rescueModelId : config.model_id,
        item_id: itemId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        succeeded: tags !== null,
        attempts: attemptsMade,
        error: failure,
      });

      // ── Failure: keep the item, badge it for review. Never lose an upload. ──
      if (!tags) {
        await db
          .from('items')
          .update({ status: 'needs_review' })
          .eq('id', itemId);

        // The job did not produce tags, so it is not done. Releasing the claim
        // is what lets the user press retry on the needs_review badge.
        await releaseItemJob(admin, itemId);

        return Response.json(
          { ok: false, status: 'needs_review', error: failure },
          { status: 200 },
        );
      }

      // ── Success ────────────────────────────────────────────────────────────
      const { error: updateError } = await db
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
        // Tags exist but did not land. Release so a retry can write them —
        // it will pay for the call again, which is the honest cost of a write
        // that failed, and the alternative is an item stuck untagged forever.
        await releaseItemJob(admin, itemId);
        return Response.json({ error: 'tag_write_failed' }, { status: 500 });
      }

      // Claim closed with a result: the row is now proof this item was tagged,
      // and a duplicate invocation that arrives late reads it instead of paying.
      await completeItemJob(admin, itemId);

      return Response.json({ ok: true, status: 'tagged', tags, costUsd });
    },
  ),
};
