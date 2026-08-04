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

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import type { Item, ItemCategory } from '@/schemas/item';
import { motion, useTheme } from '@/theme/tokens';

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

const OCCASION_OPTIONS = [
  'casual',
  'office',
  'date',
  'gym',
  'event',
  'streetwear',
  'formal',
  'outdoor',
];

export type ReviewCardProps = {
  item: Item;
  /** True for the visible card. Cards below the top render smaller and inert. */
  isTop: boolean;
  /** Ordinal from the top; 0 = active, 1 = peeking underneath, 2+ = hidden. */
  depth: number;
  /**
   * Fires when the user drags the top card past the confirm threshold.
   * The parent is expected to await the mutation, then advance the deck.
   */
  onConfirm: (patch?: { category?: ItemCategory; occasions?: string[] }) => void;
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

  const commit = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dragged = e.translationX + e.velocityX * 0.15;
      if (dragged > SWIPE_THRESHOLD) {
        // Fly off right → confirm.
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: motion.duration.slow });
        runOnJS(fireHaptic)();
        runOnJS(commit)();
      } else if (dragged < -SWIPE_THRESHOLD) {
        // Fly off left → skip for now; the parent treats this the same as
        // "next" without marking verified.
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: motion.duration.slow });
        runOnJS(commit)(); // Same handler — parent decides how to interpret.
      } else {
        translateX.value = withSpring(0, motion.spring);
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
        accessibilityRole="adjustable"
        accessibilityLabel={`Reviewing ${item.subcategory ?? item.category}. Swipe right to confirm, left to skip.`}>
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
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
