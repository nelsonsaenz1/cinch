import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

export type ItemEditDraft = {
  /** The specific word for the garment — writes to `subcategory`. */
  name: string;
  /** Raw text, parsed by the caller. Empty string clears the price. */
  price: string;
};

export type ItemEditSheetProps = {
  visible: boolean;
  initial: ItemEditDraft;
  onSave: (next: ItemEditDraft) => void;
  onCancel: () => void;
  busy?: boolean;
  /** Set when the last save failed, so the sheet can say so without closing. */
  error?: string | null;
};

/**
 * What the pencil on the photograph opens.
 *
 * ── Why this component exists at all ──────────────────────────────────────
 *
 * The atlas draws a pencil disc on the hero and never says what is behind it.
 * It also deletes the two editors the old page carried in its body: the inline
 * price row ("Cost per wear needs what you paid.") and the tap-to-rename title.
 * Shipping the frame literally would therefore have removed the only way to
 * enter a purchase price — which is the number the entire cost-per-wear figure,
 * and a good part of the product, is computed from.
 *
 * So the pencil is where both went. That is the smallest honest reading of the
 * frame: the atlas moved editing OFF the reading surface, it did not decide the
 * app should stop editing. Name and price are the two fields the old page let a
 * person change by hand; every other tag is chips, and chips live on the page.
 *
 * ── Sheet mechanics ───────────────────────────────────────────────────────
 *
 * Same grammar as `ingest/consent-sheet.tsx` — a bottom sheet inside a `Modal`
 * over the dimmed screen — but with the OPPOSITE dismissal rule. Consent may
 * not be dismissed, because a stray tap must never be recorded as an answer to
 * a consent question. Here dismissal is simply "I changed nothing", which is a
 * real and safe answer, so the scrim and hardware back both cancel.
 */
export function ItemEditSheet({
  visible,
  initial,
  onSave,
  onCancel,
  busy = false,
  error = null,
}: ItemEditSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<ItemEditDraft>(initial);

  /**
   * Re-seed from the row every time the sheet OPENS, and only then.
   *
   * Adjusted during render rather than in an effect — React's own "adjusting
   * state when a prop changes" pattern. An effect would set state after a
   * committed paint, which is both a cascading render and a visible frame of
   * the previous item's values; it also trips `react-hooks/set-state-in-effect`.
   *
   * The trigger is `visible`, deliberately NOT `initial`: `initial` is a fresh
   * object literal on every render of the page, so keying on it would reset the
   * field under the user's cursor — and this screen re-renders on every
   * keystroke of the price field.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(initial);
  }

  const y = useSharedValue(visible ? 0 : 1);
  useEffect(() => {
    y.value = withSpring(visible ? 0 : 1, spring.smooth);
  }, [visible, y]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * 40 }],
    opacity: 1 - y.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent>
      <View className="flex-1 justify-end">
        {/* The atlas's own dimming value for a sheet over this screen (I-02),
            not the 40% `scrim` token — a garment photograph stays readable
            behind the ask at 28%. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={busy}
          onPress={onCancel}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,26,22,0.28)' }}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[sheetStyle, { marginBottom: Math.max(insets.bottom, 10) + 10 }]}
          className="mx-2.5 overflow-hidden rounded-plate bg-canvas">
          <View className="px-5 pt-5">
            <Text variant="title">Edit this piece</Text>
            <Text variant="note" className="mt-2.5 text-muted">
              The name is what the closet, the rails and the plans call it. The price is what
              cost per wear is computed from.
            </Text>
          </View>

          <View className="px-5 pt-4">
            <Field label="Name">
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
                placeholder="Untitled piece"
                // IT-03 sets every value and every explanation in the regular
                // cut at the frame's secondary colour; `faint` is refused as
                // text anywhere, and a field's placeholder is text.
                placeholderTextColor={theme.muted}
                accessibilityLabel="Piece name"
                returnKeyType="done"
                editable={!busy}
                className="flex-1 font-body text-callout"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </Field>

            <View className="h-2.5" />

            <Field label="Paid">
              <Text variant="callout" className="text-muted">
                $
              </Text>
              <TextInput
                value={draft.price}
                onChangeText={(price) => setDraft((d) => ({ ...d, price }))}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0"
                placeholderTextColor={theme.muted}
                accessibilityLabel="Price paid, in dollars"
                returnKeyType="done"
                editable={!busy}
                className="ml-1 flex-1 font-body text-callout"
                style={{ minHeight: MIN_TAP_TARGET, color: theme.ink }}
              />
            </Field>
          </View>

          {error ? (
            <Text
              variant="label"
              accessibilityLiveRegion="polite"
              className="px-5 pt-3 text-critical">
              {error}
            </Text>
          ) : null}

          <View className="gap-2.5 px-5 pb-5 pt-4">
            <Button title="Save" loading={busy} onPress={() => onSave(draft)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={onCancel}
              style={{ height: 48 }}
              className="items-center justify-center active:opacity-60">
              <Text variant="callout" className="text-muted">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A labelled field well — the eyebrow above, the bordered row below. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="colophon" className="mb-1.5">
        {label}
      </Text>
      <View
        className="flex-row items-center rounded-md border border-rule px-3"
        style={{ minHeight: MIN_TAP_TARGET }}>
        {children}
      </View>
    </View>
  );
}
