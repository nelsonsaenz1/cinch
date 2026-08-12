import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { EntryPage } from '@/features/diary/entry-page';
import { monthLabel } from '@/features/diary/entry';
import { resolveFixtureImage, WD_ENTRIES, WD_NOW, WD_TODAY } from '@/features/diary/w3-g4-fixtures';

/**
 * WD-02 — entry detail, editable for 24 hours.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The composed-look grid, not a stack: five pieces each identifiable at 96pt.
 * · Three ruled facts under it, every one of them read off a column that
 *   already exists — the weather that day (`outfits.context_snapshot`), the
 *   cost for the look (`items.purchase_price`, all five priced, so the figure
 *   is computable), and where it came from (`generated_by` /
 *   `origin_outfit_id`). Provenance matters because a wear recorded from
 *   Today, from the diary or from a plan are different acts.
 * · audit 78 — the editability window is stated as a RULE and as a REMAINING
 *   FIGURE, so undo is never a surprise. The figure is in hours because that is
 *   the granularity the rule uses, and it is computed from the frozen clock
 *   below rather than transcribed: `WD_NOW` is ten hours after the wear, so the
 *   line reads fourteen.
 * · Undo carries oxblood text and no fill — one accent on the frame.
 *
 * WHAT IS NOT DRAWN, AND WHY
 *
 * "Change pieces", the atlas's peer to the undo. No command, no policy and no
 * client mutation can change the garments in a recorded wear; the two that
 * exist insert a wear or delete one. See the docblock at the head of
 * `features/diary/entry-page.tsx` for the full account and the dependency.
 *
 * DETERMINISM: the clock is INJECTED (`now={WD_NOW}`). Without that the "hours
 * left" figure would change every hour and the frame could not be diffed
 * against itself.
 */
export default function DevW3G4WD02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <EntryPage
        entry={WD_TODAY}
        monthLabel={monthLabel(WD_TODAY.wornAt)}
        monthCount={WD_ENTRIES.filter((e) => e.wornAt.startsWith('2026-08')).length}
        onBack={() => undefined}
        resolveImage={resolveFixtureImage}
        onWearAgain={() => undefined}
        wearingAgain={false}
        onKeep={() => undefined}
        keeping={false}
        onEditNote={() => undefined}
        correctable
        onRemove={() => undefined}
        removing={false}
        now={WD_NOW}
        error={null}
      />
    </View>
  );
}
