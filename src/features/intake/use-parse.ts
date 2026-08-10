import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { resolveDraftColours } from './actions';
import { intakeFailed, intakeParsed, type FailureCause } from './analytics';
import { intakeKeys, type IntakeDraftRow } from './queries';

/**
 * use-parse — a transcript becomes a pile of drafts, and the words that didn't.
 *
 * §6: "transcript → drafts, writes intake_drafts." One call to `parse-closet`,
 * which does the actual writing server-side (see that function's own header) —
 * this hook's job is entirely about what happens around that call: turning its
 * error codes into something V-04/V-13 can switch on, resolving the colours
 * `resolveDraftColours` is responsible for, and firing `intakeParsed` exactly
 * once per real parse.
 *
 * IDEMPOTENCE (§7's contract)
 *
 * `parse-closet` is safe to call again for a session already `reviewing` or
 * `committed` — it answers with the existing drafts and `reused: true` instead
 * of re-running the model. That is not an error state; `useParseCloset`'s
 * result carries `reused` so the caller can tell "this is the first time" from
 * "the app came back to a walkthrough that already got this far", which matters
 * for V-04's animation (nothing to precipitate a second time) and for
 * `intakeParsed` (see below — it must not double-count a replay).
 *
 * WHY THIS REFETCHES `intake_drafts` INSTEAD OF TRUSTING THE RESPONSE BODY
 *
 * `parse-closet`'s two branches do not return the same shape. The `reused`
 * branch reads the rows back with `.select('*')`, so its `garments` are real
 * `intake_drafts` rows, `id` included. The fresh-parse branch never re-selects
 * after its `insert(rows)` — it returns the exact plain objects it built for
 * the insert, which never had an `id` or `created_at` to begin with. Building
 * the procession off `data.garments` directly would work today for a resumed
 * session and silently hand every FRESH card an undefined `id` — nothing to
 * key a list by, nothing to save a correction against. A plain `select` after
 * either branch is the only response shape safe to build on, so this hook
 * always re-reads `intake_drafts` itself and never trusts the function's own
 * `garments` array for anything beyond its length.
 *
 * A SECOND CONTRACT GAP, NOT FIXABLE FROM HERE
 *
 * The `reused` branch also always answers `unconsumed: []`, regardless of what
 * the original parse actually left unconsumed — that list only ever existed in
 * the first call's response and is not persisted anywhere (`intake_sessions`
 * has no column for it). A session resumed after the app is killed between
 * parsing and viewing V-05 permanently loses its "three things I didn't catch"
 * text. This hook cannot recover data the server never stored — it reports
 * exactly what `parse-closet` sends back, which on a `reused` reply is
 * genuinely `[]`. Worth a schema note for whoever owns the migration.
 */

// ---------------------------------------------------------------------------
// The error union
// ---------------------------------------------------------------------------

export type ParseFailure =
  /** 409 — `parse-closet` was called before the session had a transcript
   *  written to it. A sequencing bug in the caller (parse invoked before
   *  transcription finished) rather than anything the person did. */
  | { kind: 'no_transcript' }
  /** 404 — no session with this id, or RLS made it invisible, which look
   *  identical from here and are handled identically. */
  | { kind: 'not_found' }
  /** 502 — the model call itself failed or returned a shape that didn't fit
   *  the schema. The transcript survives on the session row either way
   *  (`parse-closet` never clears it on this path), so a retry does not need
   *  the microphone again — only another call to this hook. */
  | { kind: 'parse_failed'; message?: string }
  /** 402 — this plan does not include parsing at all. */
  | { kind: 'quota_upgrade_required'; message: string }
  /** 429 — the plan includes it and this period's allowance is spent. */
  | { kind: 'quota_exceeded'; message: string; retryAfterSeconds: number }
  /** 500 — the model answered but the `intake_drafts` insert failed. Distinct
   *  from `parse_failed` because the expensive half (the model call) already
   *  happened and was already billed against quota; a retry re-parses rather
   *  than merely re-inserting, which is the honest cost of this failure mode
   *  but worth its own tag so it is not confused with a model-side fault. */
  | { kind: 'drafts_unwritable' }
  /** No structured answer came back — `FunctionsFetchError`,
   *  `FunctionsRelayError`, or any network failure between here and Supabase. */
  | { kind: 'offline' }
  /** A recognised HTTP response without one of the codes above — the missing
   *  `OPENROUTER_API_KEY` 500, `bad_request`, `unauthenticated`, or a code this
   *  file has not been taught yet. */
  | { kind: 'service_error'; message?: string };

