import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { shadow, useTheme } from '@/theme/tokens';

/**
 * I-02 — "Out of rotation, or gone?" (Item Detail State Atlas).
 *
 * The sheet that stands between a tap on "Delete this piece" and anything
 * actually happening. Its whole argument is the ORDER OF THE THREE CONTROLS:
 * storage leads, and it is the only filled button on the sheet. Deleting is
 * available, outlined, one step down — so the destructive path takes a
 * deliberate second read rather than being the thing under the thumb. Do not
 * reorder these and do not promote "Delete permanently" to the fill; the frame
 * exists to say that storage is what most people actually mean.
 *
 * DISMISSAL IS ALLOWED HERE, and that is a deliberate departure from
 * `ingest/consent-sheet.tsx`, the sheet this one is otherwise built like. The
 * consent sheet makes its scrim inert and swallows hardware back, because a
 * stray tap outside a consent question must never be recorded as an answer to
 * it in either direction. This question is not like that: backing out means
 * "leave the piece exactly as it is", which is a real, safe and complete
 * answer. So the scrim and hardware back both run `onCancel`.
 *
 * Purely presentational — props in, callbacks out. It owns no mutation and no
 * knowledge of what storage or deletion do; the screen passes `busy` while its
 * own mutation is in flight and the sheet only decides which control wears the
 * spinner.
 */

/** `theme.*` hexes are always `#RRGGBB`; alpha variants derive, never retype. */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Atlas: the sheet floats 10pt clear of the left, right and bottom edges. */
const SHEET_INSET = 10;

/** Atlas: 48pt controls, taller than the 44pt floor `Button` guarantees. */
const CONTROL_HEIGHT = 48;

/** `rounded-md`, the same radius `ui/button.tsx` draws its own pill at. */
const CONTROL_RADIUS = 12;

/**
 * The atlas shadow (0 18px 44px at 28%) as the app's one contact shadow scaled
 * up — a sheet has lifted much further off the paper than a plate, so every
 * term grows together instead of picking three new numbers. Same treatment
 * `closet/closet-menu.tsx` gives its popover.
 */
const SHEET_SHADOW_SCALE = 4;

/**
 * The one control the shared `Button` cannot express: an oxblood outline with
 * an oxblood label. `variant="secondary"` draws its ring in the structural
 * `rule` colour and sets the label in ink, and both live inside `ground()` /
 * `labelKey` where no prop reaches them. A local pressable keeps the atlas's
 * treatment without teaching Button a fifth variant for a single call site —
 * the same trade `closet/ghost-slot-grid.tsx` makes for its ink invitation.
 *
 * Everything else is Button's anatomy verbatim: the same press feedback on the
 * same two animated layers, the same 40% disabled dim, the same selection tap.
 * The label is `body`/semibold rather than the atlas's 16px so it sets on the
 * same line as the two real Buttons stacked either side of it — one type
 * grammar down the stack beats a 1px match to the mock.
 */
