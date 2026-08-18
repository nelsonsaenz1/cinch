import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NobodySharingState } from '@/components/daily-social';
import {
  AdditionsEndMark,
  CaughtUpMark,
  CircleErrorBand,
  CircleSheet,
  EarlierRule,
  LookEntryCard,
  LookFeedSkeleton,
  NewSinceRule,
  type LookEntryPiece,
} from '@/components/explore';
import { Text } from '@/components/ui/text';
import { daySubtitle } from '@/features/daily-social/copy';
import { type DailyReaction } from '@/features/daily-social/types';
import { EXPLORE_COPY, FEED_GAP, newSinceLabel } from '@/features/explore/explore-spec';

/**
 * DEV ONLY · Redesign 17 — Explore's accepted frames, posed.
 *
 * ── WHY THE FIXTURES DRAW NO PHOTOGRAPHS ────────────────────────────────────
 *
 * Every image on the real page is a private signed URL for somebody else's
 * garment, gated row by row on mutual friendship. A fixture that fabricated
 * one would be checking the fixture, so the wells here take the same neutral
 * ground a missing, expired or unauthorized image takes — which is also a real
 * state the page has to survive.
 *
 * ── AND WHY THEY DRAW NO COUNTS ─────────────────────────────────────────────
 *
 * There is nothing to draw. A reaction is visible to the look's owner only,
 * and the control shows the reader's own state and no one else's. If a number
 * ever appears in one of these frames, the component grew one — the fixture
 * has no way to supply it.
 *
 * Each pose is its own deep-linkable route (`cinch:///dev-ex-01-feed`, …),
 * because `simctl` opens URLs and cannot tap: a state only a finger can reach
 * has no reproducible evidence.
 */

export type ExplorePose =
  | 'feed'
  | 'divider'
  | 'ending'
  | 'nobody-sharing'
  | 'hidden-pieces'
  | 'circle'
  | 'loading'
  | 'offline';

const piece = (id: string, name: string): LookEntryPiece => ({
  itemId: id,
  name,
  imageUrl: null,
});

const PRIYA: LookEntryPiece[] = [
  piece('p1', 'Wool coat'),
  piece('p2', 'Silk slip dress'),
  piece('p3', 'Black boots'),
];

const MARA: LookEntryPiece[] = [piece('m1', 'Oxford shirt'), piece('m2', 'Wide trousers')];

const JO: LookEntryPiece[] = [piece('j1', 'Trench coat'), piece('j2', 'Ankle boots')];

/** Fixed instants, so a frame captured today matches one captured next month. */
const NOW = new Date(2026, 7, 16, 12, 0, 0);
const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();

function Masthead() {
  return (
    <View className="px-gutter pb-2 pt-2">
      <Text variant="display" trim>
        {EXPLORE_COPY.title}
      </Text>
      <View style={{ marginTop: 8 }}>
        <Text variant="eyebrow">{EXPLORE_COPY.support}</Text>
      </View>
    </View>
  );
}

