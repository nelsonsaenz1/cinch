import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from './database.types.ts';

/**
 * Writing one row to `ai_calls`, and noticing when it does not get written.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * Every AI endpoint used to end its provider call with a bare
 * `await admin.from('ai_calls').insert({…})`. PostgREST does not throw on a
 * rejected write — it resolves with `{ error }` — so an unawaited-in-spirit
 * insert like that discards the only evidence that accounting stopped
 * happening. The table is read to answer "what is this costing" and "who is
 * burning the budget"; a silent hole in it is worse than a loud one, because
 * the answer still looks like an answer.
 *
 * That was not a hypothetical. An audit read the table, found it empty, and
 * concluded the inserts were broken — when in fact the probe account that made
 * those calls had been deleted moments later by a `delete-account` test, and
 * `ai_calls.user_id` is `on delete cascade` to `auth.users`. Nothing was
 * failing. But nothing in the code could have told the difference, and that is
 * the actual defect: five call sites that cannot distinguish "wrote a row" from
 * "was refused". This function makes the two distinguishable.
 *
 * ── Why it still never fails the request ───────────────────────────────────
 *
 * Accounting is a side effect of work the user already paid for in latency and
 * tokens. Turning a bookkeeping failure into a 500 would throw away a finished
 * outfit, a written reply, or a completed tag to protect a log line — and it
 * would do so precisely when the database is already unhealthy, which is the
 * worst moment to add a second failure. So: log loudly, return quietly. The
 * full Postgres error goes to `console.error`, which lands in the Edge Function
 * logs where it is greppable, with the workload and user named so a single
 * broken workload is separable from a broken table.
 *
 * The row shape is `Insert` from the generated types, so a column that is
 * renamed or dropped is a compile error at all five call sites rather than a
 * runtime rejection nobody reads.
 */

export type AiCallRow = Database['public']['Tables']['ai_calls']['Insert'];

/**
 * Record one model call. Never throws, never returns a failure the caller has
 * to handle — the return value says whether the row landed, for the rare caller
 * that wants to know.
 */
export async function recordAiCall(
  admin: SupabaseClient<Database>,
  row: AiCallRow,
): Promise<boolean> {
  try {
    const { error } = await admin.from('ai_calls').insert(row);

    if (error) {
      // Every field Postgres gives us. `message` alone routinely omits the
      // column or constraint at fault, and `details`/`hint` are what turn "insert
      // failed" into something fixable without a reproduction.
      console.error(
        `ai_calls insert REJECTED (workload=${row.workload}, user=${row.user_id}): ` +
          `${error.code ?? 'no-code'} ${error.message}` +
          `${error.details ? ` | details: ${error.details}` : ''}` +
          `${error.hint ? ` | hint: ${error.hint}` : ''}`,
      );
      return false;
    }

    return true;
  } catch (err) {
    // A transport-level failure (the client itself throwing, a dead socket)
    // rather than a rejected statement. Same treatment: it must not reach the
    // user, and it must not be invisible.
    console.error(
      `ai_calls insert THREW (workload=${row.workload}, user=${row.user_id}):`,
      err,
    );
    return false;
  }
}
