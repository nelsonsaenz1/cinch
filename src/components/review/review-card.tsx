import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Chip } from '@/components/ui/chip';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Swatch } from '@/components/ui/swatch';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { Item, ItemCategory } from '@/schemas/item';
import { GUTTER, MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
/**
 * Swipe far enough that the card genuinely commits, not so far that a fat
 * thumb accidentally rejects an item. Roughly one-quarter of the screen.
 */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

/**
 * The Confirm drag pill's fill, exactly as the state atlas draws it (R-03).
 * Deliberately not `theme.positive`: the outcome overlays are the one place the
 * deck admits another hue, and the atlas chose this muted sage over the app's
 * brighter success green. Local because no other surface draws a drag outcome.
 */
const CONFIRM_OVERLAY_GREEN = '#3E6B4A';

/**
 * RV-01's action height. Both peers take it, so neither can end up the taller
 * one — the deviation ledger records "Skip lighter than Looks right" as the
 * fault this replaces, and a difference in height is a difference in weight
 * whatever the fill says.
 */
const ACTION_HEIGHT = 52;

const CATEGORY_OPTIONS: { key: ItemCategory; label: string }[] = [
  // "Tops", plural, matches the handoff's exact "Tops · Knitwear" (Frame 08)
  // and the plural convention the closet's own category filter already uses.
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'dress', label: 'Dress' },
  { key: 'accessory', label: 'Accessory' },
  { key: 'bag', label: 'Bag' },
  { key: 'headwear', label: 'Headwear' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'other', label: 'Other' },
];

/**
 * What the user typed, as a number the database can hold.
 *
 * Blank is null — "I don't know what this cost" — and never 0: a zero is a
 * garment that appears free, which would quietly poison every cost-per-wear
 * figure it touches. Anything unparseable is treated as blank rather than
 * guessed at. Exported because the item screen edits the same field and must
 * agree with this card to the letter.
 */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** How a price is printed back: whole dollars when it is one, cents when not. */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export type ReviewCardProps = {
  item: Item;
  /**
   * A SIGNED, displayable URL for the garment photograph — never a storage path.
   *
   * The `garments` bucket is private, so `item.thumbPath` and friends are keys,
   * not URLs: handing one to `<Image>` renders nothing at all, silently, with no
   * error to debug (see the comment on `useSignedUrls`). This card used to do
   * exactly that, which is why the deck showed a blank plate for every user. The
   * parent signs the whole queue in one batch and hands the result down; this
   * component deliberately has no access to the raw paths' resolution logic, so
   * the mistake cannot be reintroduced here.
   *
   * Undefined while the batch is still in flight, and undefined for a garment
   * with no photograph — the two are told apart by the item's own paths below.
   */
  imageUri?: string;
  /**
   * The one-line, muted admission of what the tagger could not read AND the card
   * has no control for. Optional and usually absent.
   *
   * It lives on the card rather than in a screen-wide banner above the deck: a
   * full-width notice at the top of somebody's first review session reads as an
   * error the app is reporting about itself, at the most delicate moment in
   * onboarding. The honesty is worth keeping; the volume was not.
   */
  gapNote?: string | null;
  /** True for the visible card. Cards below the top render smaller and inert. */
  isTop: boolean;
  /** Ordinal from the top; 0 = active, 1 = peeking underneath, 2+ = hidden. */
  depth: number;
  /**
   * Right swipe, or the "Looks right" button. The parent persists
   * `user_verified` along with whatever corrections the user made.
   */
  onConfirm: () => void;
  /**
   * Left swipe, or the Skip button. Deliberately a SEPARATE handler from
   * `onConfirm`: skipping must not write anything, because the whole point is
   * that the user could not decide yet. Wiring both directions to one callback
   * is how this screen used to silently mark deferred items as trusted.
   */
  onSkip: () => void;
  category: ItemCategory;
  /**
   * Still accepted (and still supplied by the parent's edit state), but the
   * handoff's review card surfaces only Category / Colours / Details — no
   * "wear it for" row — so this card does not render an occasions editor.
   * Kept on the prop type rather than deleted so the parent's patch logic
   * (which can send an occasions correction if one is ever made upstream of
   * this card) does not have to change shape.
   */
  occasions: string[];
  /**
   * What the garment cost, as edited in this sitting. Null means the user has
   * not said — which is the honest default, and the reason cost per wear reads
   * as a dash until they do.
   */
  price: number | null;
  onEditCategory: (next: ItemCategory) => void;
  onToggleOccasion: (occasion: string) => void;
  onEditPrice: (next: number | null) => void;
};

