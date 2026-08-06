import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
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
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Temperatures elsewhere in the app default to Fahrenheit; match them. */
const UNITS = 'F' as const;

/**
 * The sheet's header: a small oxblood-tinted mark, the serif name, and the
 * promise that keeps the feature trustworthy — stated plainly, every time.
 * `pt-5` clears the native sheet grabber; the hairline hands off to the
 * message list the way a card's rule hands off to its body.
 *
 * This mark is the screen's single accent. Everything below it — the opening
 * chips, the questionnaire answers — is drawn in hairline and ink, which is
 * what lets one small red circle still read as the app's voice speaking.
 */
function StylistHeader() {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3 border-b border-hairline px-gutter pb-3 pt-5 dark:border-hairline-dark">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-light">
        <SymbolView name="sparkles" size={15} tintColor={theme.accent} resizeMode="scaleAspectFit" />
      </View>
      <View>
        <Text variant="plate" trim accessibilityRole="header">
          Stylist
        </Text>
        <Text variant="caption" className="mt-0.5 text-faint dark:text-faint-dark">
          Only your clothes — nothing invented
        </Text>
      </View>
    </View>
  );
}

/**
 * A tappable answer.
 *
 * Its own component rather than the shared `Chip` for one reason: `Chip` buys
 * its 44pt target with `hitSlop`, which is right for a single row of filters
 * and wrong here, where answers wrap onto two or three lines and neighbouring
 * slop regions would overlap into each other. This one is 44pt of real
 * geometry, so a wrapped grid of them stays honest about what was tapped.
 */
function AnswerChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: MIN_TAP_TARGET }}
      className="justify-center rounded-chip border border-rule px-4 active:opacity-60 dark:border-rule-dark">
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/** A full-width opening door. Wider than an answer because it is a decision. */
function StartRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: MIN_TAP_TARGET }}
      className="justify-center rounded-md border border-hairline px-4 py-3 active:opacity-60 dark:border-hairline-dark">
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

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
  const theme = useTheme();
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

  const { messages, ask, retry, isSending } = useChat({ wardrobe: items, context, profile });

  const scrollSoon = useCallback(() => {
    // Let the new bubble mount before scrolling to it.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || isSending) return;
      setDraft('');
      void ask(text);
      scrollSoon();
    },
    [ask, isSending, scrollSoon],
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
      scrollSoon();
    },
    [ask, scrollSoon],
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

  // A failed wardrobe fetch is NOT an empty closet. Without this branch the
  // screen fell through to "add about ten pieces first" — telling a user with
  // a full wardrobe to start photographing it again.
  if (wardrobe.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <ErrorState
          title="Your closet didn't load."
          body="The stylist only answers with clothes you actually own, so it needs to read them first. Your closet hasn't changed — this is a connection problem."
          onRetry={() => void wardrobe.refetch()}
          retrying={wardrobe.isRefetching}
        />
      </SafeAreaView>
    );
  }

  // The opening composition, before the wardrobe is in: greeting line, its
  // subline, and the four doors — as bars, in their own places.
  if (wardrobe.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <View accessibilityLabel="Reading your wardrobe" className="px-gutter pt-6">
          <Skeleton className="h-6 w-44 rounded-chip" />
          <Skeleton className="mt-4 h-3.5 w-4/5 rounded-chip" />
          <View className="mt-7 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
        <StylistHeader />
        <EmptyState
          symbol="bubble.left.and.bubble.right"
          title="Ask for anything"
          body="Dinner at 7 and drinks after? A trip to pack for? Add about ten pieces first — the stylist only ever answers with clothes you actually own."
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
      <KeyboardAvoidingScreen className="flex-1">
        <StylistHeader />

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="pb-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {showOpening ? (
            <View className="px-gutter pt-6">
              <Text variant="title" trim>
                {hello.salutation}
              </Text>
              <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
                {hello.line}
              </Text>

              <View className="mt-7 gap-2">
                {QUICK_STARTS.map((start) => (
                  <StartRow
                    key={start.key}
                    label={start.label}
                    onPress={() => questionnaire.start(start.key)}
                  />
                ))}
              </View>

              <Text variant="caption" className="mt-5">
                Or just say it — the stylist answers with clothes you own, and says so when
                you do not own the right thing.
              </Text>
            </View>
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
              onRetry={() => {
                retry(message.id);
                scrollSoon();
              }}
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
              <MessageBubble
                message={scriptTurn('q-current', 'assistant', questionnaire.step.question)}
                resolveImage={resolve}
              />

              <View className="flex-row flex-wrap gap-2 px-gutter">
                {questionnaire.step.options.map((option) => (
                  <AnswerChip
                    key={option.key}
                    label={option.label}
                    onPress={() => questionnaire.answer(option.key)}
                  />
                ))}
              </View>

              <View className="mt-4 flex-row items-center justify-between px-gutter">
                <Text variant="eyebrow">
                  {questionnaire.position} of {questionnaire.total}
                </Text>
                <Pressable
                  onPress={escapeToTyping}
                  accessibilityRole="button"
                  accessibilityHint="Closes the questions and opens the keyboard"
                  hitSlop={12}>
                  <Text variant="label" className="underline">
                    I&rsquo;ll just type
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {messages.length > 0 && !questionnaire.active ? (
          <View className="flex-row flex-wrap gap-2 px-gutter pb-2">
            <Chip label="Something warmer" onPress={() => submit('Something warmer')} />
            <Chip label="Dressier" onPress={() => submit('A bit dressier')} />
            <Chip label="More casual" onPress={() => submit('More casual')} />
          </View>
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-hairline px-gutter pb-2 pt-3 dark:border-hairline-dark">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit(draft)}
            // The placeholder does the job a feature tour would: it shows the
            // one question nothing else on the market can answer.
            placeholder="Dinner at 7, drinks after…"
            placeholderTextColor={theme.muted}
            multiline
            textAlignVertical="top"
            returnKeyType="send"
            blurOnSubmit
            accessibilityLabel="Ask the stylist"
            style={{ maxHeight: 110 }}
            // `font-body text-callout` — the same computed, floor-safe line
            // height every other field carries (src/theme/font-metrics.js).
            // The bare `text-ink` this used to carry set colour only, leaving
            // the box sized off RN's undocumented default TextInput font.
            className="flex-1 rounded-full border border-rule bg-surface px-4 py-2.5 font-body text-callout text-ink dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          />
          <Pressable
            onPress={() => submit(draft)}
            disabled={!draft.trim() || isSending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
            className={`items-center justify-center rounded-full ${
              draft.trim() && !isSending
                ? 'bg-ink dark:bg-ink-dark'
                : 'bg-tray dark:bg-tray-dark'
            }`}>
            <SymbolView
              name="arrow.up"
              size={17}
              tintColor={draft.trim() && !isSending ? theme.canvas : theme.muted}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