export class ParseClosetError extends Error {
  constructor(readonly failure: ParseFailure) {
    super(describeFailure(failure));
    this.name = 'ParseClosetError';
  }
}

function describeFailure(failure: ParseFailure): string {
  switch (failure.kind) {
    case 'no_transcript':
      return "Cinch hasn't heard anything for this walkthrough yet.";
    case 'not_found':
      return "Cinch couldn't find that walkthrough.";
    case 'parse_failed':
      return failure.message ?? "I heard you, but couldn't read it back. Your words are still here.";
    case 'quota_upgrade_required':
    case 'quota_exceeded':
      return failure.message;
    case 'drafts_unwritable':
      return "That parse didn't save. Try again.";
    case 'offline':
      return "I can't reach Cinch right now. Your words are still here.";
    case 'service_error':
      return failure.message ?? 'Something went wrong. Your words are still here.';
  }
}

/**
 * Collapse the full-resolution failure into `FailureCause` (`buckets.ts`),
 * mirroring `intake_sessions.error_code`. `no_transcript`, `not_found` and
 * `service_error` have no dedicated bucket — all three mean "the parse could
 * not run", which is what `parse_failed` already means for the one server code
 * that shares its name.
 */
function toFailureCause(failure: ParseFailure): FailureCause {
  switch (failure.kind) {
    case 'drafts_unwritable':
      return 'drafts_unwritable';
    case 'quota_upgrade_required':
    case 'quota_exceeded':
      return 'quota_exhausted';
    case 'offline':
      return 'offline';
    case 'no_transcript':
    case 'not_found':
    case 'parse_failed':
    case 'service_error':
      return 'parse_failed';
  }
}

// ---------------------------------------------------------------------------
// Reading the function's error body
// ---------------------------------------------------------------------------

type ParseErrorBody = {
  error?: string;
  /** Present on the two quota shapes. */
  message?: string;
  /** Present on `ai_quota_exceeded` only. */
  retryAfterSeconds?: number;
};

/** Same idiom as `use-transcription.ts` and `ingest/use-garment-search.ts`. */
async function readHttpError(
  error: unknown,
): Promise<{ status: number | null; body: ParseErrorBody | null }> {
  if (!(error instanceof FunctionsHttpError)) return { status: null, body: null };
  const response = (error as { context?: unknown }).context as Response | undefined;
  if (!response) return { status: null, body: null };
  try {
    return { status: response.status, body: (await response.json()) as ParseErrorBody };
  } catch {
    return { status: response.status, body: null };
  }
}

