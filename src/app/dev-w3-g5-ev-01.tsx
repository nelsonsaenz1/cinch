import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { YourLookCard } from '@/components/events/YourLookCard';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { hostStatusLine, readyLine } from '@/features/event-outfits/occasion-copy';
import { G5_LOOK_SARAH } from '@/features/event-outfits/w3-g5-fixtures';

/**
 * EV-01 — host, your look present.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 92 — "You are hosting. Six invited, four ready." is a SENTENCE under
 *   the title, not a 56 pt segmented control. The real `hostStatusLine` builds
 *   it, so the frame is evidence about the app rather than about a transcribed
 *   string, and the readiness line beneath it comes from `readyLine`.
 * · Attendance is COARSE IN BOTH DIRECTIONS: two counts and no names. Neither
 *   function takes a person, so this frame could not name an absentee if it
 *   wanted to — the privacy rule is held by the signatures, not by the layout.
 * · Blush is spent ONCE, on "Your look". Invite is not a filled control on this
 *   page at all any more; it is one row in the ruled list, which is what buys
 *   the composed look its height.
 * · The two look actions sit ON PAPER INSIDE the blush card, so the card stays
 *   one object.
 *
 * DETERMINISM: every count is a literal and the look is a frozen fixture. No
 * clock, no network, no random source, no spinner, no shimmer.
 */
export default function DevW3G5EV01() {
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
          {hostStatusLine(6, 4)}
        </Text>
        <Text variant="note" className="mt-1.5">
          {readyLine(4)}
        </Text>

        <View className="mt-7">
          <YourLookCard
            leading={{
              garments: G5_LOOK_SARAH.garments,
              caption: 'Linen and corduroy, boots for later',
              votes: 3,
            }}
            resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
            locked={false}
            onSwap={() => undefined}
            onShare={() => undefined}
          />
        </View>

        {/* Audit 92 — Invite is one row in a ruled list, beside the two
            surfaces that keep their own routes. It used to be a 56 pt filled
            control at the top of the page. */}
        <View className="mt-8">
          <Rule />
          <NavLine label="Every option" trailing="2 looks" />
          <NavLine label="Table talk" trailing="7" />
          <NavLine label="Invite more people" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NavLine({ label, trailing }: { label: string; trailing?: string }) {
  return (
    <View
      style={{ minHeight: 44 }}
      className="flex-row items-center justify-between gap-3 border-b border-hairline py-3">
      <Text variant="body">{label}</Text>
      {trailing ? <Text variant="colophon">{trailing}</Text> : null}
    </View>
  );
}
