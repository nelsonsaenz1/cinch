import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { shadow, useTheme } from '@/theme/tokens';

/**
 * The one panel behind three encounters with the limit — The Gap Feed's G-04
 * ("tapping a locked suggestion"), The Wall's W-02 (the camera path) and W-03
 * (the listing-link path). All three atlases draw the identical shape: a
 * tracked eyebrow, a serif headline, one line of body copy, a filled oxblood
 * "See plans", one outlined alternative at equal weight, and — camera only —
 * a plain "Not now".
 *
 * ONE OXBLOOD ACTION. "See plans" is the only filled accent control; the
 * outlined alternative is `rule-strong`-bordered ink, per rule 9.
 *
 * "See plans" hands to the existing Superwall sheet — this component carries
 * no price, no trial length, no plan comparison; the caller supplies only the
 * `onSeePlans` callback and the gate itself lives in `use-gate.ts`.
 *
 * Split into `ClosetFullPanel` (bare content) and `ClosetFullSheet` (the same
 * content inside its own bottom-sheet `Modal`) because W-03's screen is
 * ALREADY a modal sheet (`GarmentSearchSheet`'s `pageSheet` presentation) —
 * stacking a second `Modal` over the first is a broken back-gesture and a
 * doubled dim. W-03 renders the bare panel inline, in place of its usual
 * footer; G-04 and W-02 render the full sheet over whatever screen they're on.
 */
export type ClosetFullContentProps = {
  eyebrow: string;
  title: string;
  body: string;
  onSeePlans: () => void;
  seePlansBusy?: boolean;
  /**
   * The filled action's label. "See plans" everywhere but one place: the
   * camera path's Reveal-first door (A28, `overLimitDoor`), where the filled
   * action opens the outfits and the plans move to the outlined one.
   */
  primaryLabel?: string;
  /** "Make room for it" (Wall) or "Swap a piece out instead" (Gap Feed) — same weight, same place. */
  secondaryLabel: string;
  onSecondary: () => void;
  /** Camera and listing paths offer it; the Gap Feed's sheet does not. */
  tertiaryLabel?: string;
  onTertiary?: () => void;
  /**
   * The closing reassurance under the buttons — G-04's "Swapping keeps your
   * ten at ten. The suggestion stays here either way." Optional: W-02 and
   * W-03 carry their own closing lines outside this panel instead (a live
   * photo's "nothing is taken or lost", the held-import note under the
   * search sheet), so a shared default here would be one of them said twice.
   */
  footnote?: string;
};

export function ClosetFullPanel({
  eyebrow,
  title,
  body,
  onSeePlans,
  seePlansBusy = false,
  primaryLabel = 'See plans',
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
  footnote,
}: ClosetFullContentProps) {
  const theme = useTheme();

  return (
    <View>
      <Text variant="eyebrow" className="mb-1.5">
        {eyebrow}
      </Text>
      <Text variant="title" trim style={{ fontSize: 26, lineHeight: 32 }}>
        {title}
      </Text>
      <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
        {body}
      </Text>

      <View className="mt-4" style={{ gap: 8 }}>
        <Button title={primaryLabel} variant="primary" loading={seePlansBusy} onPress={onSeePlans} />
        <Button title={secondaryLabel} variant="secondary" onPress={onSecondary} />
        {tertiaryLabel ? (
          <Pressable
            onPress={onTertiary}
            accessibilityRole="button"
            accessibilityLabel={tertiaryLabel}
            className="items-center py-1.5 active:opacity-60">
            <Text variant="body" style={{ color: theme.muted }}>
              {tertiaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {footnote ? (
        <Text variant="caption" className="mt-3.5" style={{ color: theme.muted }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SHEET_SHADOW_SCALE = 4;

export type ClosetFullSheetProps = ClosetFullContentProps & {
  visible: boolean;
  onDismiss: () => void;
};

export function ClosetFullSheet({ visible, onDismiss, ...content }: ClosetFullSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: withAlpha(theme.ink, 0.4) }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          accessibilityHint="Nothing here is added or deleted; this closes the sheet."
        />

        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            shadowColor: theme.ink,
            shadowOpacity: 0.28,
            shadowRadius: shadow.contact.blur * SHEET_SHADOW_SCALE,
            shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy * SHEET_SHADOW_SCALE },
            ...(Platform.OS === 'android' ? { elevation: 16 } : null),
          }}>
          <View
            className="rounded-t-plate border-t border-rule bg-surface px-gutter pt-5"
            style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="self-center rounded-full bg-rule" style={{ width: 40, height: 4, marginBottom: 18 }} />
            <ClosetFullPanel {...content} onTertiary={content.onTertiary ?? onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