function classify(status: number | null, body: ParseErrorBody | null): ParseFailure {
  switch (body?.error) {
    case 'no_transcript':
      return { kind: 'no_transcript' };
    case 'not_found':
      return { kind: 'not_found' };
    case 'parse_failed':
    case 'parse_error':
      return { kind: 'parse_failed', message: body?.message };
    case 'plan_upgrade_required':
      return {
        kind: 'quota_upgrade_required',
        message: body?.message ?? 'Reading your closet back needs a plan upgrade.',
      };
    case 'ai_quota_exceeded':
      return {
        kind: 'quota_exceeded',
        message: body?.message ?? "You've used this period's allowance.",
        retryAfterSeconds: body?.retryAfterSeconds ?? 60,
      };
    case 'drafts_unwritable':
      return { kind: 'drafts_unwritable' };
    default:
      return { kind: 'service_error', message: body?.error ?? (status ? `http_${status}` : undefined) };
  }
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/** What `parse-closet` sends back. `garments` is read only for its length —
 *  see the file header on why its contents are not trusted. */
type ParseClosetResponseBody = {
  garments?: unknown[];
  unconsumed?: string[];
  reused?: boolean;
};

export type ParseOutcome = {
  /** Authoritative rows, freshly selected from `intake_drafts` — always has a
   *  real `id`, unlike a fresh parse's own response body. Empty exactly when
   *  V-13's third row applies: transcribed, nothing parsed. */
  drafts: IntakeDraftRow[];
  /** Spans the parse could not turn into a garment. Always `[]` on a `reused`
   *  reply — see the file header's second contract gap. */
  unconsumed: string[];
  reused: boolean;
};

async function fetchDrafts(sessionId: string): Promise<IntakeDraftRow[]> {
  const { data, error } = await supabase
    .from('intake_drafts')
    .select('*')
    .eq('session_id', sessionId)
    .order('ordinal', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Parse a session's transcript into drafts (or fetch the ones already there).
 *
 * Safe to call more than once for the same session — see the file header on
 * idempotence. There is deliberately no separate "resume" entry point: calling
 * this again on a `reviewing`/`committed` session IS the resume path, and
 * giving it a second name would just be two doors to the same room.
 */
export function useParseCloset() {
  const queryClient = useQueryClient();

  return useMutation<ParseOutcome, ParseClosetError, { sessionId: string }>({
    mutationFn: async ({ sessionId }) => {
      const { data, error } = await supabase.functions.invoke<ParseClosetResponseBody>(
        'parse-closet',
        { body: { sessionId } },
      );

      if (error) {
        if (error instanceof FunctionsHttpError) {
          const { status, body } = await readHttpError(error);
          throw new ParseClosetError(classify(status, body));
        }
        throw new ParseClosetError({ kind: 'offline' });
      }

      const unconsumed = data?.unconsumed ?? [];
      const reused = data?.reused === true;

      const fetched = await fetchDrafts(sessionId);

      // resolveDraftColours only touches CONFIRMED drafts with a null colour
      // (actions.ts) — on a fresh parse every draft is still `pending`, so this
      // is a genuine no-op there. It is not a no-op on a `reused` reply for a
      // session the procession had already partway walked before the app was
      // killed: those drafts can be `confirmed` in the database with a colour
      // that was never resolved, because resolution has otherwise only ever
      // run once, right before commit (`commitIntake`). Calling it here closes
      // that gap for a resumed walkthrough instead of leaving it to be closed
      // (or not) whenever the user eventually reaches commit.
      const hadUnresolvedConfirmed = fetched.some(
        (d) => d.state === 'confirmed' && d.colour_oklch === null,
      );
      await resolveDraftColours(fetched).catch(() => {
        // Best-effort, exactly as `commitIntake` treats the same call: a
        // colour that fails to resolve here is resolved again at commit, and a
        // garment is never lost over a hue.
      });

      // Only re-read when there was something to pick up — the common case
      // (a fresh parse, or a reused reply with nothing yet confirmed) needs no
      // second round trip.
      const drafts = hadUnresolvedConfirmed ? await fetchDrafts(sessionId) : fetched;

      return { drafts, unconsumed, reused };
    },

    onSuccess: (outcome, variables) => {
      // Primes the cache `useDrafts` (queries.ts) reads, so the procession
      // screen sees these rows without waiting on its own refetch.
      queryClient.setQueryData(intakeKeys.drafts(variables.sessionId), outcome.drafts);
      // A parse moves the session from `parsing`/`recording` to `reviewing`
      // (or confirms it is already there), which makes the resumable-session
      // query's cached row stale the moment this resolves.
      void queryClient.invalidateQueries({ queryKey: intakeKeys.resumable });

      // Counted once, on the parse that actually did the work. A `reused`
      // reply is a re-render of a call already through this branch — most
      // often a resumed session — and counting it again would inflate
      // `intake_parsed` with replays of the same walkthrough rather than
      // distinct ones (§9's garment-bucket metric is meant to answer "how big
      // are people's closets", not "how many times did the app re-ask").
      if (!outcome.reused) {
        intakeParsed(outcome.drafts.length, outcome.unconsumed.length);
      }
    },

    onError: (err) => {
      intakeFailed(toFailureCause(err.failure));
    },
  });
}
