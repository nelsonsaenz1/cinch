import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
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
import { Text } from '@/components/ui/text';
import { occasion, type Item, type ItemCategory } from '@/schemas/item';
import { MIN_TAP_TARGET, motion, spring, useTheme } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
/**
 * Swipe far enough that the card genuinely commits, not so far that a fat
 * thumb accidentally rejects an item. Roughly one-quarter of the screen.
 */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

const CATEGORY_OPTIONS: { key: ItemCategory; label: string }[] = [
  { key: 'top', label: 'Top' },
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

// Taken from the schema rather than retyped, so the chips on offer here cannot
// drift away from the vocabulary the tagger is constrained to.
const OCCASION_OPTIONS: readonly string[] = occasion.options;

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
  occasions: string[];
  onEditCategory: (next: ItemCategory) => void;
  onToggleOccasion: (occasion: string) => void;
};

export function ReviewCard({
  item,
  isTop,
  depth,
  onConfirm,
  onSkip,
  category,
  occasions,
  onEditCategory,
  onToggleOccasion,
}: ReviewCardProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  // Which row's chip picker is open, if any. Only one at a time — this is a
  // "tap to correct" affordance, not a form. Category and occasions are the
  // only two fields the review pipeline can actually patch (see
  // `useVerifyItem`), so Colours and Details below render as plain read-outs.
  const [openEditor, setOpenEditor] = useState<'category' | 'occasions' | null>(null);

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

  const occasionsValue = occasions.length > 0 ? occasions.join(' · ') : 'Add occasions';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 20,
            right: 20,
            top: 20,
            bottom: 20,
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
          <View className="flex-1 p-5">
            <Text variant="title" trim>
              Is this right?
            </Text>
            <Text variant="label" className="mb-4 mt-1.5 text-faint dark:text-faint-dark">
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
                <Text variant="label" className="text-canvas dark:text-canvas">
                  Confirm
                </Text>
              </Animated.View>
              <Animated.View
                style={skipOverlay}
                className="absolute left-3 top-3 rounded-chip bg-muted px-3 py-1"
                pointerEvents="none">
                <Text variant="label" className="text-canvas dark:text-canvas">
                  Skip
                </Text>
              </Animated.View>
            </View>

            {/* Category / Colours / Details / Wear it for — a colophon label,
                the value beneath it, and (where the field is genuinely
                editable) an accent "Edit" that reveals the same chip picker
                the old always-open grid used. */}
            <ReviewRow
              label="Category"
              editable
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

            <ReviewRow
              label="Wear it for"
              isLast
              editable
              expanded={openEditor === 'occasions'}
              onToggleEdit={() => setOpenEditor((cur) => (cur === 'occasions' ? null : 'occasions'))}
              expandedContent={
                <>
                  {OCCASION_OPTIONS.map((o) => (
                    <Chip
                      key={o}
                      label={o}
                      selected={occasions.includes(o)}
                      onPress={() => onToggleOccasion(o)}
                    />
                  ))}
                </>
              }>
              <Text variant="callout" numberOfLines={1}>
                {occasionsValue}
              </Text>
            </ReviewRow>

            {/*
              The swipe is the fast path, not the only path. A pan gesture is
              unavailable to VoiceOver and Switch Control, and awkward one-handed
              on a large phone, so both outcomes also exist as ordinary buttons.
              Hints spell out the consequence because "Skip" alone does not say
              whether the item comes back.
            */}
            <View className="mt-auto flex-row items-center gap-2.5 pt-5">
              <Button
                title="Skip"
                variant="secondary"
                onPress={skip}
                accessibilityHint="Leaves the tags unconfirmed. This item returns next time you review."
              />
              {/*
                Not the shared Button: its "primary" variant is the oxblood
                accent, and this screen already spends that accent on the
                "Edit" affordances above. The one confirming action here is
                ink-filled instead — the "ink-selected" treatment the design
                system reserves for exactly this case, hand-built rather than
                repurposing a component whose whole job is guarding the accent.
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Marks these tags as correct and removes the item from the review queue."
                onPress={confirmFromButton}
                hitSlop={{ top: 4, bottom: 4 }}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="flex-1 flex-row items-center justify-center rounded-md bg-ink px-5 active:opacity-70 dark:bg-ink-dark">
                <Text variant="body" className="font-semibold text-canvas dark:text-canvas">
                  Looks right
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * One Category/Colours/Details/Wear-it-for row: a tracked colophon label, the
 * value beneath it, a hairline under all but the last row, and — only where
 * `onToggleEdit` is supplied — an accent "Edit" that reveals `expandedContent`
 * (a chip grid) in place. Colours and Details have no backing edit callback,
 * so they render as plain read-outs rather than a live "Edit" link that would
 * do nothing when tapped.
 */
function ReviewRow({
  label,
  children,
  editable = false,
  expanded = false,
  onToggleEdit,
  expandedContent,
  isLast = false,
}: {
  label: string;
  children: React.ReactNode;
  editable?: boolean;
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
        {editable ? (
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
      {editable && expanded ? (
        <View className="mt-3 flex-row flex-wrap gap-1.5">{expandedContent}</View>
      ) : null}
    </View>
  );
}
