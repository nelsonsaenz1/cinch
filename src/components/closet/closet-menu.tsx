import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { motion, shadow, useTheme } from '@/theme/tokens';

/**
 * C-03 — the ellipsis menu, as an anchored popover.
 *
 * A positioned card, not ActionSheetIOS: the atlas draws the same white card on
 * both platforms (232pt, 16pt radius, rule border), floating under the header's
 * ellipsis button while the page behind drops to 40% opacity. There is no dark
 * scrim — the DIMMING IS THE SCREEN'S JOB (it owns the content that dims); this
 * component contributes only the card and the tap-outside catcher.
 *
 * Four rows, no submenus. `Review tags` carries the app's only badge and
 * disappears entirely at zero, so the menu is three items for most users.
 */

export type ClosetMenuProps = {
  visible: boolean;
  /**
   * Where the card's top-right corner sits, in screen coordinates of the
   * containing overlay. Defaults to the atlas placement (16pt from the right
   * edge, 96pt down — just under the header row). A screen that measures its
   * ellipsis button can pass something exact.
   */
  anchor?: { top: number; right?: number };
  /** Pending tag reviews. The `Review tags` row is hidden entirely at 0. */
  reviewCount: number;
  onReviewTags: () => void;
  onSelectPieces: () => void;
  /** Opens the list of pieces taken out of rotation — the way back from archive. */
  onStorage: () => void;
  onProfileSettings: () => void;
  /** Tap anywhere outside the card. */
  onDismiss: () => void;
};

/** Atlas: right:16, top:96 under a 54pt status bar + header row. */
const DEFAULT_ANCHOR = { top: 96, right: 16 };

const CARD_WIDTH = 232;

/**
 * The atlas shadow (0 14px 34px at 18%) expressed as the app's one contact
 * shadow scaled up — the card has lifted further off the paper than a plate,
 * so every term grows together instead of picking four new numbers.
 */
const CARD_SHADOW_SCALE = 2.9;

function MenuRow({
  label,
  badge,
  separated,
  onPress,
}: {
  label: string;
  badge?: number;
  /** Draw the hairline under this row (all but the last). */
  separated?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { style, onPressIn, onPressOut } = usePressFeedback();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={badge !== undefined ? `${label}, ${badge} pending` : label}>
      <Animated.View
        style={[
          style,
          {
            paddingVertical: 13,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          separated ? { borderBottomWidth: 1, borderBottomColor: theme.hairline } : null,
        ]}>
        {/* 15/500 per the atlas. Sized by `style` rather than a second text-*
            class — NativeWind gives no precedence between two size utilities
            (see text.tsx L63-69), and `style` wins deterministically. */}
        <Text variant="label" style={{ fontSize: 15, lineHeight: 20, color: theme.ink }}>
          {label}
        </Text>
        {badge !== undefined ? (
          <View
            className="items-center justify-center rounded-full bg-accent"
            style={{ minWidth: 20, height: 20, paddingHorizontal: 6 }}>
            <Text variant="caption" style={{ color: theme.canvas }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function ClosetMenu({
  visible,
  anchor,
  reviewCount,
  onReviewTags,
  onSelectPieces,
  onStorage,
  onProfileSettings,
  onDismiss,
}: ClosetMenuProps) {
  const theme = useTheme();

  if (!visible) return null;

  const top = anchor?.top ?? DEFAULT_ANCHOR.top;
  const right = anchor?.right ?? DEFAULT_ANCHOR.right;

  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.fast)}
      exiting={FadeOut.duration(motion.duration.fast)}
      style={StyleSheet.absoluteFill}
      // VoiceOver treats the open menu as modal — focus cannot wander into the
      // dimmed page behind it.
      accessibilityViewIsModal
      pointerEvents="auto">
      {/* Tap-outside catcher. Transparent by design: the 40%-opacity dimming of
          the page is the screen's own render, not a scrim drawn here. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
      />

      {/* Shadow lives on this wrapper; the clipping happens one layer down.
          A view that clips its children also clips its own shadow away — the
          same split plate.tsx documents. */}
      <View
        style={{
          position: 'absolute',
          top,
          right,
          width: CARD_WIDTH,
          borderRadius: 16,
          shadowColor: theme.ink,
          shadowOpacity: 0.18,
          shadowRadius: shadow.contact.blur * CARD_SHADOW_SCALE,
          shadowOffset: {
            width: shadow.contact.dx,
            height: shadow.contact.dy * CARD_SHADOW_SCALE,
          },
          ...(Platform.OS === 'android' ? { elevation: 12 } : null),
        }}>
        <View className="overflow-hidden rounded-[16px] border border-rule bg-surface">
          {reviewCount > 0 ? (
            <MenuRow label="Review tags" badge={reviewCount} separated onPress={onReviewTags} />
          ) : null}
          <MenuRow label="Select pieces" separated onPress={onSelectPieces} />
          {/* Above Profile rather than below it: storage is a closet action,
              and the menu reads closet-first with the way off this screen
              last. Always present, even at zero stored pieces — the empty
              state is how someone learns the drawer exists, and a row that
              appears only once you have used it teaches nothing. */}
          <MenuRow label="Storage" separated onPress={onStorage} />
          <MenuRow label="Profile & settings" onPress={onProfileSettings} />
        </View>
      </View>
    </Animated.View>
  );
}
