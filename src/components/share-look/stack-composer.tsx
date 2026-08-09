import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { LookPlate, type ResolveImage } from '@/components/look/look-plate';
import { GarmentCell } from '@/components/today/garment-cell';
import { Text } from '@/components/ui/text';
import { garmentDisplayName, garmentMetaLine, moveStackPiece } from '@/features/share-look/compose';
import type { Garment } from '@/lib/styling';
import { spring, useTheme } from '@/theme/tokens';

/** Each row's height, including its hairline — the drag math's one constant. */
const ROW_HEIGHT = 64;

/**
 * S-02 — the composed plate above, the stack list below.
 *
 * "The plate above is the artefact... order lives in the list, not on the
 * plate." `LookPlate` (read-only, Phase 1) draws the artefact; this only
 * reorders the list under it. No filter, no sticker, no free canvas — the one
 * gesture this screen offers is drag-to-reorder, on the handle at each row's
 * trailing edge so the rest of the row stays a plain scrollable list.
 */
export function StackComposer({
  stack,
  resolveImage,
  plateWidth,
  onReorder,
  onAddAnother,
}: {
  stack: Garment[];
  resolveImage: ResolveImage;
  plateWidth: number;
  onReorder: (next: Garment[]) => void;
  onAddAnother: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <LookPlate pieces={stack} width={plateWidth} resolveImage={resolveImage} padding={16} gap={10} />

      <View className="mt-[18px]">
        {stack.map((piece, index) => (
          <StackRow
            key={piece.id}
            piece={piece}
            index={index}
            count={stack.length}
            isLast={index === stack.length - 1}
            resolveImage={resolveImage}
            onDrop={(from, to) => onReorder(moveStackPiece(stack, from, to))}
          />
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add another piece"
          onPress={onAddAnother}
          className="flex-row items-center gap-3 py-3.5 active:opacity-60">
          <View style={{ width: 20 }} />
          <View
            className="items-center justify-center rounded-md"
            style={{ width: 40, height: 40, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.ruleStrong }}>
            <SymbolView name="plus" size={12} tintColor={theme.faint} resizeMode="scaleAspectFit" />
          </View>
          <Text variant="body" style={{ color: theme.muted }} className="flex-1">
            Add another piece
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StackRow({
  piece,
  index,
  count,
  isLast,
  resolveImage,
  onDrop,
}: {
  piece: Garment;
  index: number;
  count: number;
  isLast: boolean;
  resolveImage: ResolveImage;
  onDrop: (from: number, to: number) => void;
}) {
  const theme = useTheme();
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0); // 0/1, animated — drives the blush fade
  const [dragging, setDragging] = useState(false);

  const targetIndexFor = useCallback(
    (y: number) => {
      const raw = index + Math.round(y / ROW_HEIGHT);
      return Math.max(0, Math.min(count - 1, raw));
    },
    [index, count],
  );

  const begin = useCallback(() => setDragging(true), []);
  const end = useCallback(
    (y: number) => {
      setDragging(false);
      const target = targetIndexFor(y);
      if (target !== index) onDrop(index, target);
    },
    [targetIndexFor, index, onDrop],
  );

  const pan = Gesture.Pan()
    .onStart(() => {
      lifted.value = withSpring(1, spring.interactive);
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(end)(e.translationY);
    })
    .onFinalize(() => {
      translateY.value = withSpring(0, spring.interactive);
      lifted.value = withSpring(0, spring.interactive);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: Math.round(lifted.value),
    shadowColor: theme.ink,
    shadowOpacity: lifted.value * 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  }));

  return (
    <Animated.View style={rowStyle}>
      <View
        className={isLast ? '' : 'border-b border-hairline dark:border-hairline-dark'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: dragging ? 8 : 0,
          borderRadius: dragging ? 10 : 0,
          backgroundColor: dragging ? theme.blush : 'transparent',
        }}>
        <Text
          variant="caption"
          style={{
            width: 20,
            fontFamily: 'ui-monospace',
            fontSize: 11,
            // `muted`, never `faint`: this numeral is the piece's own stack
            // position, real information a poster reads back, not a
            // decorative label — see the contract's AA refusal on `faint`.
            color: dragging ? theme.accent : theme.muted,
          }}>
          {index + 1}
        </Text>

        <View
          className="overflow-hidden rounded-md bg-tray dark:bg-tray-dark"
          style={{ width: 40, height: 40 }}>
          <GarmentCell
            garment={piece}
            uri={resolveImage(piece.platePath, piece.cutoutPath, piece.thumbPath)}
          />
        </View>

        <View className="flex-1">
          <Text variant="body" numberOfLines={1}>
            {garmentDisplayName(piece)}
          </Text>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: dragging ? theme.accent : theme.muted }}>
            {dragging ? 'Lifted — drop to place' : garmentMetaLine(piece) || ' '}
          </Text>
        </View>

        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel={`Reorder ${garmentDisplayName(piece)}`}
            accessibilityHint="Drag up or down to change its place in the stack"
            hitSlop={10}
            style={{ padding: 6 }}>
            <SymbolView
              name="line.3.horizontal"
              size={14}
              tintColor={dragging ? theme.accent : theme.faint}
              resizeMode="scaleAspectFit"
            />
          </View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}
