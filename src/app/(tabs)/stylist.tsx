import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import {
  AnswerGrid,
  Composer,
  DoorStrip,
  OPENING_TOP,
  OpeningSkeleton,
  StepFooter,
  StylistHeader,
  StylistOpening,
  TRANSCRIPT_TOP,
} from '@/components/stylist/sheet-parts';
import { ClosetDidntLoad, ClosetTooSmall } from '@/components/stylist/stylist-states';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { PressableSurface } from '@/components/ui/pressable-surface';
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
  showsDoorStrip,
  stylistKeyboardOffset,
  type Door,
} from '@/features/stylist/stylist-spec';
import { useChat, type ChatMessage } from '@/features/stylist/use-chat';
import { useQuestionnaire } from '@/features/stylist/use-questionnaire';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { track } from '@/lib/posthog';
import { useTabVisited } from '@/lib/use-tab-visited';
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
 * Stylist — conversational styling, as a tab since 2026-08-20.
 *
 * It opened as a sheet off Today ("a chat tab is the generic-AI tell"), and
 * the founder overruled that in one sentence — "I barely know stylist exists"
 * — so it now holds the centre slot of the bar (see (tabs)/_layout.tsx for
 * the full argument). Being a tab has consequences a sheet never had: the
 * keyboard offset must account for the tab bar, and the transcript must hand
 * the keyboard back on a drag or a tap so the bar underneath stays reachable.
 *
 * The model never receives the closet. Each question is parsed on-device into a
 * styling context, the beam search assembles real outfits for it, and only a
 * shortlist plus a digest goes up. That is what stops the stylist recommending
 * a coat the user does not own — the failure mode that would make the whole
 * feature untrustworthy.
 *
 * OPENING WITH A QUESTION, NOT A BOX. An empty text field asks the person to
 * name what they want, which is the job they opened the stylist to hand over.
 * So the screen opens with a greeting that already knows the hour and the
 * forecast, five doors, and — behind them — a scripted questionnaire that runs
 * entirely on device. Three or four taps, no model call between them, and the
 * one request that does go up carries a brief instead of a shrug. Typing is
 * still there, at every step, for the people who already know. Once a thread
 * exists the doors move to a compact strip under the header, so none of them
 * — /recreate's only app-wide entry included — is ever out of reach.
 */
export default function StylistScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  // False until the transcript has settled at its foot once with real turns in
  // it — the first landing is a jump, everything after is an animation.
  const settledAtFoot = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');

  // Fixed at mount. The sheet is opened, used and dismissed inside a few
  // minutes, and a greeting that re-reads the clock mid-conversation would
  // silently rewrite what the stylist already said.
  const [openedAt] = useState(() => new Date());

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();
  const insets = useSafeAreaInsets();
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
      if (!text.trim()) return;
      if (isSending) {
        // Not silence: the disc is already grey, and this tick says "heard,
        // still working". The refusal is honest now — the send ceiling in
        // use-chat.ts guarantees a pending turn RESOLVES, so this state can
        // no longer be entered forever.
        void Haptics.selectionAsync().catch(() => {});
        return;
      }
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
  // The desk was opened — gated on FOCUS, not mount, because NativeTabs
  // mounts every tab at launch and this used to fire for people who never
  // left Today (see use-tab-visited.ts). Nothing about the person or their
  // closet travels.
  const visited = useTabVisited();
  const platesReported = useRef(new Set<string>());
  const openedOnce = useRef(false);
  useEffect(() => {
    if (!visited || openedOnce.current) return;
    openedOnce.current = true;
    track(STYLIST_EVENTS.opened, openedProps());
  }, [visited]);

  // WHETHER the mark was on screen — never the number behind it, which is an
  // account fact rather than a screen fact. "On screen" now means what it
  // says: nothing is reported until the tab has actually been seen.
  const markReported = useRef<boolean | null>(null);
  useEffect(() => {
    if (!visited || markReported.current === markVisible) return;
    markReported.current = markVisible;
    track(STYLIST_EVENTS.allowanceMarkShown, allowanceMarkShownProps(markVisible));
  }, [visited, markVisible]);

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

  const { resolve } = useSignedUrls([
    // The door garments FIRST — the opening renders with zero messages, and
    // signing only the transcript's outfits left `resolve` empty-handed for
    // every door on every fresh visit: five sand wells where the reader's own
    // clothes belong (founder screenshot, 2026-08-30). One path set per door,
    // the same five pieces `doorCards` below reads.
    ...DOORS.flatMap((_, i) => [
      items[i]?.platePath,
      items[i]?.cutoutPath,
      items[i]?.thumbPath,
    ]),
    ...messages.flatMap((m) =>
      m.outfits.flatMap((o) => o.items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath])),
    ),
  ]);

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
      {/* The offset hands back the safe-area bottom the SafeAreaView already
          spent — inside the native tab controller that inset IS the tab bar's
          overlap, and without this the composer floated a full tab-bar height
          above the keyboard. See `stylistKeyboardOffset` for the whole story;
          this is the app's only docked composer inside the tab navigator. */}
      <KeyboardAvoidingScreen
        className="flex-1"
        keyboardVerticalOffset={stylistKeyboardOffset(insets.bottom)}>
        <StylistHeader onNewQuestion={messages.length > 0 ? startNewQuestion : undefined} />

        {/* The five doors, still one tap away once a thread exists — the
            opening grid below renders only while the thread is empty, which
            used to bury every door (and /recreate's only app-wide entry)
            behind "New question" forever after the first chat. Same
            `openDoor`, so a pill tap fires the same doorTapped index and the
            same local-only actions as its full-size door. */}
        {showsDoorStrip(messages.length) ? <DoorStrip doors={DOORS} onOpen={openDoor} /> : null}

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
          // A tab screen must always hand the keyboard back — the bar under
          // it is unreachable until it goes. Drag dismisses interactively
          // (the sheet era never needed this; the tab does), and `handled`
          // above already lets a tap on the transcript's dead space dismiss.
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            // The designed opening reads from the top; only a transcript
            // follows its own foot.
            if (showOpening) return;
            // An existing thread OPENS at its foot rather than animating down
            // to it — the reader left mid-conversation and should land where
            // they left, not watch the app catch up (founder, 2026-08-26).
            // After that first settle, growth animates as it always did.
            scrollRef.current?.scrollToEnd({ animated: settledAtFoot.current });
            if (messages.length > 0) settledAtFoot.current = true;
          }}>
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
                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel="See plans"
                      onPress={() => void gate.present(Placement.OpenStylist)}
                      hitSlop={8}
                      fill
                      style={{ minHeight: MIN_TAP_TARGET }}
                      contentStyle={{ flex: 1, justifyContent: 'center' }}>
                      <Text variant="label" className="underline" style={{ color: theme.ink }}>
                        See plans
                      </Text>
                    </PressableSurface>
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
