import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback } from 'react';
import { Dimensions, View } from 'react-native';
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
import { motion, spring, useTheme } from '@/theme/tokens';

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
   * Right swipe, or the Confirm button. The parent persists `user_verified`
   * along with whatever corrections the user made.
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
          {/* Photo */}
          <View className="aspect-square w-full items-center justify-center bg-tray dark:bg-tray-dark">
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
                size={44}
                tintColor={needsReview ? theme.warning : theme.hairline}
                resizeMode="scaleAspectFit"
              />
            )}

            {/* Drag intent — visible only while the card is being dragged. */}
            <Animated.View
              style={acceptOverlay}
              className="absolute right-4 top-4 rounded-chip bg-positive px-3 py-1"
              pointerEvents="none">
              <Text variant="label" className="text-canvas dark:text-canvas">
                Confirm
              </Text>
            </Animated.View>
            <Animated.View
              style={skipOverlay}
              className="absolute left-4 top-4 rounded-chip bg-muted px-3 py-1"
              pointerEvents="none">
              <Text variant="label" className="text-canvas dark:text-canvas">
                Skip
              </Text>
            </Animated.View>
          </View>

          {/* Attribute editing */}
          <View className="flex-1 p-4">
            <Text variant="title" numberOfLines={1}>
              {item.subcategory ?? 'Untagged'}
            </Text>
            {item.description ? (
              <Text variant="label" numberOfLines={2} className="mt-1">
                {item.description}
              </Text>
            ) : null}

            <Text variant="caption" className="mb-2 mt-4">
              Category
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  selected={category === c.key}
                  onPress={() => onEditCategory(c.key)}
                />
              ))}
            </View>

            <Text variant="caption" className="mb-2 mt-4">
              Wear it for
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {OCCASION_OPTIONS.map((o) => (
                <Chip
                  key={o}
                  label={o}
                  selected={occasions.includes(o)}
                  onPress={() => onToggleOccasion(o)}
                />
              ))}
            </View>

            {/*
              The swipe is the fast path, not the only path. A pan gesture is
              unavailable to VoiceOver and Switch Control, and awkward one-handed
              on a large phone, so both outcomes also exist as ordinary buttons.
              Hints spell out the consequence because "Skip" alone does not say
              whether the item comes back.
            */}
            <View className="mt-auto flex-row gap-2 pt-4">
              <Button
                title="Skip"
                variant="secondary"
                className="flex-1"
                onPress={skip}
                accessibilityHint="Leaves the tags unconfirmed. This item returns next time you review."
              />
              <Button
                title="Confirm"
                variant="primary"
                className="flex-1"
                haptic
                onPress={confirm}
                accessibilityHint="Marks these tags as correct and removes the item from the review queue."
              />
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
