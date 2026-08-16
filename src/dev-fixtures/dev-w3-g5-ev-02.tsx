import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { inviteeStatusLine, noLookYetLine, readyLine } from '@/features/event-outfits/occasion-copy';

/**
 * EV-02 — invitee, waiting, no look yet.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 92 — the accent MOVES to Join. "Your look" is a PAPER card
 *   explaining what happens after joining rather than a blush card with
 *   nothing in it: the invitee has exactly one decision on this page, and a
 *   second blush surface would compete with it.
 * · "Decide later" is a real 44 pt exit THAT SENDS NOTHING. In the shipping
 *   screen it calls `router.back()` and writes no response at all — the
 *   `declined` mutation that used to sit on this row is gone, because no
 *   absence may be exposed anywhere in this group and a recorded decline is an
 *   exposed absence waiting for a surface to print it.
 * · The status sentence names WHO invited you and that you have not answered —
 *   the two facts an invitee needs before any control — and names nobody else.
 * · The readiness line is the only thing this page says about other people, and
 *   it is a bare count.
 *
 * DETERMINISM: literals throughout. No clock, no network, no spinner.
 */
export default function DevW3G5EV02() {
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
        <Text variant="note" className="mt-5">
          Friday 8 August · 8pm · Tavernetta
        </Text>
        <Text variant="title" trim className="mt-2">
          Sarah’s birthday dinner
        </Text>

        <Text variant="body" className="mt-4 text-muted">
          {inviteeStatusLine('Sarah', false)}
        </Text>
        <Text variant="note" className="mt-1.5">
          {readyLine(3)}
        </Text>

        <View className="mt-5 flex-row gap-3">
          <Button title="Join" onPress={() => undefined} />
          <Button title="Decide later" variant="ghost" onPress={() => undefined} />
        </View>

        <View className="mt-7">
          <Card border="hairline" padding="xl">
            <Text variant="colophon">Your look</Text>
            <Text variant="body" className="mt-2 text-muted">
              {noLookYetLine()}
            </Text>
          </Card>
        </View>

        <View className="mt-8">
          <Rule />
          <View
            style={{ minHeight: 44 }}
            className="flex-row items-center justify-between border-b border-hairline py-3">
            <Text variant="body">Table talk</Text>
            <Text variant="colophon">7</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
