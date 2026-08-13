/**
 * One place that answers "which model, for how long, and what if it is wrong".
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * Three of the five model callers had their model compiled into them:
 * `asr.ts` held `openai/whisper-large-v3`, `parse-closet` held
 * `deepseek/deepseek-v4-flash-0731`, and `packing-brief` read `ai_config` but
 * under somebody else's workload. That meant changing a model — the single
 * most likely operational response to a provider outage, a price change, or a
 * model being retired — required an App Store release, or at best an OTA and a
 * fingerprint check. It also meant the ledger could not tell you what any of
 * those calls cost, because two of them were filed under `tagging` and
 * `stylist_chat`.
 *
 * Now every caller asks here. A missing row is not an error: it means the
 * compiled default, which is exactly the state the system is in today, so the
 * seed is data rather than schema and a replay from empty still works.
 *
 * ── What this file deliberately does NOT do ────────────────────────────────
 *
 * It does not touch quota. `claim_ai_quota` takes `p_kind text` and reads
 * `PLAN_LIMITS`; the LEDGER name and the ALLOWANCE a call spends have always
 * been separate values, and this packet only corrects the former. Moving the
 * allowance would change who is allowed to use packing — a membership decision
 * wearing an accounting change's clothes.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';

export type AiWorkload = Database['public']['Enums']['ai_workload'];

/**
 * What happens when deterministic validation rejects the primary result.
 *
 * `rescue` is the ONLY path on which a second model runs, and it runs after a
 * rejection — never as a review of a result that passed. That distinction is
 * the whole reason this is a policy and not a boolean: "escalate when unsure"
 * and "have a better model check the cheap one" cost the same and mean
 * completely different things about what we believe.
 */
export type ValidatorPolicy = 'strict' | 'rescue' | 'accept';

export type AiSettings = {
  workload: AiWorkload;
  provider: string;
  modelId: string;
  maxTokens: number;
  timeoutMs: number;
  params: Record<string, unknown>;
  enabled: boolean;
  rescueModelId: string | null;
  validatorPolicy: ValidatorPolicy;
  /** False when no row existed and the compiled defaults are in force. */
  configured: boolean;
};

export type AiDefaults = {
  provider?: string;
  modelId: string;
  maxTokens: number;
  timeoutMs: number;
  params?: Record<string, unknown>;
};

/**
 * Read one workload's settings.
 *
 * Never throws. A control plane that can take an endpoint down when the
 * control-plane table is unreachable is worse than no control plane: the
 * failure mode is "every AI feature stops" at exactly the moment the database
 * is already unwell. A read failure falls back to the compiled defaults and
 * says so in the logs.
 */
export async function loadAiSettings(
  admin: SupabaseClient<Database>,
  workload: AiWorkload,
  defaults: AiDefaults,
): Promise<AiSettings> {
  const fallback: AiSettings = {
    workload,
    provider: defaults.provider ?? 'openrouter',
    modelId: defaults.modelId,
    maxTokens: defaults.maxTokens,
    timeoutMs: defaults.timeoutMs,
    params: defaults.params ?? {},
    enabled: true,
    rescueModelId: null,
    validatorPolicy: 'strict',
    configured: false,
  };

  try {
    const { data, error } = await admin
      .from('ai_config')
      .select('provider, model_id, max_tokens, timeout_ms, params, enabled, rescue_model_id, validator_policy')
      .eq('workload', workload)
      .maybeSingle();

    if (error) {
      console.error(`ai_config read failed (workload=${workload}), using defaults: ${error.message}`);
      return fallback;
    }
    if (!data) return fallback;

    return {
      workload,
      provider: data.provider ?? fallback.provider,
      modelId: data.model_id ?? fallback.modelId,
      maxTokens: data.max_tokens ?? fallback.maxTokens,
      timeoutMs: data.timeout_ms ?? fallback.timeoutMs,
      params: (data.params as Record<string, unknown> | null) ?? fallback.params,
      enabled: data.enabled ?? true,
      rescueModelId: data.rescue_model_id ?? null,
      validatorPolicy: (data.validator_policy as ValidatorPolicy | null) ?? 'strict',
      configured: true,
    };
  } catch (err) {
    console.error(`ai_config read threw (workload=${workload}), using defaults:`, err);
    return fallback;
  }
}

/**
 * The marker written to `ai_calls.error` when deterministic validation refused
 * a result the provider returned successfully.
 *
 * A string rather than a column because the shape of the ledger is already
 * right: this IS a failed call from the product's point of view — it produced
 * nothing usable — and `succeeded = false` with a known reason is how every
 * other failure in that table is recorded. It also makes the validator-
 * rejection rate a one-line query rather than a migration.
 */
export const VALIDATOR_REJECTED = 'validator_rejected';

/** The same, for the rescue attempt that was itself rejected. */
export const RESCUE_REJECTED = 'rescue_rejected';
