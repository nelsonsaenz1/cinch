import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, type RefObject } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useTheme } from '@/theme/tokens';

import {
  useMatchFlow,
  useMatchSubject,
  type MatchCandidate,
  type MatchFailure,
  type MatchSubject,
} from './use-match';

/**
 * Finding the listing photo — the shop's own product shot for a garment the
 * user already photographed. Built to the Match & Confirm state atlas, M-04
 * through M-09.
 *
 * The sheet's one promise is that nothing changes until a person says so: the
 * search runs the moment it opens, the candidates are offered as pictures that
 * might be the listing, and the item is untouched until the confirm step lands.
 * Every state carries the quiet exit — "Keep my photo" — because the
 * photograph they took is never the failure case here; it is the thing that
 * already works, and no sentence on any of these screens is allowed to describe
 * it as the thing that was wrong.
 *
 * ONE OXBLOOD ACTION PER SCREEN, which is the atlas's own closing rule (M-12)
 * and the reason two things below are drawn in ink rather than accent. The
 * candidates screen spends its oxblood on "Use this photo"; the confirm screen
 * spends it on "Yes, use this photo". Nothing else on either is accent.
 *
 * Presented as a `Modal` pageSheet, the grammar `GarmentSearchSheet` and the
 * profile sheets already use for a self-contained flow. Route-level `formSheet`
 * would mean registering the screen in app/_layout.tsx, which belongs to other
 * work; a component sheet needs nothing outside this feature.
 */

/** The card, the tile and every labelled control: 12px, never a capsule. */
const RADIUS = 12;

/** How far the selection ring sits outside the card it rings. */
const RING_INSET = 3;

/** The atlas's own breathe cycle — .5 → .95 → .5 over 1.8s. */
const BREATHE_MS = 1800;

/** One stagger step between the four waiting tiles. */
const BREATHE_STAGGER_MS = 300;

/** Four tiles, in the grid's own 2-up geometry. */
const WAIT_TILES = [0, 1, 2, 3] as const;

/**
 * Small counts are spelled, because the sentence around them is prose.
 *
 * The atlas writes "Six close listings"; the function is free to return fewer,
 * and printing "Six" over five pictures would be the screen's first small lie.
 */
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'] as const;

function listingCount(count: number): string {
  const word = COUNT_WORDS[count] ?? String(count);
  return `${word} close listing${count === 1 ? '' : 's'}. Pick one, or keep your photograph.`;
}

/**
 * When the allowance comes back, as a date rather than a duration.
 *
 * `_shared/quota.ts` sends `retryAfterSeconds`, so the date is the server's own
 * arithmetic rather than this screen's guess about when a month turns over.
 * Null when the body carried no figure — a reset the app cannot name is left
 * unnamed rather than approximated.
 */
