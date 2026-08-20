import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
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
import { Text } from '@/components/ui/text';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { lifestyleOccasion } from '@/features/profile/lifestyle';
import { useLifestyle } from '@/features/profile/use-lifestyle';
import { formatTemp } from '@/features/context/weather';
import { greeting } from '@/features/stylist/opening';
import type { ComposedAsk, EntryKey } from '@/features/stylist/questionnaire';
import {
  STYLIST_EVENTS,
  allowanceMarkShownProps,
  chatSentProps,
  doorTappedProps,
  questionnaireStepProps,
  openedProps,
  plateTappedProps,
  platesShownProps,
  type PlateCount,
  type StepNumber,
} from '@/features/stylist/stylist-analytics';
import {
  DOORS,
  allowanceDisplay,
  allowanceMarkLabel,
  doorIndex,
  showsAllowanceMark,
  type Door,
} from '@/features/stylist/stylist-spec';
import { useChat, type ChatMessage } from '@/features/stylist/use-chat';
import { useQuestionnaire } from '@/features/stylist/use-questionnaire';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { track } from '@/lib/posthog';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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
  const lifestyle = useLifestyle();
  const theme = useTheme();
  const gate = useGate();

  /**
   * THE MEMBERSHIP LINE'S ONE CONDITION, and it fails closed.
   *
   * Until now the only membership signal on this screen fired at send time
   * (`use-chat.ts` presents `OpenStylist`), which is after a free user has
   * walked four doors and a whole questionnaire. Saying it once, up front, is
   * the honest version — but only where it is TRUE, so the plan is `null` while
   * the read is in flight or failed, exactly as Today does for `CapacityNote`.
   * `usePlan` answers `free` in both of those cases, which is the right default
   * for a gate and the wrong one for a sentence.
   */
  const planState = usePlan();
  const knownPlan = planState.loading || planState.unconfirmed ? null : planState.plan;
  const showMembershipLine = knownPlan === 'free' && !planState.trialing;


  // Memoised: a fresh `[]` identity on every render would invalidate the door
  // memo below, which re-signs four images for no reason.
  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  const profile = profileQuery.data ?? {
    weights: DEFAULT_WEIGHTS,
    affinities: EMPTY_AFFINITIES,
    feedbackCount: 0,
    summary: [],
  };

  const {
    messages,
    ask,
    retry,
    clear,
    isSending,
    allowance: serverAllowance,
  } = useChat({ wardrobe: items, context, profile });

  // ── THE QUIET CHATS-LEFT MARK ─────────────────────────────────────────────
  //
  // Rendered from a count THE SERVER SUPPLIED and nothing else.
  // `stylist-chat` now settles each Standard chat against a dedicated
  // reservation and returns `{promiseLimit, successfulUsed, remaining}` on a
  // confirmed success — and on a 429, so the screen that refuses can also say
  // how many are left.
  //
  // The client counts nothing. A number assembled here would be wrong the
  // moment somebody used a second phone, and a wrong allowance is worse than
  // none — it is a promise the server will break.
  //
  // The threshold is against the PROMISE of five, never the enforcement
  // ceiling of eight. Eight is failure and abuse slack: the gap is what keeps
  // five deliverable through a failed call or two, and a mark computed from it
  // would over-promise by three.
  const allowance = allowanceDisplay(serverAllowance?.successfulUsed ?? null);
  const markVisible = showsAllowanceMark({
    plan: knownPlan ?? '',
    planLoading: planState.loading || planState.unconfirmed,
    // Until the server has said, there is nothing to show — which is the same
    // honest silence as before the first chat of the month.
    usageLoading: serverAllowance === null,
    display: allowance,
  });

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || isSending) return;
      void Haptics.selectionAsync().catch(() => {});
      // THAT a question was sent. Never the question — a stylist prompt is
      // somebody describing their own life in their own words, and it is the
      // most sensitive string this app ever holds.
      track(STYLIST_EVENTS.chatSent, chatSentProps());
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
        // ── REPLACED BY THE ALLOWLISTED EVENT — redesign 16 ──────────────
        //
        // This sent `{steps, mood, entry}`. All three were bounded, and two of
        // them were still more than the contract allows: `mood` and `entry`
        // describe what somebody said about their own day, and the accepted
        // allowlist carries HOW FAR they got and nothing about where they were
        // going. A step number answers "do people finish the flow"; a mood
        // answers a question nobody asked.
        track(
          STYLIST_EVENTS.questionnaireStep,
          questionnaireStepProps(Math.min(4, Math.max(1, composed.steps)) as StepNumber),
        );
      }
      void ask(composed.message, { brief: composed.brief, intent: composed.intent });
    },
    [ask],
  );

  const questionnaire = useQuestionnaire({
    wardrobe: items,
    weather: context.weather,
    temperature: context.weather ? formatTemp(context.weather.feelsLikeC, UNITS) : null,
    // The lifestyle profile's occasions, so "What is the day asking for?"
    // offers Class or Game day to the person who actually has those days.
    lifestyleOccasions: lifestyle.occasions,
    onComplete,
  });

  /**
   * A door tap. LOCAL, always — nothing here reaches a model.
   *
   * `questionnaire` doors open the existing on-device step flow; `compose`
   * doors seed the composer and hand over the keyboard, because three of the
   * four need a noun only the owner can supply — which trip, which piece,
   * which question — and a door that guessed would be inventing the very thing
   * this screen refuses to invent.
   */
  // The desk was opened. Nothing about the person or their closet travels.
  const platesReported = useRef(new Set<string>());
  const openedOnce = useRef(false);
  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    track(STYLIST_EVENTS.opened, openedProps());
  }, []);

  // WHETHER the mark was on screen — never the number behind it, which is an
  // account fact rather than a screen fact.
  const markReported = useRef<boolean | null>(null);
  useEffect(() => {
    if (markReported.current === markVisible) return;
    markReported.current = markVisible;
    track(STYLIST_EVENTS.allowanceMarkShown, allowanceMarkShownProps(markVisible));
  }, [markVisible]);

  /**
   * How many plates a settled reply drew.
   *
   * A property of the REPLY, capped at three — it is not a wardrobe size and
   * cannot be read as one. Reported once per turn, keyed by the message, so a
   * re-render is silent.
   */
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== 'assistant' || m.pending || m.failed) continue;
      if (platesReported.current.has(m.id)) continue;
      platesReported.current.add(m.id);
      const count = Math.min(3, m.outfits.length) as PlateCount;
      track(STYLIST_EVENTS.platesShown, platesShownProps(count));
    }
  }, [messages]);

  const openDoor = useCallback(
    (key: Door['key']) => {
      const door = DOORS.find((d) => d.key === key);
      if (!door) return;
      // WHICH door, by position. Never its label, and never its intent text.
      track(STYLIST_EVENTS.doorTapped, doorTappedProps(doorIndex(key)));
      void Haptics.selectionAsync().catch(() => {});
      if (door.action.kind === 'questionnaire') {
        questionnaire.start(door.action.entry);
        return;
      }
      if (door.action.kind === 'route') {
        // A flow whose input is a photograph, not a sentence — it lives on
        // its own screen. Still local on the tap: the recreate screen spends
        // its allowance only when a photo is actually submitted.
        router.push(door.action.href as Href);
        return;
      }
      setDraft(door.action.seed);
      inputRef.current?.focus();
    },
    [questionnaire, setDraft, router],
  );

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
    () =>
      greeting({
        now: openedAt,
        weather: context.weather,
        units: UNITS,
        // Display labels in the person's own selection order — the opening
        // can ask "Class today, or going out?" instead of the stock line.
        lifestyleLabels: lifestyle.occasions
          .map((key) => lifestyleOccasion(key)?.label)
          .filter((l): l is string => Boolean(l)),
      }),
    [openedAt, context.weather, lifestyle.occasions],
  );

  const { resolve } = useSignedUrls(
    messages.flatMap((m) =>
      m.outfits.flatMap((o) => o.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
    ),
  );

  /**
   * The doors, each wearing a piece the reader already owns.
   *
   * Drawn from the wardrobe already in memory and already signed for this
   * screen — never a stock photograph, an illustration or a product shot. A
   * stylist that decorates itself with clothes you do not own has broken its
   * promise before you tap anything. With too few pieces the wells are simply
   * empty, which is the same neutral ground every unresolvable image takes.
   */
  const doorCards = useMemo(
    () =>
      DOORS.map((door, i) => ({
        key: door.key,
        label: door.label,
        hint: door.hint,
        imageUri: resolve(
          items[i]?.platePath,
          items[i]?.cutoutPath,
          items[i]?.thumbPath,
        ),
      })),
    [items, resolve],
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
   * `onComplete`, deliberately (so the last chip row cannot render over the
   *     message it produced). `active` is therefore already false by the time
   * `ask()` mounts those two bubbles. It is also redundant now: a flow can
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
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
        <StylistHeader />
        <ClosetDidntLoad onRetry={() => void wardrobe.refetch()} retrying={wardrobe.isRefetching} />
      </SafeAreaView>
    );
  }

  // The opening composition, before the wardrobe is in: greeting line, its
  // subline, and the four doors — as bars, in their own places.
  if (wardrobe.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
        <StylistHeader />
        <OpeningSkeleton />
      </SafeAreaView>
    );
  }

  // Reached only once the read SUCCEEDED and came back short — see the ordering
  // note above. Copy and composition are S-09's, in stylist-states.tsx.
  if (!canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
        <StylistHeader />
        <ClosetTooSmall onAddClothes={() => router.push('/add-clothes')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
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
              starts={doorCards}
              onStart={openDoor}
              footer={
                markVisible && allowance ? (
                  // A MARK, NOT A COUNTER. One quiet line in the back half of
                  // the allowance — no badge, no ring, no countdown from five,
                  // and nothing that turns five chats into a game worth
                  // rationing. It never appears while entitlement or usage is
                  // loading, because a mark that arrives and then corrects
                  // itself is worse than one that arrives late.
                  <Text variant="note">{allowanceMarkLabel(allowance.remaining)}</Text>
                ) : showMembershipLine ? (
                  // One line, no price, no chat count, no accent — the header's
                  // oxblood sparkle stays this screen's only accent, and the
                  // doors above remain fully usable because nothing here gates
                  // anything. It states where the stylist lives and opens the
                  // same door `use-chat.ts` would have opened later.
                  <View className="flex-row flex-wrap items-center" style={{ columnGap: 10 }}>
                    <Text variant="note" style={{ flexShrink: 1 }}>
                      Stylist is part of membership.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="See plans"
                      onPress={() => void gate.present(Placement.OpenStylist)}
                      hitSlop={8}
                      style={{ minHeight: MIN_TAP_TARGET }}
                      className="justify-center active:opacity-60">
                      <Text variant="label" className="underline" style={{ color: theme.ink }}>
                        See plans
                      </Text>
                    </Pressable>
                  </View>
                ) : null
              }
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
              onPressOutfit={() => {
                // THAT a plate was opened. Never which garment.
                track(STYLIST_EVENTS.plateTapped, plateTappedProps());
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              }}
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
