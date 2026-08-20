import { useCallback, useMemo, useRef, useState } from 'react';

import type { Garment, WeatherContext } from '@/lib/styling';

import {
  buildSteps,
  composeAsk,
  optionLabel,
  type Answers,
  type ComposedAsk,
  type EntryKey,
  type QuestionnaireContext,
  type Step,
  type StepKey,
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
  lifestyleOccasions,
  onComplete,
}: {
  wardrobe: Garment[];
  weather: WeatherContext | null;
  temperature: string | null;
  /** `profiles.dress_occasions` — personalises the day question's options. */
  lifestyleOccasions?: string[];
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

  /**
   * The two nullable props, re-paired into the one shape `buildSteps` accepts.
   *
   * The screen hands down the forecast and its formatted temperature as separate
   * values, and nothing in their types says they are always null together — only
   * the caller's `weather ? formatTemp(...) : null` does, which the compiler
   * cannot see. Correlating them once here is what lets `buildSteps` and the
   * weather line it composes be total: no forecast reaches them without the
   * reading that step has to name, so neither needs a fallback that would have
   * to invent a temperature in the wrong unit.
   */
  const ctx = useMemo<QuestionnaireContext>(
    () =>
      weather && temperature
        ? { wardrobe, weather, temperature, lifestyleOccasions }
        : { wardrobe, weather: null, temperature: null, lifestyleOccasions },
    [wardrobe, weather, temperature, lifestyleOccasions],
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

  /**
   * Undo the most recent answer and re-ask its question.
   *
   * Mirrors `back` in `use-trip-questionnaire.ts`, but that flow holds an index
   * it can decrement and this one has none — position is derived from
   * `transcript.length` — so going back means popping the last turn and
   * forgetting the answer it recorded, which is exactly what re-showing that
   * step needs to be true.
   */
  const back = useCallback(() => {
    const current = runRef.current;
    if (!current || !current.transcript.length) return;
    const lastTurn = current.transcript[current.transcript.length - 1]!;
    const answers = { ...current.answers };
    delete answers[lastTurn.key as StepKey];
    commit({ ...current, answers, transcript: current.transcript.slice(0, -1) });
  }, [commit]);

  const step = run ? (run.steps[run.transcript.length] ?? null) : null;

  return {
    active: run !== null,
    step,
    transcript: run?.transcript ?? [],
    canGoBack: (run?.transcript.length ?? 0) > 0,
    /**
     * Progress through the scripted questions, and nothing else.
     *
     * Both numbers are read off `steps`, which `buildSteps` fixed before the
     * first bubble was drawn, so "1 of 4" is a promise the flow can keep rather
     * than a total that grows as the person taps.
     *
     * The opening door is deliberately not counted. Padding the total with it
     * buys a little endowed progress, but it costs the one thing the counter is
     * for: the person is asked four questions and is told there are five, and a
     * count that does not match what is on screen is how a progress indicator
     * stops being believed. Honesty about the remaining work is what makes the
     * number worth showing at all.
     */
    position: run ? run.transcript.length + 1 : 0,
    total: run ? run.steps.length : 0,
    start,
    answer,
    back,
    cancel,
  };
}
