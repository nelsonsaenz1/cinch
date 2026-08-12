import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutfitPostCard } from '@/components/event-outfits/OutfitPostCard';
import { Text } from '@/components/ui/text';
import { attendeeLine, openBoardFooter } from '@/features/event-outfits/board-copy';
import { pickLine } from '@/features/event-outfits/board-logic';
import { G5_LOOKS_OPEN, g5NameOf } from '@/features/event-outfits/w3-g5-fixtures';
import { GUTTER } from '@/theme/tokens';

/**
 * LB-01 — the shared rail, open, your pick placed.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · correction 24 — the masthead names the occasion and THE BOARD'S OWN
 *   LIFETIME ("2 attendees · open until Friday") instead of framing the board
 *   as help for one person, and each card names WHOSE LOOK IT IS. That single
 *   13 pt line is what turns two options into a shared rail.
 * · audit 95 — the caption gets its height BEFORE the image does. Marguerite's
 *   is the long case and wraps to three lines with nothing ellipsised; the
 *   tiles sit at 74 pt beneath it so all four garments stay visible. Every
 *   `numberOfLines` that used to clamp this block is gone.
 * · audit 96 — "Ahead" is 13 pt regular SECONDARY TEXT, never a bar, a badge
 *   or a percentage. Counts are secondary text too, and a look with no votes
 *   prints NO COUNT LINE AT ALL — `voteCountLine` returns null at zero.
 * · The count carries NO VOTER NAMES. LB-01 and LB-02 draw a bare "3 votes",
 *   and a rail that printed who voted for whose clothes would turn a vote into
 *   a public statement about a friend's outfit.
 * · The footer states the one movable pick and that votes choose nothing.
 *
 * PARKED — dependency B. The board is drawn as locking itself at the
 * occasion's start and as holding one pick per viewer. Half of that IS server
 * truth: `one_vote_per_event unique (event_id, voter_id)` (migration
 * 20260807102000) enforces the single pick. The LOCK is not — it is
 * `openedAt >= startsAt` computed in the client against a column migration
 * 20260808130000 made nullable, with no policy or trigger refusing a late
 * vote. So no copy here says the board locks itself.
 *
 * ALSO PARKED — the crown. The atlas removes it entirely; the shipping code
 * crowns a leader at lock (`favouriteId`, `LeaderBadge`). The ledger records
 * that as unresolved. Nothing on this frame or in this lane changed who is
 * crowned.
 *
 * DETERMINISM: frozen looks with literal vote counts and dates. No clock, no
 * network, no spinner, no shimmer.
 */
export default function DevW3G5LB01() {
  const { width } = useWindowDimensions();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const cardWidth = Math.round(width - GUTTER - 44);
  const noop = () => undefined;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-16" showsVerticalScrollIndicator={false}>
        <View className="px-gutter pt-5">
          <Text variant="title" trim>
            Looks for Friday
          </Text>
          <Text variant="note" className="mt-2">
            {`${attendeeLine(2)} · open until Friday`}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-gutter"
          className="mt-4">
          {G5_LOOKS_OPEN.map((look, i) => (
            <View key={look.id} style={{ width: cardWidth }}>
              <OutfitPostCard
                look={look}
                posterName={g5NameOf(look.userId)}
                pickLine={pickLine(look.votes, i === 0, [])}
                isMine={false}
                // The first card leads on the counts (3 against 2), which is
                // what earns it the word — computed, not awarded.
                badge={i === 0 ? 'ahead' : null}
                locked={false}
                picked={i === 0}
                votePending={false}
                resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
                width={cardWidth}
                onToggleVote={noop}
                onOpenComments={noop}
                commentCount={i === 0 ? 2 : 0}
              />
            </View>
          ))}
        </ScrollView>

        <View className="mx-gutter mt-5 rounded-plate bg-tray px-4 py-3.5">
          <Text variant="callout" className="text-muted">
            {openBoardFooter('Friday')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
