import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import {
  AnswerGrid,
  Composer,
  OPENING_TOP,
  OpeningSkeleton,
  RefinementRow,
  StepFooter,
  StylistHeader,
  StylistOpening,
  TRANSCRIPT_TOP,
} from '@/components/stylist/sheet-parts';
import { ClosetDidntLoad, ClosetTooSmall } from '@/components/stylist/stylist-states';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { formatTemp } from '@/features/context/weather';
import { greeting, QUICK_STARTS } from '@/features/stylist/opening';
import type { ComposedAsk, EntryKey } from '@/features/stylist/questionnaire';
import { useChat, type ChatMessage } from '@/features/stylist/use-chat';
import { useQuestionnaire } from '@/features/stylist/use-questionnaire';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { track } from '@/lib/posthog';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';

/** Temperatures elsewhere in the app default to Fahrenheit; match them. */
const UNITS = 'F' as const;

/** A scripted turn rendered through the real bubble, so it is indistinguishable. */
const scriptTurn = (id: string, role: ChatMessage['role'], text: string): ChatMessage => ({
  id,
  role,
  text,
  outfits: [],
  followUp: null,
});

/**
 * Stylist — conversational styling, presented as a sheet off Today.
 *
 * Deliberately not a tab: a chat tab is the generic-AI tell, and it duplicates
 * Today's job. As a sheet at 0.75 detent the conversation is an aside laid
 * over the day's edit, not a destination competing with it.
 *
 * The model never receives the closet. Each question is parsed on-device into a
 * styling context, the beam search assembles real outfits for it, and only a
 * shortlist plus a digest goes up. That is what stops the stylist recommending
 * a coat the user does not own — the failure mode that would make the whole
 * feature untrustworthy.
 *
 * OPENING WITH A QUESTION, NOT A BOX. An empty text field asks the person to
 * name what they want, which is the job they opened the stylist to hand over.
 * So the sheet opens with a greeting that already knows the hour and the
 * forecast, four doors, and — behind them — a scripted questionnaire that runs
 * entirely on device. Three or four taps, no model call between them, and the
 * one request that does go up carries a brief instead of a shrug. Typing is
 * still there, at every step, for the people who already know.
 */