export function ReviewCard({
  item,
  imageUri,
  gapNote,
  isTop,
  depth,
  onConfirm,
  onSkip,
  category,
  price,
  onEditCategory,
  onEditPrice,
}: ReviewCardProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  /**
   * How long the card takes to leave, and nothing else.
   *
   * Reduce Motion is a request not to be thrown large objects across the
   * screen; it is NOT a request to lose the swipe, which is this deck's whole
   * interaction. So the gesture — its thresholds, its overlays, its committed
   * outcomes — is untouched, and only the fly-off's duration collapses to the
   * shortest step on the scale. A plain boolean, captured by the worklet below
   * the same way `depth` is.
   */
  const reduceMotion = useReducedMotion();
  const flyOffDuration = reduceMotion ? motion.duration.fast : motion.duration.slow;

  // Which row's editor is open, if any. Only one at a time — this is a "tap to
  // correct" affordance, not a form. Category and Price are the two fields this
  // card can actually patch (see `useVerifyItem`), so Colours and Details below
  // render as plain read-outs with no Edit affordance at all: a coloured "Edit"
  // that does nothing reads as broken, which is worse than its absence.
  const [openEditor, setOpenEditor] = useState<'category' | 'price' | null>(null);

  /**
   * The raw text of the price field. Kept beside the parsed number the parent
   * holds because a half-typed "12." is a valid thing to be looking at and not
   * a valid thing to store — the card owns the keystrokes, the parent owns the
   * value.
   */
  const [priceDraft, setPriceDraft] = useState(() => (price != null ? String(price) : ''));

  const fireHaptic = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      /* haptics no-op silently in Low Power Mode etc.; the swipe animation is
         the real feedback. Never let a haptic failure block the interaction. */
    });
  }, []);

  const confirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const skip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const confirmFromButton = useCallback(() => {
    // The swipe path gets the heavier "success" notification haptic; a tap on
    // the button gets the lighter selection tick the shared Button gives
    // every other tap — this control just isn't built from Button (see below).
    void Haptics.selectionAsync().catch(() => {});
    confirm();
  }, [confirm]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dragged = e.translationX + e.velocityX * 0.15;
      if (dragged > SWIPE_THRESHOLD) {
        // Fly off right → confirm. The success haptic is reserved for this
        // direction; a skip is not an accomplishment and should not feel like one.
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: flyOffDuration });
        runOnJS(fireHaptic)();
        runOnJS(confirm)();
      } else if (dragged < -SWIPE_THRESHOLD) {
        // Fly off left → skip. Nothing is persisted, so the item is still
        // unverified server-side and returns on the next visit.
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: flyOffDuration });
        runOnJS(skip)();
      } else {
        translateX.value = withSpring(0, spring.interactive);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-8, 0, 8],
      Extrapolation.CLAMP,
    );
    // Peek offset for cards below the top. Scale + translate stacks them like
    // a physical deck rather than layering flat.
    const restingScale = 1 - depth * 0.04;
    const restingY = depth * 6;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: restingY },
        { rotate: `${rotate}deg` },
        { scale: restingScale },
      ],
      opacity: depth >= 3 ? 0 : 1,
    };
  });

  // Drag intent overlay — a green check tips in from the right, a grey chevron
  // from the left. The idea is that the outcome is visible *during* the drag,
  // not only after.
  const acceptOverlay = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const skipOverlay = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const needsReview = item.status === 'needs_review';

  /**
   * Whether this garment HAS a photograph, which is a different question from
   * whether its URL has arrived yet.
   *
   * Telling the two apart is what keeps the placeholder honest: a tshirt glyph
   * flashed over a card whose photo is one signing round-trip away claims the
   * item has no picture, and then contradicts itself a moment later. While the
   * batch is in flight the plate simply stays empty.
   */
  const hasPhoto = Boolean(item.thumbPath || item.cutoutPath || item.imagePath);
  const photoSource = stableImageSource(imageUri);

  // "Other" with no subtype is the tagger's catch-all, not an answer, and the
  // atlas prints it the way it prints every unanswered field: "Uncategorised",
  // in the faint register (R-02) — a placeholder to fill, not a value to trust.
  const isUncategorised = category === 'other' && !item.subcategory;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.key === category)?.label ?? 'Uncategorised';
  const categoryValue = isUncategorised
    ? 'Uncategorised'
    : item.subcategory
      ? `${categoryLabel} · ${item.subcategory}`
      : categoryLabel;

  const colours = item.colors.slice(0, 3);
  const coloursValue = colours.length > 0 ? colours.map((c) => c.name).join(' · ') : 'Not detected';

  // "Details" has no field of its own in the schema — it's a best-effort
  // summary of what the tagger already wrote down, material first.
  const detailsParts = [item.material, item.pattern && item.pattern !== 'none' ? item.pattern : null].filter(
    (p): p is string => Boolean(p),
  );
  const detailsValue =
    detailsParts.length > 0 ? detailsParts.join(' · ') : (item.description ?? 'No extra details');

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        // Inset by the page gutter on all four sides — the same measure every
        // other screen's `px-gutter` uses, taken from the token rather than
        // typed as 20 four times.
        style={[
          {
            position: 'absolute',
            left: GUTTER,
            right: GUTTER,
            top: GUTTER,
            bottom: GUTTER,
          },
          cardStyle,
        ]}
        pointerEvents={isTop ? 'auto' : 'none'}
        // Deliberately NOT `accessibilityRole="adjustable"`: that role promises
        // increment/decrement semantics this card does not have, and it was set
        // on a container whose only real affordance was a pan gesture — which
        // VoiceOver and Switch Control users cannot perform at all. The two
        // outcomes are exposed as real buttons at the foot of the card instead,
        // and the container stays a plain group so the correction chips inside
        // it remain individually focusable.
        accessibilityLabel={`Reviewing ${item.subcategory ?? item.category}`}
        // Cards under the top one are inert and must not be reachable by a
        // swipe of the VoiceOver cursor either.
        accessibilityElementsHidden={!isTop}
        importantForAccessibility={isTop ? 'yes' : 'no-hide-descendants'}>
        <View className="flex-1 overflow-hidden rounded-plate bg-surface">
          {/*
            The card's contents scroll, for one reason: the Price field.

            It is the last row before the buttons, which puts it within a
 thumb's width of the bottom of the screen — and the decimal pad
            covers roughly the bottom half. The field a person had just tapped
            was under the keyboard, with nothing on this screen able to move it.
 `automaticallyAdjustKeyboardInsets` is UIScrollView's own answer:
            the focused field rises above the keyboard and the rest of the card
            keeps its composition exactly as drawn. `flexGrow: 1` on the content
            is what lets the footer's `mt-auto` still push the buttons to the
            bottom when nothing is being edited, and the pan gesture above only
            claims horizontal movement (`activeOffsetX`), so a vertical drag
            scrolls rather than swiping the card away.
          */}
          <KeyboardAwareScrollView
            scrollEnabled={isTop}
            showsVerticalScrollIndicator={false}
            contentContainerClassName="p-5"
            contentContainerStyle={{ flexGrow: 1 }}>
            {/* RV-01 names the PIECE, not the question. "Is this right?" was
                the same sentence on every card in the deck; the garment's own
                name is the thing that changes, and it is what the two actions
                at the foot are a verdict about. */}
            <Text variant="title" trim numberOfLines={2}>
              {item.subcategory ?? item.category}
            </Text>
            {/* RV-01's own sentence, in `note` — 13px prose in the regular
                cut, `muted`, with NO second colour on top of it. It carried an
                inline `faint` until Wave 3: #8A8578 is 3.52:1 on this surface,
                and the constitution's refusal is unconditional ("NEVER #8A8578
                as text"). `muted` is the frame's secondary colour and the
                variant already ships it, so the override is deleted rather
                than re-toned — the register is the variant's job. */}
            <Text variant="note" className="mb-4 mt-1.5">
              Cinch read this from your photograph.
            </Text>

            {/*
              AUDIT 72 — THE GARMENT SITS BESIDE ITS GUESSED FIELDS.

              "the garment and its three guessed fields sit side by side rather
              than stacked, which buys back 116 pt, and the two actions land 68
              pt under the last field instead of at the bottom of a tall sheet."
              That is the whole geometry change: the decision moves up to sit
              beside the thing being decided, and nothing lands below the fold.

              The well keeps `contain` and the tray ground — a cutout on a
              coloured field is the one thing that would tint a garment.
            */}
            <View className="mb-4 flex-row items-start gap-4">
            <View
              className="items-center justify-center overflow-hidden rounded-plate bg-tray"
              style={{ width: 132, height: 160 }}>
              {photoSource ? (
                <Image
                  source={photoSource}
                  contentFit="contain"
                  transition={180}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : hasPhoto ? null : (
                <SymbolView
                  name={needsReview ? 'exclamationmark.triangle' : 'tshirt'}
                  size={40}
                  tintColor={needsReview ? theme.warning : theme.hairline}
                  resizeMode="scaleAspectFit"
                />
              )}
            </View>

              {/*
                Drag intent — visible only while the card is being dragged.

                MOVED OUT OF THE PHOTO WELL. The well is 132pt wide since the
                garment came to sit beside its fields, and a 12pt-inset pill
                inside it had nowhere to go. The pills now ride the whole
                side-by-side row, which is the region the gesture actually acts
                on.

                STYLE, NOT className. NativeWind's interop registers React
                Native primitives only, so a `className` on a Reanimated
                component is silently dropped — no warning, nothing to debug.
                These two pills carried their ENTIRE appearance in classes, so
                they were rendering unpositioned, unpadded and untinted.

                THE GREEN IS THE ATLAS'S, not the theme's `positive`. The state
                atlas draws this pill in #3E6B4A — the one place another hue is
                allowed in ("green and grey are the outcome itself", rule card
                05) — and that muted sage sits in the palette's register where
                the success green #1A8754 reads as a foreign traffic light.
                Scoped to this overlay rather than promoted to a token: nothing
                else in the app draws a drag outcome.
              */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    right: 0,
                    top: 8,
                    borderRadius: 12,
                    backgroundColor: CONFIRM_OVERLAY_GREEN,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  },
                  acceptOverlay,
                ]}
                pointerEvents="none">
                <Text variant="label" style={{ color: theme.canvas }}>
                  Confirm
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    borderRadius: 12,
                    backgroundColor: theme.muted,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  },
                  skipOverlay,
                ]}
                pointerEvents="none">
                <Text variant="label" style={{ color: theme.canvas }}>
                  Skip
                </Text>
              </Animated.View>

              {/* The three guessed fields, beside the garment. Read-outs: the
                  corrections are the named chips under the row, per RV-01, so
                  "no user has to audit a form to find what is wrong." */}
              <View className="flex-1">
                <FieldRow label="Category" value={categoryValue} hedged={isUncategorised} />
                <FieldRow label="Colour" value={coloursValue} swatchHex={colours[0]?.hex ?? null} />
                <FieldRow label="Fabric" value={detailsValue} last />
              </View>
            </View>

            {/*
              RV-01's correction chips — "each one opens the relevant editor".

              TWO CHIPS, NOT THE FRAME'S THREE. The frame draws Change category,
              Change colour and Add a price. This card can patch category and
              price and nothing else (`useVerifyItem`), and the rule the card
              already held is the right one: a control whose tap does nothing
              reads as broken, which is worse than its absence. The colour chip
              is therefore not drawn rather than drawn dead. Recorded as a
              deviation in the report.

              The chips are `Chip` at the shared 12pt radius — labelled controls
              are 12, never capsules.
            */}
            <View className="mt-4 flex-row flex-wrap gap-1.5">
              <Chip
                label="Change category"
                selected={openEditor === 'category'}
                selectedGround="ink"
                onPress={() => setOpenEditor((cur) => (cur === 'category' ? null : 'category'))}
              />
              <Chip
                label={price != null ? 'Change price' : 'Add a price'}
                selected={openEditor === 'price'}
                selectedGround="ink"
                onPress={() => setOpenEditor((cur) => (cur === 'price' ? null : 'price'))}
              />
            </View>

            {/* The editor the chip opened, in place under the chips. */}
            {openEditor === 'category' ? (
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <Chip
                    key={c.key}
                    label={c.label}
                    selected={category === c.key}
                    // Ink, not accent (atlas R-05): the oxblood on this card is
                    // spent on the accepting action, and a selected chip is a
                    // state, not another invitation.
                    selectedGround="ink"
                    onPress={() => {
                      onEditCategory(c.key);
                      setOpenEditor(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {openEditor === 'price' ? (
              <View
                className="mt-3 w-full flex-row items-center rounded-md border border-rule px-3"
                style={{ minHeight: MIN_TAP_TARGET }}>
                <Text variant="callout" className="text-muted">
                  $
                </Text>
                <TextInput
                  value={priceDraft}
                  onChangeText={(next) => {
                    setPriceDraft(next);
                    onEditPrice(parsePrice(next));
                  }}
                  // Decimal pad, not numeric: there is no return key to lose
                  // (the chip above closes it) and no reason to offer anything
                  // but digits and a point.
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  // The atlas draws the caret in the accent (R-06) — the
                  // system-blue default is the one foreign colour this card
                  // could otherwise show.
                  selectionColor={theme.accent}
                  placeholder="0"
                  placeholderTextColor={theme.muted}
                  autoFocus
                  accessibilityLabel="Price paid, in dollars"
                  returnKeyType="done"
                  onSubmitEditing={() => setOpenEditor(null)}
                  className="ml-1 flex-1 font-body text-callout text-ink"
                  style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
                />
              </View>
            ) : null}

            {/*
              The footnote, and only ever a footnote.

              This is what the tagger could not read on rows the card cannot
              edit — a statement of record, not a request. It sits under the spec
              lines, in the faint tone, sized like a caption under a photograph:
              close enough to the blank rows that it explains them, quiet enough
              that a first-time user reads the card before they read the
              apology. Rendered only when there is something to admit.
            */}
            {gapNote ? (
              <Text variant="caption" className="mt-3">
                {gapNote}
              </Text>
            ) : null}

            {/*
              AUDIT 72 — TWO PEERS OF EQUAL WEIGHT, AND THE CONSEQUENCE PRINTED.

              "Skip and Looks right are both 52 pt and both full half-width
              peers; only the accepting one is filled, and the consequence of
              skipping is printed under them rather than discovered afterwards."

              Both are hand-built rather than one `Button` beside one `Pressable`
              — that pairing let the two controls take different intrinsic
              heights, which is exactly the "Skip lighter than Looks right"
              the deviation ledger records. Same height, same width, same type
              size; the fill is the only difference, which is what makes it read
              as a difference in outcome rather than in importance.

              The swipe is the fast path, not the only path: a pan gesture is
              unavailable to VoiceOver and Switch Control, and awkward one-handed
              on a large phone.
            */}
            <View className="mt-auto border-t border-hairline pt-4">
              <View className="flex-row items-center gap-2.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Skip for now"
                  accessibilityHint="Leaves the tags unconfirmed. This item returns next time you review."
                  onPress={skip}
                  style={{ height: ACTION_HEIGHT }}
                  className="flex-1 items-center justify-center rounded-md border border-rule active:opacity-70">
                  {/* Regular weight — the constitution reserves Medium for
                      labels and FILLED actions, and this one is outlined. */}
                  <Text variant="body" className="text-ink">
                    Skip for now
                  </Text>
                </Pressable>
                {/*
                  Not the shared Button: its "primary" variant is the oxblood
                  accent, and the accepting action here is ink-filled instead —
                  the "ink-selected" treatment the design system reserves for
                  exactly this case, hand-built rather than repurposing a
                  component whose whole job is guarding the accent.
                */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Looks right"
                  accessibilityHint="Marks these tags as correct and removes the item from the review queue."
                  onPress={confirmFromButton}
                  style={{ height: ACTION_HEIGHT }}
                  className="flex-1 items-center justify-center rounded-md bg-ink active:opacity-70">
                  {/* Inline style, not `text-canvas`. Two colour utilities on one
                      element are resolved by their order in the GENERATED
                      stylesheet — the order of the palette in tailwind.config.js
                      — not by which the call site wrote last, so `text-canvas`
                      here would lose to the variant's `text-ink` (canvas is
                      declared first, ink later) and the label would vanish into
                      the ink fill. Same trap as the item-detail hero tile. */}
                  <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                    Looks right
                  </Text>
                </Pressable>
              </View>
              {/* Printed under them, not discovered afterwards. */}
              <Text variant="note" className="mt-2.5">
                Skipping keeps the piece and the photograph. It comes back to this queue.
              </Text>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * One guessed field, beside the garment: a tracked label and the value under it.
 *
 * A READ-OUT, WITH NO AFFORDANCE OF ITS OWN. The row used to carry an accent
 * "Edit" on the two fields the pipeline can patch; RV-01 moves correction into
 * named chips under the whole block instead, "so no user has to audit a form to
 * find what is wrong". That also removes the last reason for a per-row control
 * that some rows had and others did not.
 *
 * `hedged` tones the value to `muted` when the guess is an unanswered one. It
 * is never `faint`: RV-02's rule is that uncertainty is written into the WORD,
 * never into the contrast.
 */
function FieldRow({
  label,
  value,
  hedged = false,
  last = false,
  swatchHex = null,
}: {
  label: string;
  value: string;
  hedged?: boolean;
  last?: boolean;
  /** The colour row's second channel — the value is never colour alone. */
  swatchHex?: string | null;
}) {
  return (
    <View className={last ? '' : 'mb-2.5 border-b border-hairline pb-2.5'}>
      <Text variant="colophon">{label}</Text>
      <View className="flex-row items-center gap-2">
        {swatchHex ? <Swatch hex={swatchHex} size={14} /> : null}
        <Text
          variant="callout"
          numberOfLines={2}
          className={`flex-1 ${hedged ? 'text-muted' : ''}`}>
          {value}
        </Text>
      </View>
    </View>
  );
}