function OutlinedDestructiveButton({
  title,
  hint,
  loading = false,
  disabled = false,
  onPress,
}: {
  title: string;
  hint: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const press = usePressFeedback(!isDisabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          /* haptics are best-effort; never block the action */
        });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ height: CONTROL_HEIGHT }}
      className={`flex-row items-center justify-center rounded-md px-5 ${
        isDisabled ? 'opacity-40' : ''
      }`}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: CONTROL_RADIUS,
            borderWidth: 1,
            borderColor: withAlpha(theme.accent, 0.45),
          },
          press.style,
        ]}
      />
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, press.style]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Text variant="body" className="font-semibold" style={{ color: theme.accent }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export type DeleteSheetProps = {
  visible: boolean;
  /** Wear count, so the sheet can name what storage preserves. */
  wears: number;
  onStore: () => void;
  onDeleteForever: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function DeleteSheet({
  visible,
  wears,
  onStore,
  onDeleteForever,
  onCancel,
  busy = false,
}: DeleteSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * Which control the spinner belongs to.
   *
   * `busy` alone says only that something is happening; it does not say which
   * of two irreversible-feeling things the user asked for, and a spinner on the
   * wrong button during a slow write would tell her she had chosen the other
   * one. Reset on the two edges that end a request — the sheet closing, and
   * `busy` falling back to false because the mutation failed and the sheet is
   * still up. Render-phase derivation rather than an effect, so the reset lands
   * in the same pass as the prop change and never a frame later.
   */
  const [pending, setPending] = useState<'store' | 'delete' | null>(null);
  const [prev, setPrev] = useState({ visible, busy });
  if (prev.visible !== visible || prev.busy !== busy) {
    setPrev({ visible, busy });
    if (!visible || !busy) setPending(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Unlike the consent sheet, hardware back is a real answer here: it means
      // "leave the piece alone". Ignored mid-write, where there is nothing left
      // to cancel.
      onRequestClose={() => {
        if (!busy) onCancel();
      }}>
      {/* The atlas dims this screen to 28%, not the 40% `scrim` token — the
          item photo behind the sheet is the thing the question is about, and it
          stays readable. Derived from `ink` rather than typed as a literal. */}
      <View style={{ flex: 1, backgroundColor: withAlpha(theme.ink, 0.28) }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          accessibilityHint="Leaves this piece in your closet unchanged."
        />

        {/* Shadow on the outer view, clipping one layer down: a view that clips
            its children clips its own shadow away too. */}
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            left: SHEET_INSET,
            right: SHEET_INSET,
            bottom: SHEET_INSET,
            borderRadius: 20,
            shadowColor: theme.ink,
            shadowOpacity: 0.28,
            shadowRadius: shadow.contact.blur * SHEET_SHADOW_SCALE,
            shadowOffset: {
              width: shadow.contact.dx,
              height: shadow.contact.dy * SHEET_SHADOW_SCALE,
            },
            ...(Platform.OS === 'android' ? { elevation: 16 } : null),
          }}>
          <View className="overflow-hidden rounded-plate bg-canvas dark:bg-canvas-dark">
            <View className="px-gutter pt-5">
              <Text variant="title" trim>
                Out of rotation, or gone?
              </Text>
              {/* 14/1.5 per the atlas, which falls between `label` (13) and
                  `callout` (16). Sized by inline `style` rather than a second
                  `text-*` class — NativeWind gives no precedence between two
                  size utilities on one element (text.tsx L63-69) — and the line
                  height moves with it, since overriding one without the other
                  is what clips glyph tops. Same escape closet-menu.tsx takes.
                  Tone is inline for the identical reason. */}
              <Text
                variant="label"
                className="mt-2.5"
                style={{ fontSize: 14, lineHeight: 21, color: theme.muted }}>
                Storage keeps the piece and its {wears} wears, hides it from the closet grid and
                stops it appearing in plans. Deleting removes the photo for good.
              </Text>
            </View>

            {/* The order is the frame. Storage first and filled; delete second
                and outlined; cancel last and unbordered. */}
            <View className="gap-2.5 px-gutter pt-4">
              <Button
                title="Move to storage"
                variant="ink"
                className="h-12"
                accessibilityLabel="Move to storage"
                accessibilityHint="Keeps the piece and its wears, and hides it from your closet."
                loading={busy && pending === 'store'}
                disabled={busy}
                onPress={() => {
                  setPending('store');
                  onStore();
                }}
              />
              <OutlinedDestructiveButton
                title="Delete permanently"
                hint="Removes the photo for good. This cannot be undone."
                loading={busy && pending === 'delete'}
                disabled={busy}
                onPress={() => {
                  setPending('delete');
                  onDeleteForever();
                }}
              />
              <Button
                title="Cancel"
                variant="ghost"
                haptic={false}
                className="h-12"
                accessibilityLabel="Cancel"
                accessibilityHint="Leaves this piece in your closet unchanged."
                disabled={busy}
                onPress={onCancel}
              />
            </View>

            {/* The sheet's bottom edge sits 10pt off the screen, so the home
                indicator is drawn ON the card — the footnote has to clear it
                itself. The atlas's own 20pt is the floor, not the answer. */}
            <View className="px-gutter pt-4" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
              <Text variant="caption" style={{ fontSize: 12, lineHeight: 17, color: theme.muted }}>
                Outfits you’ve already worn keep this piece in them either way.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
