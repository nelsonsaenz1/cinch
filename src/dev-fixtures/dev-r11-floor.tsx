import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetFloor } from '@/components/today/closet-floor';
import { Text } from '@/components/ui/text';
import { PARTIAL_CLOSET, noImages } from '@/components/today/w3-g2-fixtures';
import { piecesRemaining } from '@/features/today/today-spec';

/**
 * DEV ONLY · Redesign 11 — the activation floor, at nought and at six.
 *
 * The frame this fixture is checked against says "Start with ten pieces", and
 * the reason it can say it is that Today's gate moved to ten with the sentence.
 * Before redesign 11 the gate was the engine's eight, so a closet of eight got
 * outfits under a screen that had just promised ten and a closet of nine was
 * told nothing at all.
 *
 * Two poses, because the empty and the partial closets are different frames:
 * the empty one has no progress to report and both intake doors on it, and the
 * partial one leads with what the reader has already done.
 */
export default function DevR11Floor() {
  const [pieces, setPieces] = useState(0);
  const items = PARTIAL_CLOSET.slice(0, pieces);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="px-gutter pt-4 flex-row" style={{ gap: 8 }}>
          {[0, 6].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} pieces`}
              onPress={() => setPieces(n)}
              style={{ minHeight: 44, justifyContent: 'center' }}
              className={n === pieces ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
              <Text variant="label">{n} in</Text>
            </Pressable>
          ))}
        </View>
        <ClosetFloor
          items={items}
          remaining={piecesRemaining(items.length)}
          resolveImage={noImages}
          onStart={() => {}}
          onDescribe={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
