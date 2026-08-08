import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useTheme } from '@/theme/tokens';

export type BorrowLendSheetProps = {
  visible: boolean;
  /** The garment's own name — "Shearling coat", not the request sentence. */
  itemName: string;
  /**
   * The item's wear count, or null when it could not be fetched cheaply.
   * Null OMITS the "Yours · n wears" line entirely — never a faked figure.
   */
  wears: number | null;
  /** First name only — the headline reads "Lend it to Ada?". */
  counterpartFirstName: string;
  imageUri?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

/**
 * BR-03 — the lend confirm, the page's only sheet, because lending is the only
 * action that moves an object in the world. Decline and withdraw commit on tap
 * with an undo toast instead; this sheet must never grow siblings.
 *
 * Same presentation as ConsentSheet: a bottom sheet inside a transparent Modal
 * over the scrim, grabber on top. Unlike consent, a tap on the scrim IS a
 * valid answer here — it means "not now", which sends nothing — so the scrim
 * dismisses and hardware back does too.
 */
export function BorrowLendSheet({
  visible,
  itemName,
  wears,
  counterpartFirstName,
  imageUri,
  onConfirm,
  onDismiss,
  busy = false,
}: BorrowLendSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        {/* Backing out of the sheet lends nothing, so the scrim may answer. */}
        <Pressable
          accessibilityLabel="Close without lending"
          onPress={busy ? undefined : onDismiss}
          className="flex-1"
        />

        <View
          className="rounded-t-plate bg-canvas px-6 pb-4"
          style={{ paddingBottom: insets.bottom + 16 }}>
          {/* The grabber — the sheet's own furniture, per the consent sheet. */}
          <View className="items-center pb-3 pt-2.5">
            <View className="h-[5px] w-9 rounded-full bg-sand" />
          </View>

          {/* BR-03's identity row: the piece being decided about. The 20pt gap
              to the headline lives here as `mb-5` — the trimmed title cannot
              carry its own `mt-*` without stacking against trim's margins. */}
          <View className="mb-5 flex-row items-center gap-3">
            <View
              className="items-center justify-center overflow-hidden bg-tray"
              style={{ width: 56, height: 56, borderRadius: 10 }}>
              {imageUri ? (
                <Image
                  source={stableImageSource(imageUri)}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <SymbolView
                  name="tshirt"
                  size={20}
                  tintColor={theme.hairline}
                  resizeMode="scaleAspectFit"
                />
              )}
            </View>
            <View className="flex-1">
              <Text variant="callout" className="font-semibold">
                {itemName}
              </Text>
              {wears !== null ? (
                <Text variant="note" className="mt-0.5">
                  Yours · {wears} wears
                </Text>
              ) : null}
            </View>
          </View>

          {/* 28px serif in the atlas — `title` is exactly that step. */}
          <Text variant="title" trim accessibilityRole="header">
            Lend it to {counterpartFirstName}?
          </Text>
          {/* Muted inline, not a stacked `text-muted` — the callout variant
              already carries `text-ink` and two colour utilities on one element
              resolve by stylesheet order, not call-site intent. */}
          <Text variant="callout" className="mt-2.5" style={{ color: theme.muted }}>
            She&rsquo;ll see your yes the next time she looks. Work out the handover between you
            &mdash; Cinch won&rsquo;t chase either of you, and there&rsquo;s no date to keep.
          </Text>

          <View className="mt-5 gap-2.5">
            <Button title="Yes, lend it" variant="ink" loading={busy} onPress={onConfirm} />
            <Button title="Not now" variant="secondary" disabled={busy} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
