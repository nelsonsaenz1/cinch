import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { useTheme } from '@/theme/tokens';

/**
 * C-04 — the multi-select mode's sticky bottom action bar.
 *
 * Two 44pt buttons over a near-opaque canvas wash: `Recategorise` (rule
 * border) and `Delete {n}` (oxblood, the destructive one reads its own count
 * so the confirm that follows is about a number the user already believes).
 *
 * Bottom, not top, this time: in select mode the masthead and chips collapse
 * and the grid becomes the whole page under a Cancel/Select-all header — the
 * bottom edge is free (the atlas draws the bar over where the tab bar was)
 * and thumbs live there.
 *
 * The atlas backs the bar with canvas at 96% + an 8px blur. expo-blur is not
 * a dependency, so the blur half is dropped and the wash runs near-opaque —
 * at 96–98% over a paper-toned grid the difference is imperceptible, and
 * adding a native module for it is not this component's call. The wash is its
 * own absolute-fill layer so its opacity never dims the buttons.
 */

export type SelectionBarProps = {
  /** How many pieces are picked. Zero is a real state — both buttons go inert. */
  count: number;
  /** True while a mutation is in flight; both controls go inert. */
  busy?: boolean;
  /** Bottom padding in pt — the atlas's 26 when over the home indicator, less when floating clear of it. */
  bottomPadding?: number;
  onRecategorise: () => void;
  onDelete: () => void;
};

function BarButton({
  label,
  kind,
  disabled,
  busy = false,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  kind: 'outline' | 'destructive';
  disabled: boolean;
  busy?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { style, onPressIn, onPressOut } = usePressFeedback(!disabled);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      className="flex-1">
      {/* Inline styles throughout: className has no effect on Reanimated
          components in this project (use-press-feedback.ts L32-35). The
          disabled 50% sits after the animated style so it wins the opacity. */}
      <Animated.View
        style={[
          style,
          {
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          },
          kind === 'destructive'
            ? { backgroundColor: theme.accent }
            : { borderWidth: 1, borderColor: theme.rule },
          disabled ? { opacity: 0.5 } : null,
        ]}>
        {busy && kind === 'destructive' ? (
          <ActivityIndicator size="small" color={theme.canvas} />
        ) : (
          // Reference board A, both halves of it. `destructive` is a FILLED
          // control (accent ground) and keeps Medium; the outlined sibling
          // drops to regular. Both sit at `body` 17 — the atlas's 15/600 was
          // the pre-refacing cut, and a bar that shouts at two volumes beside
          // the shared Button is the drift this board exists to end.
          <Text
            variant="body"
            style={{ color: kind === 'destructive' ? theme.canvas : theme.ink }}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function SelectionBar({
  count,
  busy = false,
  bottomPadding = 26,
  onRecategorise,
  onDelete,
}: SelectionBarProps) {
  const nothingPicked = count === 0;
  const inert = busy || nothingPicked;

  return (
    <View className="border-t border-hairline">
      {/* The canvas wash — its own layer so the 96% never dims the buttons. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 0.96 }]} className="bg-canvas" />

      {/* 12 / 20 / 26 padding and the 10pt gap are the atlas's, literal. The
          atlas's 26 bottom assumes the bar sits over the home indicator; the
          shipping bar floats above the native tab bar, so the screen passes
          the padding that fits where it actually landed. */}
      <View
        className="flex-row px-gutter"
        style={{ paddingTop: 12, paddingBottom: bottomPadding, gap: 10 }}
        accessibilityLiveRegion="polite">
        <BarButton
          label="Recategorise"
          kind="outline"
          disabled={inert}
          onPress={onRecategorise}
          accessibilityLabel={nothingPicked ? 'Recategorise' : `Recategorise ${count} pieces`}
        />
        <BarButton
          label={nothingPicked ? 'Delete' : `Delete ${count}`}
          kind="destructive"
          disabled={inert}
          busy={busy}
          onPress={onDelete}
          accessibilityLabel={nothingPicked ? 'Delete' : `Delete ${count} pieces`}
        />
      </View>
    </View>
  );
}
