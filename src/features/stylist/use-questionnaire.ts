import { useCallback, useMemo, useRef, useState } from 'react';

import type { Garment, WeatherContext } from '@/lib/styling';

import {
  buildSteps,
  composeAsk,
  optionLabel,
  type Answers,
  type ComposedAsk,
  type EntryKey,
  type Step,
} from './questionnaire';

/**
 * The questionnaire as a state machine, kept out of the screen.
 *
 * The screen's job is to render bubbles and chips; deciding which question
 * comes next, what a finished flow composes into, and when a flow is abandoned
 * is logic, and logic in a 200-line JSX file is logic nobody can find later.
 *
 * There is no reducer and no context. One run of this is at most four answers
 * that never outlive the sheet, so anything heavier would be machinery for its
 * own sake.
 */

/** One answered step, for rendering the flow back as a conversation. */
export type TranscriptTurn = { key: string; question: string; answer: string };

type Run = {
  entry: EntryKey;
  steps: Step[];
  answers: Answers;
  transcript: TranscriptTurn[];
};

export function useQuestionnaire({
  wardrobe,
  weather,
  temperature,
  onComplete,
}: {
  wardrobe: Garment[];
  weather: WeatherContext | null;
  temperature: string | null;
  onComplete: (composed: ComposedAsk, entry: EntryKey) => void;
}) {
  const [run, setRun] = useState<Run | null>(null);

  /**
   * The same run, readable synchronously.
   *
   * A chip tap has to answer the question that is on screen *now*. Reading the
   * state variable through a closure cannot promise that — two taps inside one
   * frame both see the pre-tap value, which on the last question means
   * `onComplete` fires twice and the person's brief is sent twice. Writing the
   * ref first closes that window, and it is also what lets `answer` stay
   * referentially stable across a run.
   */
  const runRef = useRef<Run | null>(null);

  const commit = useCallback((next: Run | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const ctx = useMemo(
    () => ({ wardrobe, weather, temperature }),
    [wardrobe, weather, temperature],
  );

  /**
   * Open a flow.
   *
   * "Surprise me" and "Just browsing" build no steps, so they complete on the
   * same tap that started them — the flow machinery is skipped rather than run
   * empty, which is why neither ever flashes a question bubble.
   */
  const start = useCallback(
    (entry: EntryKey) => {
      const steps = buildSteps(entry, ctx);
      if (!steps.length) {
        onComplete(composeAsk(entry, {}), entry);
        return;
      }
      commit({ entry, steps, answers: {}, transcript: [] });
    },
    [ctx, commit, onComplete],
  );

  /** Answer the current question and advance, or finish. */
  const answer = useCallback(
    (optionKey: string) => {
      const current = runRef.current;
      if (!current) return;
      const step = current.steps[current.transcript.length];
      if (!step) return;

      const answers: Answers = { ...current.answers, [step.key]: optionKey };
      const transcript = [
        ...current.transcript,
        { key: step.key, question: step.question, answer: optionLabel(step, optionKey) },
      ];

      if (transcript.length < current.steps.length) {
        commit({ ...current, answers, transcript });
        return;
      }

      // Torn down before the request is fired, so the final chip row never
      // renders over the message it just produced.
      commit(null);
      onComplete(composeAsk(current.entry, answers), current.entry);
    },
    [commit, onComplete],
  );

  /** The escape hatch, offered at every step. Answers so far are discarded. */
  const cancel = useCallback(() => commit(null), [commit]);

  const step = run ? (run.steps[run.transcript.length] ?? null) : null;

  return {
    active: run !== null,
    step,
    transcript: run?.transcript ?? [],
    /**
     * Progress, counting the opening tap as the first step.
     *
     * Not a flourish and not a fib — choosing a door genuinely answered a
     * question, and it is the one the whole flow branches on. Counting it means
     * the first real question reads "2 of 5" rather than "1 of 4", which is the
     * endowed-progress effect: Nunes & Drèze gave car-wash customers a 10-stamp
     * card with two stamps already on it against a plain 8-stamp card —
     * identical work — and completion went from 19% to 34%. Finishing is the
     * whole game here, because the IKEA effect only pays out on completion:
     * an abandoned flow buys no attachment at all, just a wasted tap.
     */
    position: run ? run.transcript.length + 2 : 0,
    total: run ? run.steps.length + 1 : 0,
    start,
    answer,
    cancel,
  };
}
