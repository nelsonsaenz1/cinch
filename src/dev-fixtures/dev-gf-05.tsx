import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GapFeedEmpty,
  GapFeedSkeleton,
  GapFeedStop,
} from '@/components/gap-feed/gap-feed-parts';
import { WAITING_TOPS } from '@/components/gap-feed/w3-g5-fixture-data';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { GAP_FEED_COPY, TYPE } from '@/features/closet/gap-feed-spec';

/**
 * GF-05 · redesign 26 — the three states with no gap in them, on one sheet.
 *
 * WAITING · card-shaped skeletons in the real geometry, so the content arrives
 * into the shape it was already occupying. Never an `ActivityIndicator` on this
 * screen: a spinner is a stall, and this page's whole promise is that it
 * already knows the answer from data it holds. The sweep is Reanimated and
 * carries `ReduceMotion.System`, so with the setting on it settles still.
 *
 * TOO SMALL · a closet without enough in it to have a gap worth naming. The
 * absence well sits in the MIDDLE here rather than last, because nothing
 * particular is missing — the row is not one outfit you cannot make, it is a
 * wardrobe too short to have an opinion. The piece count in the sentence is the
 * real one; the artifact spells it in words, and a spelled number is a typed
 * number that cannot follow the data.
 *
 * COULD NOT READ · NOT an empty state, and the distinction is the point: this
 * is the screen somebody opens to check their own clothes, and telling them the
 * closet is empty over a dropped connection is the one thing it must never do.
 * The body leads with what did not happen and is set in oxblood — the refusal
 * tone, on a blush ground, the same grammar Storage gives its blocked states.
 */
export default function DevGf05() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-1">
        <Text variant="title" trim style={{ fontSize: TYPE.masthead, lineHeight: TYPE.mastheadLineHeight }}>
          {GAP_FEED_COPY.title}
        </Text>

        <View className="mt-5">
          <GapFeedSkeleton />
        </View>

        <View className="mt-8" style={{ gap: 20 }}>
          <GapFeedEmpty pieces={WAITING_TOPS.shown.slice(0, 2)} />
          <Button title={GAP_FEED_COPY.empty.action} variant="primary" onPress={() => undefined} />
        </View>

        <View className="mt-8" style={{ gap: 14 }}>
          <GapFeedStop retrying={false} />
          <Button
            title={GAP_FEED_COPY.readError.action}
            variant="primary"
            onPress={() => undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