function resetsOn(retryAfterSeconds: number | null): string | null {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return null;
  const when = new Date(Date.now() + retryAfterSeconds * 1000);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function MatchSheet({
  visible,
  itemId,
  onClose,
}: {
  visible: boolean;
  itemId: string;
  onClose: () => void;
}) {
  const flow = useMatchFlow(itemId);
  // Read while the sheet is closed as well as open: the closet query is already
  // in cache behind this modal, and signing the photograph before the confirm
  // step needs it means the small "Kept" tile is there the moment it is asked
  // for rather than fading in under a sentence promising it was kept.
  const subject = useMatchSubject(itemId);

  // The search starts when the sheet opens — there is nothing to type first,
  // the item itself is the query. Keyed on `visible` alone, deliberately:
  // `start` closes over the mutations, whose identity changes on every state
  // transition they make, and listing it would clear results as they arrive.
  useEffect(() => {
    if (visible) flow.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <MatchSheetBody flow={flow} subject={subject} onClose={onClose} />
    </Modal>
  );
}

/** The flow object the body renders from — posable, same split as the describe sheet. */
export type MatchFlowView = ReturnType<typeof useMatchFlow>;

/**
 * Everything inside the modal, taking the flow and the subject as props rather
 * than owning them, so a fixture can pose every state without a search running.
 */
export function MatchSheetBody({
  flow,
  subject,
  onClose,
}: {
  flow: MatchFlowView;
  subject: MatchSubject;
  onClose: () => void;
}) {
  if (flow.step === 'confirm' && flow.selected) {
    return <ConfirmStep flow={flow} subject={subject} listing={flow.selected} onClose={onClose} />;
  }
  return <CandidatesStep flow={flow} subject={subject} onClose={onClose} />;
}

/**
 * M-04, M-05, M-06, M-07 and the M-09 failures — everything before the confirm
 * step, which is one screen whose middle changes rather than five screens.
 *
 * The header does not change size between the wait and the candidates: those
 * two states are a second apart, and an eyebrow that re-sets itself as the
 * results land reads as the page reflowing rather than as the page filling.
 */
function CandidatesStep({
  flow,
  subject,
  onClose,
}: {
  flow: MatchFlowView;
  subject: MatchSubject;
  onClose: () => void;
}) {
  const brandField = useRef<TextInput | null>(null);

  const candidates = flow.candidates;
  const hasCandidates = candidates !== null && candidates.length > 0;
  const cameBackEmpty = candidates !== null && candidates.length === 0 && !flow.searching;
  // The first search, with nothing on screen to keep. A re-search is a
  // different state: it dims the grid it already has and holds its geometry.
  const waiting = flow.searching && candidates === null && !flow.failure;
  const reSearching = flow.searching && candidates !== null;
  const failed = Boolean(flow.failure) && !flow.searching;

  // Refinement is a way FORWARD, so it appears wherever there is a result to
  // refine or an empty answer to argue with — never over the first wait, where
  // re-running a search already in flight would double-spend the allowance,
  // and never over a failure, whose own state already offers the way on.
  const showRefinement = !waiting && !failed && candidates !== null;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      {/* The circular back control the atlas draws on M-05. It is on the wait
          too, where the atlas draws none: a search that cannot be left is a
          search somebody is trapped in, and the label says what leaving means
          rather than merely naming the gesture. */}
      <ScreenHeader
        align="leading"
        title={waiting ? 'Looking' : 'Listing photo'}
        onBack={onClose}
        backLabel="Keep my photo"
      />

      <ScrollView
        contentContainerClassName="px-gutter pb-8 pt-3.5"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {waiting ? <WaitState flow={flow} subject={subject} /> : null}

        {failed && flow.failure ? (
          <FailureFrame failure={flow.failure} onRetry={flow.retry} />
        ) : null}

        {cameBackEmpty ? (
          <NothingClose
            noun={subject.noun}
            onTryBrand={() => brandField.current?.focus()}
            onKeep={onClose}
          />
        ) : null}

        {hasCandidates && flow.lookalike ? (
          <LookalikeWarning
            brand={flow.scopedBrand ?? flow.activeBrand ?? subject.brandGuess}
            noun={subject.noun}
            plural={subject.plural}
          />
        ) : null}

        {hasCandidates && !flow.lookalike ? (
          <View>
            <Text variant="title" trim>
              Is one of these your {subject.noun}?
            </Text>
            <Text variant="label" className="mt-3">
              {listingCount(candidates.length)}
            </Text>
          </View>
        ) : null}

        {hasCandidates ? (
          <CandidateGrid
            candidates={candidates}
            selected={flow.selected}
            lookalike={flow.lookalike}
            dimmed={reSearching}
            onChoose={flow.choose}
            className="mt-4"
          />
        ) : null}

        {showRefinement ? (
          <BrandRefinement flow={flow} subject={subject} fieldRef={brandField} />
        ) : null}
      </ScrollView>

      {hasCandidates ? (
        // The screen's ONE oxblood, pinned rather than scrolled: the atlas's
        // footer bar. Disabled WITH A REASON, which is why it takes the sand
        // tone instead of a 40% ghost — the sentence under it is at full
        // strength and a dimmed pill above a solid explanation reads as two
        // different levels of switched-off.
        <View className="border-t border-hairline bg-canvas px-gutter pb-2 pt-4">
          <Button
            title="Use this photo"
            onPress={flow.toConfirm}
            disabled={!flow.selected}
            disabledTone="filled"
            haptic
            className="self-stretch"
          />
          <Text variant="label" className="mt-2.5 text-center">
            Choose a listing, or keep your photograph.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * M-04 — the wait.
 *
 * The piece described in the app's own words over the shape of the grid that is
 * about to fill: the one honest thing there is to say while a web search runs.
 * No percentage, no spinner, no stages counting up, because none of those would
 * be measuring anything.
 */
function WaitState({ flow, subject }: { flow: MatchFlowView; subject: MatchSubject }) {
  const theme = useTheme();
  const scope = flow.activeBrand ?? subject.brandGuess;
  const searching = flow.activeBrand
    ? `Searching ${flow.activeBrand} only.`
    : scope
      ? `Searching ${scope} and the wider web.`
      : 'Searching the wider web.';

  return (
    <View accessibilityLabel={`Looking for listing photos of your ${subject.noun}`}>
      <Text variant="title" trim>
        Reading your {subject.noun}
      </Text>
      {/* Inline colour, never a second `text-*` class — `body` already carries
          `text-ink`, and two colour utilities on one element resolve by key
          order in tailwind.config.js rather than by intent. */}
      <Text variant="body" className="mt-3" style={{ color: theme.muted }}>
        {subject.description}. {searching}
      </Text>

      <View className="mt-5 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {WAIT_TILES.map((index) => (
          <View key={index} style={{ width: '50%', padding: 6 }}>
            <BreathingTile delay={index * BREATHE_STAGGER_MS} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One waiting tile, breathing.
 *
 * Not `Skeleton`: that primitive is a highlight band sweeping across a cell,
 * and the atlas draws a flat tray tile whose opacity rises and falls on a
 * stagger. The Reduce Motion guard is copied from it exactly, though — the
 * pulse is what the setting asks to lose, so the tile parks in the middle of
 * its own travel and keeps the soft depth that says "placeholder", rather than
 * freezing at whichever end of the cycle it happened to be on.
 */
function BreathingTile({ delay }: { delay: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.95, { duration: BREATHE_MS / 2, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    // A loop with -1 repetitions outlives its component unless it is told not
    // to, and this grid is replaced the moment the candidates land.
    return () => cancelAnimation(pulse);
  }, [delay, pulse, reduced]);

  // NativeWind's interop is not registered for Reanimated's wrappers, so every
  // value here is an inline style — a className on this element would silently
  // do nothing.
  const breathing = useAnimatedStyle(() => ({ opacity: reduced ? 0.72 : pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: '100%', aspectRatio: 4 / 5, borderRadius: RADIUS, backgroundColor: theme.tray },
        breathing,
      ]}
    />
  );
}

/**
 * M-05 and M-06 — a lookbook page, not a results list.
 *
 * `dimmed` is the re-search state (M-07): the grid holds its geometry at 60%
 * while the scoped results arrive, rather than collapsing back to a skeleton
 * the user has already sat through.
 */
function CandidateGrid({
  candidates,
  selected,
  lookalike,
  dimmed,
  onChoose,
  className = '',
}: {
  candidates: MatchCandidate[];
  selected: MatchCandidate | null;
  lookalike: boolean;
  dimmed: boolean;
  onChoose: (candidate: MatchCandidate) => void;
  className?: string;
}) {
  return (
    <View
      className={`flex-row flex-wrap ${className}`}
      style={{ marginHorizontal: -6, opacity: dimmed ? 0.6 : 1 }}
      accessibilityLabel={dimmed ? 'Searching again' : undefined}>
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.imageUrl}
          candidate={candidate}
          selected={selected?.imageUrl === candidate.imageUrl}
          faded={selected !== null && selected.imageUrl !== candidate.imageUrl}
          lookalike={lookalike}
          disabled={dimmed}
          onPress={() => onChoose(candidate)}
        />
      ))}
    </View>
  );
}

/**
 * One candidate — the retailer's photograph large and on white, the title and
 * source set beneath it as a catalogue caption. No price, no rating, no buy
 * link: this is a picture being identified, not a product being sold.
 *
 * `contentFit="contain"` on a white ground, never `cover`. A listing shot is a
 * garment floating on white with its own margins, and cropping one to fill a
 * square cuts the sleeves off the exact detail somebody is trying to recognise.
 *
 * Selection is three quiet signals — a 1.5px oxblood border, a soft oxblood
 * ring outside it, a check disc in the image's corner — so the photograph
 * itself is never tinted or dimmed. The one being judged has to stay the
 * easiest one to judge.
 */
function CandidateCard({
  candidate,
  selected,
  faded,
  lookalike,
  disabled,
  onPress,
}: {
  candidate: MatchCandidate;
  selected: boolean;
  faded: boolean;
  lookalike: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colophon = lookalike ? `${candidate.source} · lookalike` : candidate.source;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${candidate.title}, ${colophon}`}
      accessibilityHint={selected ? 'Clears this choice' : 'Chooses this listing'}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: '50%', padding: 6 }}
      className="active:opacity-80">
      <View
        className="overflow-hidden bg-surface"
        style={{
          borderRadius: RADIUS,
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? theme.accent : theme.rule,
          opacity: faded ? 0.72 : 1,
        }}>
        <View className="bg-surface" style={{ aspectRatio: 1, padding: 10 }}>
          <Image
            source={stableImageSource(candidate.imageUrl)}
            recyclingKey={candidate.imageUrl}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
          {selected ? (
            <View
              className="absolute items-center justify-center"
              style={{
                top: 10,
                right: 10,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: theme.accent,
              }}>
              <SymbolView
                name="checkmark"
                size={11}
                tintColor={theme.canvas}
                weight="semibold"
                resizeMode="scaleAspectFit"
              />
            </View>
          ) : null}
        </View>

        <View className="border-t border-hairline px-3 pb-3 pt-2.5">
          {/* Inline colour, never a second `text-*` class: `label` already
              carries `text-muted`, and NativeWind resolves two colour
              utilities on one element by key order rather than by intent. */}
          <Text variant="label" numberOfLines={2} style={{ color: theme.ink }}>
            {candidate.title}
          </Text>
          {/* The honesty line, as everywhere a found picture appears: it came
              from somewhere, and the user gets to judge whether that somewhere
              is the right shop. */}
          <Text variant="colophon" numberOfLines={1} className="mt-1">
            {colophon}
          </Text>
        </View>
      </View>

      {/* The soft ring, drawn as a sibling rather than a border on the card: a
          border would move the picture inside it, and the ring has to appear
          and disappear without the tile changing size. Accent at 10%, composed
          from the token so no oxblood hex is typed here. */}
      {selected ? (
        <View
          pointerEvents="none"
          className="absolute"
          style={{
            top: RING_INSET,
            left: RING_INSET,
            right: RING_INSET,
            bottom: RING_INSET,
            borderRadius: RADIUS + RING_INSET,
            borderWidth: RING_INSET,
            borderColor: `${theme.accent}1A`,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * M-07 — narrowing the search to one brand.
 *
 * THE ATLAS CONTRADICTS ITSELF HERE, AND ITS RULE WINS OVER ITS RENDERING.
 * M-07 draws the selected chip filled in oxblood; M-12 states the closing rule
 * as "One oxblood action per screen and never two", and this screen has already
 * spent its oxblood on "Use this photo" in the footer bar. A row of accent
 * chips above an accent button is a screen spending its one action colour three
 * or four times, and the chips are not the action — the button is. So the
 * selected chip is ink. Where an atlas's stated principle and its own pixels
 * disagree, the principle is the design and the pixels are a draft of it.
 *
 * `SearchField` exposes no submit handler, so the typed brand gets a labelled
 * control beneath the field rather than relying on the keyboard's search key —
 * a control that exists is one VoiceOver can find.
 */
function BrandRefinement({
  flow,
  subject,
  fieldRef,
}: {
  flow: MatchFlowView;
  subject: MatchSubject;
  fieldRef: RefObject<TextInput | null>;
}) {
  const typed = flow.brandQuery.trim();
  // The guess the note is about: the tagger's own column first, then the
  // function's best suggestion. Never a brand nobody proposed.
  const guess = subject.brandGuess ?? flow.brands[0] ?? null;

  const note = typed
    ? `The same search, scoped to ${typed}. If ${typed} has nothing that lines up, Cinch says so rather than widening quietly.`
    : guess
      ? `${guess} is the tagger${'’'}s guess, not a fact. Typing a brand overrides it.`
      : null;

  return (
    <View className="mt-8">
      <Text variant="eyebrow">Narrow it to a brand</Text>

      {flow.brands.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
          {flow.brands.map((brand) => (
            <Chip
              key={brand}
              label={brand}
              size="tap"
              selected={flow.activeBrand === brand}
              selectedGround="ink"
              onPress={() => flow.refine(brand)}
              accessibilityHint="Searches again within this brand"
            />
          ))}
        </View>
      ) : null}

      <SearchField
        value={flow.brandQuery}
        onChangeText={flow.setBrandQuery}
        placeholder="Or type a brand"
        autoCapitalize="words"
        autoCorrect={false}
        inputRef={fieldRef}
        className="mt-3"
      />

      <Button
        title={typed ? `Search ${typed} only` : 'Search this brand only'}
        variant="secondary"
        disabled={!typed || flow.searching}
        onPress={flow.submitBrandQuery}
        haptic
        className="mt-3.5 self-stretch"
      />

      {note ? (
        <Text variant="note" className="mt-3">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * M-09, first failure — nothing close.
 *
 * A title, a sentence about what is still true, and two ways onward. The
 * sentence describes the photograph as a good record, because it is one: the
 * search failing says nothing whatsoever about the picture they took.
 */
function NothingClose({
  noun,
  onTryBrand,
  onKeep,
}: {
  noun: string;
  onTryBrand: () => void;
  onKeep: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="rounded-md bg-tray p-4">
      <Text variant="plate">Nothing close enough</Text>
      <Text variant="callout" className="mt-2" style={{ color: theme.muted }}>
        Your photo stays. It is already a good record of this {noun} — and you can try again with a
        brand name.
      </Text>
      <View className="mt-4 flex-row" style={{ gap: 8 }}>
        <Button
          title="Try a brand"
          variant="secondary"
          onPress={onTryBrand}
          accessibilityHint="Moves to the brand field below"
          haptic
          className="flex-1"
        />
        <Button
          title="Keep my photo"
          variant="secondary"
          onPress={onKeep}
          haptic
          className="flex-1"
        />
      </View>
    </View>
  );
}

/**
 * M-09, second failure — lookalikes only, and the one that matters most.
 *
 * The brand-scoped search came back empty and these are wider-web resemblances.
 * Saying so outright, and naming the cost of using one, is the whole point: a
 * lookalike presented as a match would put a photograph of a garment the user
 * does not own into their closet, and they would have no way to know.
 */
function LookalikeWarning({
  brand,
  noun,
  plural,
}: {
  brand: string | null;
  noun: string;
  plural: string;
}) {
  const theme = useTheme();
  // The scope is what makes this sentence true, so it is named or the frame is
  // not drawn — "No match" with no brand in it would be the empty state's line.
  const named = brand ?? 'that brand';
  // Assembled as one string rather than interleaved JSX: the possessive
  // apostrophe sits directly against a word, and JSX's whitespace rules around
  // an expression are the wrong tool for deciding whether a space survives.
  const sentence =
    `Nothing at ${named} lines up with your ${noun}. These are other brands${'’'} ${plural} ` +
    'that resemble it. Using one means your closet shows a photo of a different garment.';

  return (
    <View className="rounded-md bg-tray p-4">
      <Text variant="plate">No {named} match — these only look like it</Text>
      <Text variant="callout" className="mt-2" style={{ color: theme.muted }}>
        {sentence}
      </Text>
    </View>
  );
}

/**
 * M-09, failures three to five — consent off, allowance spent, connection
 * dropped. Each is a title, a sentence about what is still true, and a way
 * onward; none of them is an empty state with a shrug.
 *
 * The frames are keyed on the function's stable codes, which are unchanged. The
 * codes the atlas draws no frame for — a plan boundary, an unreachable counter,
 * a disabled search — keep the sentence the existing table already maps them to
 * and get a neutral title, rather than borrowing the connection frame's, which
 * would tell somebody their network dropped when their plan simply does not
 * include this.
 */
function FailureFrame({ failure, onRetry }: { failure: MatchFailure; onRetry: () => void }) {
  const theme = useTheme();
  const router = useRouter();

  const quota = failure.quota;
  const period = quota?.period ?? 'month';
  const resets = resetsOn(quota?.retryAfterSeconds ?? null);
  const spent =
    quota && quota.used !== null && quota.limit !== null ? `${quota.used} of ${quota.limit}. ` : '';
  const comesBack = resets ? `It resets on ${resets}` : `It resets when the ${period} rolls over`;

  const frame: { title: string; body: string; action: 'settings' | 'retry' | null } =
    failure.code === 'ai_consent_required'
      ? {
          title: `Cinch${'’'}s AI is off for this account`,
          body: 'Nothing is searched and nothing is sent. Turn it on in Settings if you want listing photos.',
          action: 'settings',
        }
      : failure.code === 'ai_quota_exceeded'
        ? {
            title: `This ${period}${'’'}s searches are used up`,
            body: `${spent}${comesBack}, and your photographs are unaffected.`,
            action: null,
          }
        : failure.code === 'search_failed' || failure.code === 'match_failed'
          ? {
              title: `The search couldn${'’'}t reach the web`,
              body: 'Nothing was found or lost — the connection dropped on the way.',
              action: 'retry',
            }
          : {
              title: `The search didn${'’'}t run`,
              body: failure.message,
              // A refusal only earns a retry when trying again could answer
              // differently. A plan boundary would simply refuse again.
              action:
                failure.code === 'quota_unavailable' || failure.code === 'search_disabled'
                  ? 'retry'
                  : null,
            };

  return (
    <View className="rounded-md bg-tray p-4" accessibilityLiveRegion="polite">
      <Text variant="body">
        {frame.title}
      </Text>
      <Text variant="callout" className="mt-1.5" style={{ color: theme.muted }}>
        {frame.body}
      </Text>
      {frame.action === 'settings' ? (
        <Button
          title="Open Settings"
          variant="secondary"
          // Where every other consent refusal in the app points: Privacy holds
          // the Guideline 5.1.2(i) switch and the sentence about what leaves
          // the phone. The sheet stays open behind it.
          onPress={() => router.push('/privacy')}
          haptic
          className="mt-3 self-start"
        />
      ) : null}
      {frame.action === 'retry' ? (
        <Button
          title="Try again"
          variant="secondary"
          onPress={onRetry}
          haptic
          className="mt-3 self-start"
        />
      ) : null}
    </View>
  );
}

/**
 * M-08 — the confirm moment, and a step of its own rather than a second press
 * of the button that got here.
 *
 * The question is not "which picture" but "is this the garment I own", and that
 * is unanswerable next to five other candidates at thumbnail size. So the
 * listing is large and the photograph they took is small beside it: a
 * comparison, not a verdict. The small one is labelled Kept, never Replaced,
 * because confirming is a promotion and their photograph is not going anywhere.
 *
 * "Keep my photo" is a full-width outline button of the same height as the
 * oxblood one. Declining is a working outcome, not an escape hatch, and a
 * shorter or quieter control would be the screen arguing with the choice.
 */
function ConfirmStep({
  flow,
  subject,
  listing,
  onClose,
}: {
  flow: MatchFlowView;
  subject: MatchSubject;
  listing: MatchCandidate;
  onClose: () => void;
}) {
  const theme = useTheme();

  const commit = async () => {
    const landed = await flow.confirm();
    if (landed) onClose();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScreenHeader
        align="leading"
        title="Confirm"
        onBack={flow.backToCandidates}
        backLabel="Back to the listings"
      />

      <ScrollView contentContainerClassName="px-gutter pb-8 pt-3.5">
        <Text variant="title" trim>
          Is this yours?
        </Text>

        <View
          className="mt-4 overflow-hidden border border-rule bg-surface"
          style={{ borderRadius: RADIUS }}>
          {/* Contained on white, for the same reason the tiles are: this is a
              product photograph with its own margins, and filling the frame
              would crop the detail being confirmed. */}
          <View className="bg-surface" style={{ aspectRatio: 5 / 4, padding: 16 }}>
            <Image
              source={stableImageSource(listing.imageUrl)}
              recyclingKey={listing.imageUrl}
              contentFit="contain"
              transition={180}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          </View>
          <View className="border-t border-hairline px-4 py-3.5">
            <Text variant="plate">{listing.title}</Text>
            {/* Under the title, where a catalogue would print it. */}
            <Text variant="colophon" className="mt-1.5">
              {listing.source} · listing photo
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center" style={{ gap: 14 }}>
          <View
            className="overflow-hidden bg-tray"
            style={{ width: 76, height: 96, borderRadius: RADIUS }}>
            {subject.photoUri ? (
              <Image
                source={stableImageSource(subject.photoUri)}
                contentFit="cover"
                transition={180}
                cachePolicy="memory-disk"
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>
          <View className="flex-1">
            <Text variant="colophon">Your photograph</Text>
            <Text variant="callout" className="mt-1.5" style={{ color: theme.muted }}>
              Kept. It stays on this item and you can go back to it any time.
            </Text>
          </View>
        </View>

        {/* An attach that was refused keeps the user here with their chosen
            listing in front of them — one CDN download failing is not a reason
            to send somebody back through the search. */}
        {flow.attachMessage ? (
          <Notice message={flow.attachMessage} tone="critical" className="mt-5" />
        ) : null}
      </ScrollView>

      <View className="border-t border-hairline bg-canvas px-gutter pb-2 pt-4">
        <Button
          title="Yes, use this photo"
          onPress={() => void commit()}
          loading={flow.attaching}
          haptic
          className="self-stretch"
        />
        <Button
          title="Keep my photo"
          variant="secondary"
          onPress={onClose}
          disabled={flow.attaching}
          haptic
          className="mt-2.5 self-stretch"
        />
      </View>
    </SafeAreaView>
  );
}