export function ExploreFrame({ pose }: { pose: ExplorePose }) {
  // Local, so the chosen chip and its privacy line can be exercised by hand —
  // the accepted `look-reaction-resting` and `look-reaction-chosen` frames are
  // the same card one tap apart, and posing them as two stills would hide that.
  const [reaction, setReaction] = useState<DailyReaction | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(pose === 'circle');

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Masthead />

      <ScrollView contentContainerClassName="pb-16">
        {pose === 'loading' ? (
          <View className="px-gutter pt-4">
            <LookFeedSkeleton />
          </View>
        ) : null}

        {pose === 'offline' ? (
          <View className="px-gutter pt-4">
            <CircleErrorBand onRetry={() => {}} onBack={() => {}} />
          </View>
        ) : null}

        {pose === 'nobody-sharing' ? <NobodySharingState onOpenSharing={() => {}} /> : null}

        {pose === 'divider' ? (
          <View className="px-gutter pt-4" style={{ gap: FEED_GAP }}>
            <NewSinceRule label={newSinceLabel(at(96), NOW)} />
            <LookEntryCard
              ownerName="Jo"
              name="the trench"
              wornAt={at(3)}
              pieces={JO}
              reaction={null}
              onReact={() => {}}
              now={NOW}
              position={{ index: 1, total: 2 }}
            />
            <EarlierRule />
            <LookEntryCard
              ownerName="Priya"
              name="Sunday"
              wornAt={at(48)}
              pieces={[piece('p2', 'Slip dress'), piece('p3', 'Black boots')]}
              reaction={null}
              onReact={() => {}}
              now={NOW}
              position={{ index: 2, total: 2 }}
            />
          </View>
        ) : null}

        {pose === 'ending' ? (
          <View className="px-gutter pt-4" style={{ gap: FEED_GAP }}>
            <LookEntryCard
              ownerName="Priya"
              name="Sunday"
              wornAt={at(48)}
              pieces={[piece('p2', 'Slip dress'), piece('p3', 'Black boots')]}
              reaction={null}
              onReact={() => {}}
              now={NOW}
              position={{ index: 1, total: 1 }}
            />
            <View className="pt-6">
              <CaughtUpMark />
            </View>
          </View>
        ) : null}

        {pose === 'hidden-pieces' ? (
          <View className="px-gutter pt-4" style={{ gap: FEED_GAP }}>
            {/* One garment crossed of the several that were worn. The card is a
                complete frame at a larger scale, not a grid with holes in it,
                and nothing anywhere says a thing is absent. */}
            <LookEntryCard
              ownerName="Jo"
              name="out early"
              wornAt={at(4)}
              pieces={[piece('j3', 'Camel coat')]}
              reaction={null}
              onReact={() => {}}
              now={NOW}
              position={{ index: 1, total: 2 }}
            />
            {/* And a look whose every piece its owner kept: the well does not
                draw at all, so there is no shape left behind to subtract from. */}
            <LookEntryCard
              ownerName="Mara"
              name={null}
              wornAt={at(26)}
              pieces={[]}
              reaction={null}
              onReact={() => {}}
              now={NOW}
              position={{ index: 2, total: 2 }}
            />
          </View>
        ) : null}

        {pose === 'feed' || pose === 'circle' ? (
          <View className="px-gutter pt-4" style={{ gap: FEED_GAP }}>
            <Text variant="note" accessibilityRole="summary">
              {daySubtitle(2, NOW)}
            </Text>

            <LookEntryCard
              ownerName="Priya"
              name="the wool coat"
              wornAt={at(4)}
              pieces={PRIYA}
              reaction={reaction}
              // Tapping the chosen chip again passes null — the press is
              // reversible, and the line under the row says so.
              onReact={(next) => {
                setReaction(next);
                setFailed(false);
              }}
              reactionFailed={failed}
              onRetryReaction={() => setFailed(false)}
              now={NOW}
              position={{ index: 1, total: 2 }}
            />

            <LookEntryCard
              ownerName="Mara"
              name="it plain"
              wornAt={at(26)}
              pieces={MARA}
              reaction={null}
              // The second card is the write-failure pose: reacting here fails,
              // which is the only honest way to draw a state whose whole
              // content is "nothing was sent".
              onReact={() => setFailed(true)}
              reactionFailed={failed}
              onRetryReaction={() => setFailed(false)}
              now={NOW}
              position={{ index: 2, total: 2 }}
            />

            <View className="pt-6">
              <AdditionsEndMark />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <CircleSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        rows={[
          { id: 'friends', title: EXPLORE_COPY.circleFriends, onPress: () => {} },
          {
            id: 'find',
            title: EXPLORE_COPY.circleFind,
            accessibilityLabel: 'Find people',
            onPress: () => {},
          },
          {
            id: 'sharing',
            title: EXPLORE_COPY.circleSharing,
            value: EXPLORE_COPY.circleSharingOff,
            onPress: () => {},
          },
        ]}
      />
    </SafeAreaView>
  );
}
