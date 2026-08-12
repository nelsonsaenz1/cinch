import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion } from '@/theme/tokens';

import { GRID_GAP, plateGrid, ROW_RATIO } from './plate-grid';
import { W3_ROW_HEIGHT, W3_WEAR_WEIGHT } from './reaction-spec';

/** The sand a placeholder block is drawn in — the constitution's own #EAE5DB. */
const BLOCK = { borderRadius: 12, backgroundColor: '#EAE5DB' } as const;

/**
 * One placeholder block. A module-level component, not a closure inside the
 * skeleton: a component created during render is a new type on every pass, so
 * React remounts the whole subtree and the pulse restarts under the reader.
 */
function Block({
  height,
  width = '100%',
  grow,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  grow?: number;
  /**
   * The pulse. Typed as the return of `useAnimatedStyle` via the component's
   * own call site rather than named: Reanimated's handle type is generic over
   * the style object and naming it here would pin this component to one shape
   * of pulse.
   */
  style: ReturnType<typeof useAnimatedStyle<{ opacity: number }>>;
}) {
  return (
    <Animated.View
      style={[
        BLOCK,
        grow != null
          ? { height, flexGrow: grow, flexShrink: 1, flexBasis: 0 }
          : { height, width },
        style,
      ]}
    />
  );
}

/**
 * THE PLATE SKELETON — T-07, and the additive half of T-08.
 *
 * "The skeleton mirrors the plate's exact geometry so nothing shifts when the
 * real look arrives. Every skeleton block is the exact height and radius of the
 * element it stands in for."
 *
 * That is the entire specification, and it is why this is a Today component
 * rather than a call to `PlateSkeleton` in `components/ui/skeleton.tsx`: the
 * shared one draws the RETIRED anatomy — a 5:4 garment well where the stack
 * used to be — so a look landing in the new grid would reflow the page at the
 * exact moment it arrived. The blocks here are laid out by `plateGrid()`, the
 * same function the real plate uses, so the two cannot disagree.
 *
 * Refusals it holds: no spinner and no percentage (progress on this screen is
 * not a quantity anybody can honestly state), and the placeholder blocks are
 * hidden from VoiceOver — the announcement is one sentence, not sixteen empty
 * rectangles.
 */
export function PlateSkeleton({
  /** How many cells the grid reserves. Five is the plate's own normal day. */
  pieces = 5,
  /**
   * Freeze the pulse. Defaults to the system's Reduce Motion setting, under
   * which "the shimmer stops and the blocks are static"; the fixture routes
   * pass it explicitly so a capture has a settled frame to be.
   */
  still,
  /**
   * The garments have arrived and only the reasoning is outstanding (T-08).
   * The grid is then real elsewhere on the page and only the two prose lines
   * stand in — which is what makes the slow notice additive rather than a
   * different screen.
   */
  partial = false,
}: {
  pieces?: number;
  still?: boolean;
  partial?: boolean;
}) {
  const systemReduced = useReducedMotion();
  const reduced = still ?? systemReduced;
  const { width: windowWidth } = useWindowDimensions();

  // The plate's own measure: the page gutter on both sides, then the card's
  // 14 pt padding on both sides.
  const gridWidth = Math.max(0, windowWidth - 20 * 2 - 14 * 2);
  const rowHeight = gridWidth * ROW_RATIO;
  const rows = plateGrid(pieces);

  const pulse = useSharedValue(reduced ? 1 : 0.55);

  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: motion.duration.slow * 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduced]);

  const breathing = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }));

  return (
    <View className="mb-section px-gutter">
      <View
        className="rounded-plate border border-rule bg-surface p-3.5"
        // One announcement, once. The blocks below are scenery.
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Building today's outfit">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {/* The name, at the serif plate step's own height. */}
          <Block height={30} width="62%" style={breathing} />
          {/* Two lines of reasoning. */}
          <View style={{ marginTop: 10, gap: 6 }}>
            <Block height={16} style={breathing} />
            <Block height={16} width="78%" style={breathing} />
          </View>

          {partial ? null : (
            <View style={{ marginTop: 16, gap: GRID_GAP }}>
              {rows.map((cells, rowIndex) => (
                <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: GRID_GAP }}>
                  {Array.from({ length: cells }).map((_, i) => (
                    <Block
                      key={`cell-${rowIndex}-${i}`}
                      height={rowHeight}
                      grow={1}
                      style={breathing}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* The credit line, then the ruled footer the palette sits on. */}
          <View style={{ marginTop: 10 }}>
            <Block height={13} width="86%" style={breathing} />
          </View>
          <View className="mt-3 border-t border-rule pt-2.5">
            <Block height={14} width="54%" style={breathing} />
          </View>
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
            {/* The action row, at its real 48 pt and its real 1.4 / 1 / 1
                weights, so the row below the plate does not move either. */}
            <Block height={W3_ROW_HEIGHT} grow={W3_WEAR_WEIGHT} style={breathing} />
            <Block height={W3_ROW_HEIGHT} grow={1} style={breathing} />
            <Block height={W3_ROW_HEIGHT} grow={1} style={breathing} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * T-08's notice — additive, never a replacement.
 *
 * "The garments resolve before the reasoning does, so they are shown as they
 * arrive rather than held behind the sentence. The notice appears under the
 * same layout instead of replacing it, which is what stops a slow response
 * reading as a different failure. The escape hatch is real: it renders the
 * plate with no rationale and no apology, and the reactions become live."
 */
export function SlowNotice({ onShowAnyway }: { onShowAnyway: () => void }) {
  return (
    <View
      className="mx-gutter mt-2 rounded-md bg-tray p-3.5"
      accessibilityLiveRegion="polite">
      <Text variant="label" className="font-medium">
        Taking longer than usual
      </Text>
      <Text variant="note" className="mt-1">
        The pieces are yours and already chosen. Cinch is still writing the reason it chose them.
      </Text>
      <Text
        accessibilityRole="button"
        accessibilityLabel="Show it without the reason"
        variant="note"
        className="mt-2.5 underline"
        onPress={onShowAnyway}>
        Show it without the reason
      </Text>
    </View>
  );
}

/** How long a look may take before the notice appears. The atlas draws 6 s. */
export const SLOW_NOTICE_MS = 6000;
