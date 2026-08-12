import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme/tokens';

/**
 * CN-04 — consent to a batch, asked separately from consent to the feature.
 *
 * ── Why this is its own ask ────────────────────────────────────────────────
 *
 * The volume is the new fact. Turning naming on means "the next photograph I
 * add"; backfilling means "sixty-one photographs, now". A row that started that
 * on one tap was asking a bigger question in a smaller control, and the count
 * was the only part of it on screen.
 *
 * So the count is stated twice — once as the headline, once inside the sentence
 * about what will be sent — and what will NOT change is stated beside it,
 * because "will this rewrite the names I typed?" is the question the number
 * provokes and the answer is no (`upload-queue.ts`'s back-fill enqueues the
 * untagged; nothing rewrites a user-set name, a cutout, a wear or a price).
 *
 * ── The two exits the atlas draws that this one does not ───────────────────
 *
 * CN-04 draws three: all, some, none. "Choose which ones" is omitted, and
 * deliberately: `startBackfill()` enqueues every item with no `ai_tags` and
 * takes no selection, and there is no server-side or client-side notion of a
 * partial back-fill anywhere in the repository. A control that cannot be
 * honoured is worse than an absent one, so it is absent and recorded as a
 * dependency instead.
 *
 * CN-04 also states "over about two minutes". No such duration is derivable —
 * throughput depends on the upload queue, the network and the tagger's own
 * latency, and nothing measures it. An estimate printed as a fact is the thing
 * the refusals forbid ("never estimated"), so the sentence names the volume and
 * the one-at-a-time behaviour and stops there.
 *
 * Dismissal is allowed, unlike `ingest/consent-sheet.tsx`: backing out of this
 * question means "leave those pieces exactly as they are", which is the state
 * the user is already in and the complete, safe answer.
 */
export function BackfillSheet({
  visible,
  count,
  busy = false,
  onRunBackfill,
  onCancel,
}: {
  visible: boolean;
  /** Untagged pieces, counted by `useUntaggedCount`. Never estimated. */
  count: number;
  busy?: boolean;
  onRunBackfill: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const pieces = count === 1 ? '1 piece' : `${count} pieces`;
  const photographs = count === 1 ? '1 photograph' : `${count} photographs`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          disabled={busy}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          className="rounded-t-plate bg-canvas px-gutter pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 10 }}>
          <View className="items-center pb-4">
            <View className="h-[4px] w-9 rounded-full bg-sand" />
          </View>

          <Text variant="title" trim accessibilityRole="header">
            {`${pieces} were never read`}
          </Text>
          {/* `mt-5` for the designed 12pt gap: `trim` has already taken 9pt off
              the title's bottom edge and the two margins sum rather than
              collapsing. */}
          <Text variant="body" className="mt-5" style={{ color: theme.muted }}>
            They were filed while naming was off, so they carry your own names. Cinch can guess
            their details now, or leave them exactly as they are.
          </Text>

          {/* The volume, and what survives it. A tray block rather than a third
              paragraph: this is the sentence the count makes a reader want. */}
          <View className="mt-5 rounded-lg bg-tray p-4">
            <Text variant="body" style={{ color: theme.muted }}>
              {`This sends ${photographs}, one at a time. Their cutouts, wear history and prices do not change, and any name you wrote yourself is kept.`}
            </Text>
          </View>

          <View className="mt-6 gap-2.5">
            <Button
              title={`Read all ${count}`}
              variant="primary"
              loading={busy}
              accessibilityHint={`Sends ${photographs} once, then stops.`}
              onPress={onRunBackfill}
            />
            <Button
              title="Leave them as they are"
              variant="secondary"
              disabled={busy}
              haptic={false}
              accessibilityHint="Nothing is sent. New pieces follow your normal setting."
              onPress={onCancel}
            />
          </View>

          <Text variant="callout" className="mt-4" style={{ color: theme.muted }}>
            Backfilling is one-off. New pieces follow your normal setting.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