export default function StylistScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');

  // Fixed at mount. The sheet is opened, used and dismissed inside a few
  // minutes, and a greeting that re-reads the clock mid-conversation would
  // silently rewrite what the stylist already said.
  const [openedAt] = useState(() => new Date());

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();
  const { context } = useStyleContext();

  const items = wardrobe.data ?? [];
  const profile = profileQuery.data ?? {
    weights: DEFAULT_WEIGHTS,
    affinities: EMPTY_AFFINITIES,
    feedbackCount: 0,
    summary: [],
  };

  const { messages, ask, retry, clear, isSending } = useChat({ wardrobe: items, context, profile });

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || isSending) return;
      void Haptics.selectionAsync().catch(() => {});
      setDraft('');
      void ask(text);
    },
    [ask, isSending],
  );

  /**
   * A finished flow becomes one request.
   *
   * The taps produced both a sentence and a brief; the sentence is what the
   * person sees as their own message and what the on-device parser reads, the
   * brief is what the model is told. `intent` carries the formality and
   * occasion straight from the tapped option so the beam search never has to
   * re-derive by keyword what was already stated outright.
   */
  const onComplete = useCallback(
    (composed: ComposedAsk, entry: EntryKey) => {
      if (composed.brief) {
        // Counts and fixed enums only — never the composed sentence, which is
        // as close to user content as anything the person types.
        track('stylist_questionnaire_completed', {
          steps: composed.steps,
          mood: composed.brief.mood ?? 'none',
          entry,
        });
      }
      void ask(composed.message, { brief: composed.brief, intent: composed.intent });
    },
    [ask],
  );

  const questionnaire = useQuestionnaire({
    wardrobe: items,
    weather: context.weather,
    temperature: context.weather ? formatTemp(context.weather.feelsLikeC, UNITS) : null,
    onComplete,
  });

  /** Abandon the flow and hand the person the keyboard they asked for. */
  const { cancel: cancelQuestionnaire } = questionnaire;
  const escapeToTyping = useCallback(() => {
    cancelQuestionnaire();
    inputRef.current?.focus();
  }, [cancelQuestionnaire]);

  /** "New question" — back to the designed opening, any time, on demand. */
  const startNewQuestion = useCallback(() => {
    cancelQuestionnaire();
    clear();
  }, [cancelQuestionnaire, clear]);

  const hello = useMemo(
    () => greeting({ now: openedAt, weather: context.weather, units: UNITS }),
    [openedAt, context.weather],
  );

  const { resolve } = useSignedUrls(
    messages.flatMap((m) =>
      m.outfits.flatMap((o) => o.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
    ),
  );

  const showOpening = messages.length === 0 && !questionnaire.active;

  /**
   * Whether there is an answer on screen for the refinement chips to refine.
   *
   * "Something warmer" is a follow-up, so it needs something to follow. The row
   * used to be gated on `messages.length > 0 && !questionnaire.active`, and
   * both halves of that were wrong:
   *
   *   - `messages.length > 0` counts the pending placeholder. Finishing the
   *     questionnaire mounts the user's composed sentence AND an empty pending
   *     bubble in one go, so the length is 2 the instant the request goes up and
   *     the chips drew over S-04 — which the atlas draws with no chip row at
   *     all, correctly: the chips would be offering to adjust an answer that
   *     does not exist yet, and tapping one would fire a second request behind
   *     the first.
   *   - `!questionnaire.active` looked like the guard against exactly that and
   *     was not, because `useQuestionnaire.answer` calls `commit(null)` BEFORE
   *     `onComplete`, deliberately (so the last chip row cannot render over the
   *     message it produced). `active` is therefore already false by the time
   *     `ask()` mounts those two bubbles. It is also redundant now: a flow can
   *     only be started from the opening, which requires an empty thread.
   *
   * So the test is a settled assistant turn — pending is the only state that
   * has nothing to refine. A FAILED turn deliberately still counts: S-06 draws
   * the chip row under the failure bubble, and it is right to, because the chips
   * are the other way to ask again beside "Try again" — an outage the retry did
   * not clear may still answer a differently-worded question. That is why this
   * is `!m.pending` and not the narrower "resolved" test of `!m.pending &&
   * !m.failed`, which would have blanked the row in S-06.
   */
  const hasSettledAnswer = messages.some((m) => m.role === 'assistant' && !m.pending);

  // A failed wardrobe fetch is NOT an empty closet. Without this branch the
  // screen fell through to "add about ten pieces first" — telling a user with
  // a full wardrobe to start photographing it again. Hence the order: this
  // guard has to run BEFORE `!canGenerate(items)`, because a failed read
  // leaves `items` empty and would satisfy that test too.
  //
  // The copy now lives with the composition in stylist-states.tsx (S-10), which
  // draws this frame as a centred column rather than in the shared kit's
  // left-aligned grammar. Read that file's docblock before changing either.
  // `ClosetDidntLoad` renders `flex-1`; the SafeAreaView above is the column it
  // centres in, which is why it needs no wrapper.
  if (wardrobe.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <ClosetDidntLoad onRetry={() => void wardrobe.refetch()} retrying={wardrobe.isRefetching} />
      </SafeAreaView>
    );
  }

  // The opening composition, before the wardrobe is in: greeting line, its
  // subline, and the four doors — as bars, in their own places.
  if (wardrobe.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <OpeningSkeleton />
      </SafeAreaView>
    );
  }

  // Reached only once the read SUCCEEDED and came back short — see the ordering
  // note above. Copy and composition are S-09's, in stylist-states.tsx.
  if (!canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <ClosetTooSmall onAddClothes={() => router.push('/capture')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
      <KeyboardAvoidingScreen className="flex-1">
        <StylistHeader onNewQuestion={messages.length > 0 ? startNewQuestion : undefined} />

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="pb-4"
          // Chosen here rather than inside either branch, so the two can never
          // add up — see TRANSCRIPT_TOP / OPENING_TOP for the atlas values. A
          // style rather than a `pt-*` class so those constants can be named at
          // all; it merges with the `pb-4` above rather than replacing it,
          // because the class and the inline object are collected together and
          // these two set different edges.
          contentContainerStyle={{ paddingTop: showOpening ? OPENING_TOP : TRANSCRIPT_TOP }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {showOpening ? (
            <StylistOpening
              salutation={hello.salutation}
              line={hello.line}
              starts={QUICK_STARTS}
              onStart={questionnaire.start}
            />
          ) : null}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              resolveImage={resolve}
              // Today is directly beneath the sheet — dismiss, don't push.
              // The canGoBack guard covers exotic cold-start states where
              // the sheet is somehow the only route.
              onPressOutfit={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)')
              }
              onRetry={() => retry(message.id)}
            />
          ))}

          {/* Answered steps, replayed through the same bubble the model's turns
              use. They are session-only — the composed question is what gets
              persisted, because that is the thing that still makes sense read
              back a week later. */}
          {questionnaire.transcript.map((turn) => (
            <Fragment key={turn.key}>
              <MessageBubble
                message={scriptTurn(`q-${turn.key}`, 'assistant', turn.question)}
                resolveImage={resolve}
              />
              <MessageBubble
                message={scriptTurn(`a-${turn.key}`, 'user', turn.answer)}
                resolveImage={resolve}
              />
            </Fragment>
          ))}

          {questionnaire.step ? (
            <View>
              {/* `flush` — and ONLY here. The atlas puts 12 between the current
                  question and its answers (S-02, S-03), which is what
                  `AnswerGrid` carries; this bubble's own 16pt bottom margin
                  would stack on top of it, because React Native does not
                  collapse margins, and draw 28. The replayed turns above take no
                  `flush`: their 16/18 rhythm is the transcript's own, and it is
                  what makes a scripted pair read like a model one. */}
              <MessageBubble
                message={scriptTurn('q-current', 'assistant', questionnaire.step.question)}
                resolveImage={resolve}
                flush
              />

              <AnswerGrid options={questionnaire.step.options} onAnswer={questionnaire.answer} />

              {/* No wrapper and no margin here: `StepFooter` owns the atlas's
                  18pt offset above itself (S-02, S-03) along with its own row
                  layout. A `marginTop` at this call site would land on top of
                  that one and draw 36. */}
              <StepFooter
                position={questionnaire.position}
                total={questionnaire.total}
                canGoBack={questionnaire.canGoBack}
                onBack={questionnaire.back}
                onType={escapeToTyping}
              />
            </View>
          ) : null}
        </ScrollView>

        {/* On the gate: see `hasSettledAnswer` above — S-04 draws no chip row,
            S-05 and S-06 both do. The row's own geometry, and the fact that a
            chip's label and the sentence it sends are different strings, live
            in `RefinementRow`. */}
        {hasSettledAnswer ? <RefinementRow onRefine={submit} /> : null}

        <Composer
          value={draft}
          onChangeText={setDraft}
          onSend={() => submit(draft)}
          sending={isSending}
          inputRef={inputRef}
        />
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
