import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { NoticeBand } from '@/components/ui/notice-band';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import {
  CANCELLATION_FACTS,
  HOST_CANCELLATION_FACTS,
  cancelledHeading,
  dayOfWearLine,
} from '@/features/event-outfits/occasion-copy';

/**
 * EV-03 — day of, and cancelled. Two states, drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Day-of turns the page into ONE action and says exactly what marking it worn
 *   will do to the diary — `dayOfWearLine` names the piece count and both
 *   destinations, because "I wore this" is the one control here whose effect
 *   lands somewhere the user is not looking. Oxblood is spent on the wear, once.
 * · correction 26 — cancellation promises only what the app actually does. Every
 *   sentence in `CANCELLATION_FACTS` was checked against the repository, not
 *   against the atlas: the mutation sets `canceled_at` and touches nothing else,
 *   the content cascades fire only on a DELETED event row, and a wear is an
 *   `outfits` row owned by `user_id` with no foreign key to the occasion at all.
 *   A diary entry belongs to the wearer, not to the occasion, so it stays.
 * · Three things are deliberately ABSENT and are asserted absent by
 *   `tests/event-cancellation.test.ts`: any promise that anyone is notified,
 *   any promise about crowns, and any hint of who had or had not answered.
 * · The host's own confirmation carries the same facts plus the one-way door.
 *
 * DETERMINISM: the copy is imported, not transcribed. No clock, no network.
 */
export default function DevW3G5EV03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16" showsVerticalScrollIndicator={false}>
        <Text variant="eyebrow" className="mt-5">
          Day of
        </Text>
        <Text variant="title" trim className="mt-2">
          Tonight at eight
        </Text>
        <Text variant="body" className="mt-3 text-muted">
          {dayOfWearLine(5)}
        </Text>
        <Button title="I wore this" haptic onPress={() => undefined} className="mt-4 self-start px-6" />

        <Rule className="mt-9" />

        <Text variant="eyebrow" className="mt-8">
          Cancelled by the host
        </Text>
        <View className="mt-3">
          <NoticeBand
            cause="CANCELLED"
            title={cancelledHeading('Sarah', 'the birthday dinner')}
            body={CANCELLATION_FACTS.join(' ')}
          />
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Button title="See the look I chose" variant="secondary" onPress={() => undefined} />
          <Button title="Read the comments" variant="secondary" onPress={() => undefined} />
        </View>

        <Text variant="eyebrow" className="mt-9">
          If you are the host cancelling
        </Text>
        <View className="mt-3 rounded-plate border border-hairline bg-surface p-4">
          <Text variant="body" className="font-semibold">
            Cancel this occasion?
          </Text>
          <Text variant="note" className="mt-1.5">
            {HOST_CANCELLATION_FACTS.join(' ')}
          </Text>
          <View className="mt-4 flex-row gap-2">
            <Button title="Keep it" variant="secondary" onPress={() => undefined} />
            <Button title="Cancel it" variant="critical" onPress={() => undefined} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
