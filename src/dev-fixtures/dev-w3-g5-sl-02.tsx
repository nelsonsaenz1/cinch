import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FailedDraftBanner } from '@/components/share-look/edge-states';
import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { canCompose } from '@/features/share-look/compose';
import { G5_CANDIDATES } from '@/features/event-outfits/w3-g5-fixtures';

/**
 * SL-02 — nothing selected, and a failed post. Two states, drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · correction 27 — with NOTHING selected the bar keeps its height and its
 *   shape, so nothing jumps when the first piece is chosen, and Compose becomes
 *   INERT PAPER with the requirement printed beside it rather than a dimmed
 *   oxblood button. The requirement names BOTH BOUNDS — two to six — so a user
 *   learns the ceiling before hitting it rather than at the refusal.
 * · The requirement, the count and the refusal all occupy the same slot in the
 *   bar, which is what "refused in the same place the count lives" means.
 * · SL-02's failure keeps the selection, the ORDER and the CAPTION, says so
 *   explicitly, and confirms NOBODY WAS NOTIFIED. Verified: the post is a
 *   single insert through `useComposeAndPostLook`, and every notification in
 *   this product is a trigger on a row that now exists
 *   (`supabase/migrations/20260810110100_push_senders.sql`) — a write that
 *   failed inserted no row, so no sender fired.
 *
 * PARKED — "Save it for later". The atlas calls it "a real second outcome
 * rather than a dismissal". There is no draft table, no local persistence and
 * no save mutation anywhere in `features/share-look/**`; the only write in the
 * whole flow is the post. A button with that label could only close the banner
 * and leave the state in memory until the screen unmounts, which is a dead
 * control wearing a promise. "Keep editing" ships instead, and says exactly
 * what it does.
 *
 * Also corrected: the old banner said the look was "saved as a draft". Nothing
 * writes a draft — every field lives in the screen's own state and leaving
 * loses it — so the sentence now says the pieces, the order and the caption are
 * still here, which is what is actually true.
 *
 * DETERMINISM: an empty stack literal and a frozen candidate set. No clock, no
 * network, no spinner, no shimmer.
 */
export default function DevW3G5SL02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const noop = () => undefined;
  const resolve = (...paths: (string | null | undefined)[]) =>
    paths.find((p): p is string => Boolean(p));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2" style={{ minHeight: 44 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel">
          <Text variant="body" className="text-muted">
            Cancel
          </Text>
        </Pressable>
        <Text variant="colophon">Build a look</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Suggest">
          <Text variant="body">Suggest</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-4 pt-4">
        <Text variant="eyebrow">Posting failed</Text>
        <View className="mt-3">
          <FailedDraftBanner
            pieceCount={3}
            hasCaption
            onRetry={noop}
            onKeepDraft={noop}
          />
        </View>

        <Rule className="mt-8" />

        <Text variant="eyebrow" className="mt-8 mb-3">
          Nothing selected yet
        </Text>
        <PiecePicker
          candidates={G5_CANDIDATES.slice(0, 6)}
          stack={[]}
          resolveImage={resolve}
          onChangeStack={noop}
          onRefused={noop}
        />
      </ScrollView>

      <View className="px-gutter">
        <PickerFooterTray
          stack={[]}
          resolveImage={resolve}
          canCompose={canCompose([])}
          onCompose={noop}
        />
      </View>
    </SafeAreaView>
  );
}
