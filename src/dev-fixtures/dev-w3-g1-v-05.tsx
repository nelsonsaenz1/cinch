/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-05.
 *
 * Heard, and handing to the procession. The composition chips are counts of
 * what was HEARD, not of what will be kept — the sentence above them says so
 * before the numbers are read. Unmatched phrases are named as KEPT rather than
 * silently discarded. No outfit total is printed: that arithmetic belongs to
 * the Reveal, after the list is confirmed.
 *
 * Deterministic by construction: the chips are computed from the frozen
 * twenty-three-piece `DEV_DRAFTS`, so they are derived rather than typed and
 * still identical on every capture.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { kindOfSlot } from '@/features/closet/outfit-count';
import { DEV_DRAFTS } from '@/features/intake/dev-fixtures';
import {
  HEARD,
  heardChips,
  heardHeadline,
  unmatchedTitle,
} from '@/features/intake/walkthrough-copy';

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const counts: Record<string, number> = {};
  let pieces = 0;
  for (const d of DEV_DRAFTS) {
    const slot = d.slot as Parameters<typeof kindOfSlot>[0];
    const key = kindOfSlot(slot) ?? slot;
    // One per card — an ambiguous plural is still one phrase heard.
    counts[key] = (counts[key] ?? 0) + 1;
    pieces += 1;
  }
  const chips = heardChips(counts);
  // Six phrases the parse could not place — the atlas's own figure, held as a
  // literal because the fixture has no transcript to derive it from.
  const missedTitle = unmatchedTitle(6);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerClassName="px-gutter pb-4" style={{ flex: 1 }}>
          <Text variant="eyebrow" className="pt-4">
            {HEARD.eyebrow}
          </Text>
          <View style={{ marginTop: 6, marginBottom: 12 }}>
            <Text variant="display" trim accessibilityRole="header">
              {heardHeadline(pieces)}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {HEARD.body}
          </Text>
          <View className="flex-row flex-wrap" style={{ marginTop: 20, gap: 8 }}>
            {chips.map((chip) => (
              <View
                key={chip}
                className="bg-tray"
                style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text variant="body" style={{ fontSize: 14 }}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>
          {missedTitle ? (
            <View style={{ marginTop: 24 }}>
              <Text variant="heading" className="mb-1" style={{ fontSize: 15 }}>
                {missedTitle}
              </Text>
              <Text variant="note" style={{ fontSize: 14, lineHeight: 21 }}>
                {HEARD.unmatchedBody}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View className="px-gutter">
          <Button title={HEARD.action} onPress={() => {}} className="self-stretch" />
        </View>
      </SafeAreaView>
    </View>
  );
}
