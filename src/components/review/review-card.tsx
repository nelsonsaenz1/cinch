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
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import type { Item, ItemCategory } from '@/schemas/item';
import { GUTTER, MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
/**
 * Swipe far enough that the card genuinely commits, not so far that a fat
 * thumb accidentally rejects an item. Roughly one-quarter of the screen.
 */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

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
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: motion.duration.slow });
        runOnJS(fireHaptic)();
        runOnJS(confirm)();
      } else if (dragged < -SWIPE_THRESHOLD) {
        // Fly off left → skip. Nothing is persisted, so the item is still
        // unverified server-side and returns on the next visit.
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: motion.duration.slow });
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

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.key === category)?.label ?? 'Uncategorised';
  const categoryValue = item.subcategory ? `${categoryLabel} · ${item.subcategory}` : categoryLabel;

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
        <View className="flex-1 overflow-hidden rounded-card bg-surface dark:bg-surface-dark">
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
            <Text variant="title" trim>
              Is this right?
            </Text>
            {/* Tone inline rather than a stacked `text-faint` over the label
                variant's `text-muted` — see the note on the confirm button
                below for why a second colour class is not a reliable override.*/}
            <Text variant="label" className="mb-4 mt-1.5" style={{ color: theme.faint }}>
              My best guess — correct anything that&rsquo;s off.
            </Text>

            {/* Cleaned-up photo */}
            <View className="mb-4 h-44 w-full items-center justify-center overflow-hidden rounded-plate bg-tray dark:bg-tray-dark">
              {item.thumbPath || item.cutoutPath || item.imagePath ? (
                <Image
                  source={item.thumbPath ?? item.cutoutPath ?? item.imagePath}
                  contentFit="contain"
                  transition={180}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <SymbolView
                  name={needsReview ? 'exclamationmark.triangle' : 'tshirt'}
                  size={40}
                  tintColor={needsReview ? theme.warning : theme.hairline}
                  resizeMode="scaleAspectFit"
                />
              )}

              {/* Drag intent — visible only while the card is being dragged. */}
              <Animated.View
                style={acceptOverlay}
                className="absolute right-3 top-3 rounded-chip bg-positive px-3 py-1"
                pointerEvents="none">
                <Text variant="label" style={{ color: theme.canvas }}>
                  Confirm
                </Text>
              </Animated.View>
              <Animated.View
                style={skipOverlay}
                className="absolute left-3 top-3 rounded-chip bg-muted px-3 py-1"
                pointerEvents="none">
                <Text variant="label" style={{ color: theme.canvas }}>
                  Skip
                </Text>
              </Animated.View>
            </View>

            {/* Category / Colours / Details — a colophon label, the value
                beneath it, and a hairline divider between rows. The accent
                "Edit" appears only on the rows that can actually be patched
                (Category, Price); Colours and Details are read-outs. */}
            <ReviewRow
              label="Category"
              expanded={openEditor === 'category'}
              onToggleEdit={() => setOpenEditor((cur) => (cur === 'category' ? null : 'category'))}
              expandedContent={
                <>
                  {CATEGORY_OPTIONS.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      selected={category === c.key}
                      onPress={() => {
                        onEditCategory(c.key);
                        setOpenEditor(null);
                      }}
                    />
                  ))}
                </>
              }>
              <Text variant="callout" numberOfLines={1}>
                {categoryValue}
              </Text>
            </ReviewRow>

            <ReviewRow label="Colours">
              <View className="flex-row items-center gap-2">
                {colours.map((c, i) =>
                  c.hex ? (
                    <View
                      key={`${c.name}-${i}`}
                      className="h-[18px] w-[18px] rounded-full border border-rule dark:border-rule-dark"
                      style={{ backgroundColor: c.hex }}
                    />
                  ) : null,
                )}
                <Text variant="callout" numberOfLines={1} className="shrink">
                  {coloursValue}
                </Text>
              </View>
            </ReviewRow>

            <ReviewRow label="Details">
              <Text variant="callout" numberOfLines={2}>
                {detailsValue}
              </Text>
            </ReviewRow>

            {/* Price — the one field on this card the tagger cannot guess, and
                the one that unlocks cost per wear. Optional, and it stays
                optional: skipping it costs the user nothing but the number. */}
            <ReviewRow
              label="Price"
              isLast
              expanded={openEditor === 'price'}
              onToggleEdit={() => setOpenEditor((cur) => (cur === 'price' ? null : 'price'))}
              expandedContent={
                <View
                  className="w-full flex-row items-center rounded-md border border-rule px-3 dark:border-rule-dark"
                  style={{ minHeight: MIN_TAP_TARGET }}>
                  <Text variant="callout" className="text-faint dark:text-faint-dark">
                    $
                  </Text>
                  <TextInput
                    value={priceDraft}
                    onChangeText={(next) => {
                      setPriceDraft(next);
                      onEditPrice(parsePrice(next));
                    }}
                    // Decimal pad, not numeric: there is no return key to lose
                    // (the row's own Done closes it) and no reason to offer
                    // anything but digits and a point.
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    autoFocus
                    placeholder="0"
                    placeholderTextColor={theme.faint}
                    accessibilityLabel="Price paid, in dollars"
                    returnKeyType="done"
                    onSubmitEditing={() => setOpenEditor(null)}
                    className="ml-1 flex-1 font-body text-callout text-ink"
                    style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
                  />
                </View>
              }>
              <Text variant="callout" numberOfLines={1}>
                {price != null ? formatPrice(price) : 'Add it for cost per wear'}
              </Text>
            </ReviewRow>

            {/*
              The swipe is the fast path, not the only path. A pan gesture is
              unavailable to VoiceOver and Switch Control, and awkward one-handed
              on a large phone, so both outcomes also exist as ordinary buttons.
              Hints spell out the consequence because "Skip" alone does not say
              whether the item comes back.
            */}
            <View className="mt-auto flex-row items-center gap-2.5 border-t border-hairline pt-4 dark:border-hairline-dark">
              <Button
                title="Skip"
                variant="secondary"
                onPress={skip}
                accessibilityHint="Leaves the tags unconfirmed. This item returns next time you review."
              />
              {/*
                Not the shared Button: its "primary" variant is the oxblood
                accent, and this screen spends that accent on the "Edit"
                affordances above — the deck's one invitation to correct
                something, and now its ONLY accent (the progress pip above the
                card used to take a second helping and is ink again). The one
                confirming action here is ink-filled instead — the
                "ink-selected" treatment the design system reserves for exactly
                this case, hand-built rather than repurposing a component whose
                whole job is guarding the accent.
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Marks these tags as correct and removes the item from the review queue."
                onPress={confirmFromButton}
                hitSlop={{ top: 4, bottom: 4 }}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="flex-1 flex-row items-center justify-center rounded-md bg-ink px-5 active:opacity-70 dark:bg-ink-dark">
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
          </KeyboardAwareScrollView>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * One Category/Colours/Details/Price row: a tracked colophon label, the value
 * beneath it, and a hairline under all but the last row. Supplying
 * `onToggleEdit` (Category, Price) is what puts the accent "Edit" on the row —
 * a real control that reveals `expandedContent` (a chip grid, or a field) in
 * place. Rows without one (Colours, Details) carry no affordance at all: the
 * review pipeline can patch only category and price (see `useVerifyItem`),
 * and an "Edit" that a tap does nothing with reads as broken.
 */
function ReviewRow({
  label,
  children,
  expanded = false,
  onToggleEdit,
  expandedContent,
  isLast = false,
}: {
  label: string;
  children: React.ReactNode;
  expanded?: boolean;
  onToggleEdit?: () => void;
  expandedContent?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <View className={isLast ? '' : 'mb-3 border-b border-hairline pb-3 dark:border-hairline-dark'}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text variant="colophon">{label}</Text>
          <View className="mt-1">{children}</View>
        </View>
        {onToggleEdit ? (
          <Pressable
            onPress={onToggleEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`Edit ${label.toLowerCase()}`}>
            <Text variant="label" className="text-accent dark:text-accent-dark">
              {expanded ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {onToggleEdit && expanded ? (
        <View className="mt-3 flex-row flex-wrap gap-1.5">{expandedContent}</View>
      ) : null}
    </View>
  );
}
