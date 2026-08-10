import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useAnswerBorrow, useFollow } from '@/features/social-graph/mutations';
import { getUserId, supabase } from '@/lib/supabase';

import { activityFeedKey } from './queries';
import type { ActivityActionId, ActivityLine } from './sentence';
import type { ActivityKind } from './types';

/**
 * Answering in place — AV-05's three states of one action.
 *
 * Four verbs, three of which reach the other person and one of which
 * deliberately does not:
 *
 * | Verb            | Write                                    | Is she told? |
 * |-----------------|------------------------------------------|--------------|
 * | Add back        | `follows` insert                         | yes — the closets open |
 * | Not now         | `activity_dismissals` insert             | **no** |
 * | Lend it         | `borrow_requests.status = 'approved'`    | yes |
 * | Not this time   | `borrow_requests.status = 'declined'`    | yes, without a reason |
 *
 * "Not now" and "Not this time" look alike and are not alike, which is the one
 * thing this file exists to keep straight. A friend request has no pending
 * record — `follows` is unilateral and publicly readable — so there is nothing
 * to decline and nothing to transmit; the row simply leaves your page. A borrow
 * request IS pending and somebody is waiting on it, so declining it is the
 * answer she asked for. Their outcome lines say which is which, in words.
 */

export type AnswerState =
  | { status: 'idle' }
  | { status: 'pending'; actionId: ActivityActionId }
  | { status: 'done'; actionId: ActivityActionId }
  | { status: 'failed'; actionId: ActivityActionId };

const IDLE: AnswerState = { status: 'idle' };

/** Does this look like a PostgrestError? Same narrowing as social-graph/mutations.ts. */
function pgCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}

/**
 * "Not now" — the row off your page, and nothing else.
 *
 * Server-side rather than device-local (unlike Lately's mute, which is
 * deliberately per-device) because a row waved off on the phone and back on the
 * iPad is what makes an inbox feel broken. A duplicate is not a failure: the
 * row was already dismissed, so the tap succeeded before it was taken.
 */
export function useDismissActivity() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ kind, subjectKey }: { kind: ActivityKind; subjectKey: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('activity_dismissals')
        .insert({ user_id: me, kind, subject_key: subjectKey });

      if (error) {
        if (pgCode(error) === '23505') return;
        throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activityFeedKey });
    },
  });
}

export interface ActivityAnswers {
  stateOf: (key: string) => AnswerState;
  answer: (line: ActivityLine, actionId: ActivityActionId) => void;
  /**
   * Rows that have been answered and have therefore left the feed. The page
   * merges these back in at their original place — see `retention.ts`.
   */
  retained: ActivityLine[];
}

/**
 * The page's answering machinery.
 *
 * Per-row state rather than the mutations' own `isPending`, because three
 * mutation objects are shared by every row on the page and a shared spinner
 * would light up all of them. A failure leaves the underlying request
 * untouched — none of these writes is partial — so the retry is simply the same
 * call again.
 *
 * `intercept` is the social-terms gate, passed in rather than hooked here: the
 * gate hands back a sheet, and a hook that returns a component is a rule this
 * house does not break. The screen owns the sheet; this owns the decision.
 */
export function useActivityAnswers(options?: {
  intercept?: (error: unknown, retry: () => void, dismiss?: () => void) => boolean;
}): ActivityAnswers {
  const intercept = options?.intercept;

  const follow = useFollow();
  const answerBorrow = useAnswerBorrow();
  const dismiss = useDismissActivity();
  const qc = useQueryClient();

  const [states, setStates] = useState<Record<string, AnswerState>>({});
  const [retained, setRetained] = useState<ActivityLine[]>([]);

  const stateOf = useCallback((key: string) => states[key] ?? IDLE, [states]);

  const answer = useCallback(
    (line: ActivityLine, actionId: ActivityActionId) => {
      const { key, row } = line;

      const settle = (state: AnswerState) =>
        setStates((prev) => ({ ...prev, [key]: state }));

      const succeeded = () => {
        settle({ status: 'done', actionId });
        // Hold the answered row for this visit so it keeps its place and can
        // state its outcome. Guarded against a double-add if the same row is
        // somehow answered twice.
        setRetained((prev) => (prev.some((l) => l.key === key) ? prev : [...prev, line]));
        void qc.invalidateQueries({ queryKey: activityFeedKey });
      };

      const failed = (error: unknown) => {
        // The terms sheet is not a failure: the user has not done anything
        // wrong, they have reached a social write without passing the
        // agreement. `dismiss` clears the row's spinner if they decline.
        //
        // The retry is `run`, not this callback — a `useCallback` that closes
        // over itself is stale by construction, and lint refuses it.
        if (intercept?.(error, run, () => settle(IDLE))) return;
        settle({ status: 'failed', actionId });
      };

      // A function DECLARATION so `failed` above can name it: hoisted within
      // this call, and re-entrant because every retry is the same write again.
      function run() {
        settle({ status: 'pending', actionId });

        switch (actionId) {
          case 'add-back': {
            if (!row.actorId) return settle({ status: 'failed', actionId });
            follow.mutate({ userId: row.actorId }, { onSuccess: succeeded, onError: failed });
            return;
          }
          case 'not-now': {
            dismiss.mutate(
              { kind: row.kind, subjectKey: row.subjectKey },
              { onSuccess: succeeded, onError: failed },
            );
            return;
          }
          case 'lend': {
            // `subjectKey` on a borrow row IS `borrow_requests.id` — the
            // union's one branch with a real single-column identity.
            answerBorrow.mutate(
              { id: row.subjectKey, answer: 'approved' },
              { onSuccess: succeeded, onError: failed },
            );
            return;
          }
          case 'not-this-time': {
            answerBorrow.mutate(
              { id: row.subjectKey, answer: 'declined' },
              { onSuccess: succeeded, onError: failed },
            );
            return;
          }
          default:
            // Destinations navigate; they never come through here.
            settle(IDLE);
        }
      }

      run();
    },
    [answerBorrow, dismiss, follow, intercept, qc],
  );

  return { stateOf, answer, retained };
}
