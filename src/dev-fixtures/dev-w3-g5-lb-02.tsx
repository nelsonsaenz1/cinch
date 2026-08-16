import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OutfitPostCard } from '@/components/event-outfits/OutfitPostCard';
import { Text } from '@/components/ui/text';
import { isTied, lockedBoardLine, tieLine } from '@/features/event-outfits/board-copy';
import { pickLine } from '@/features/event-outfits/board-logic';
import { G5_LOOKS_TIED, G5_LOOK_SARAH, g5NameOf } from '@/features/event-outfits/w3-g5-fixtures';
import { GUTTER } from '@/theme/tokens';

/**
 * LB-02 — a tie holds, then the board locks. Two states, drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 96 — a TIE REMOVES "Ahead" rather than inventing a tiebreak, and the
 *   POSTING ORDER IS UNCHANGED. The frame says so in words, because a reader
 *   who saw a leader yesterday needs to know nothing was reordered. `isTied`
 *   computes the tie from the counts on the frame, so the absence of the word
 *   is derived rather than staged.
 * · Both tied cards keep their counts. Neither is struck through, greyed or
 *   demoted, and no third state is invented for "joint first".
 * · The LOCKED card carries its final count and a sentence naming the cause.
 *   Votes stay as they were.
 * · With no bouncy moment anywhere in this group, the lock is a base-220 state
 *   change. Nothing on this frame overshoots, so nothing here needs a Reduce
 *   Motion exception.
 *
 * DEPENDENCY B LANDED, twice over.
 *
 * 1. THE LOCK IS ENFORCED (D-2a). It used to be `openedAt >=
 *    startsAt.getTime()` computed in the client, against a column migration
 *    20260808130000 made nullable, with no policy or trigger refusing a late
 *    vote anywhere. `20260812120000_close_comments_and_lock_board.sql` added
 *    both halves — `assert_vote_target` refuses a late pick and
 *    `assert_vote_retractable` refuses a late retraction, both `CL002` — so
 *    `lockedBoardLine` can now say the picks are final. An UNDATED occasion
 *    stays open: `now() < coalesce(starts_at, 'infinity')`.
 *
 * 2. THE CROWN IS GONE (D-2b). This frame used to draw the locked card without
 *    one only because a TIE was the single locked case both artefacts agreed
 *    on. The founder resolved the disagreement in the finalized atlas's
 *    favour, so nothing is crowned on any locked board, tied or not, and the
 *    frame is now simply correct rather than carefully scoped.
 *
 * DETERMINISM: literal counts. No clock, no network, no spinner.
 */
export default function DevW3G5LB02() {
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
  const tied = isTied(G5_LOOKS_TIED.map((l) => l.votes));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-16" showsVerticalScrollIndicator={false}>
        <View className="px-gutter pt-5">
          <Text variant="title" trim>
            Looks for Friday
          </Text>
          <Text variant="note" className="mt-2">
            Two states, drawn together
          </Text>
          <Text variant="eyebrow" className="mt-6">
            Tied at three
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-gutter"
          className="mt-3">
          {G5_LOOKS_TIED.map((look) => (
            <View key={look.id} style={{ width: cardWidth }}>
              <OutfitPostCard
                look={look}
                posterName={g5NameOf(look.userId)}
                pickLine={pickLine(look.votes, false, [])}
                isMine={false}
                // Derived: a tie means no card carries the word. Not staged
                // as `null` by hand — `tied` is computed from the counts above.
                badge={tied ? null : 'ahead'}
                locked={false}
                picked={false}
                votePending={false}
                resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
                width={cardWidth}
                onToggleVote={noop}
                onOpenComments={noop}
                commentCount={0}
              />
            </View>
          ))}
        </ScrollView>

        <View className="mx-gutter mt-5 rounded-plate bg-tray px-4 py-3.5">
          <Text variant="callout" className="text-muted">
            {tieLine()}
          </Text>
        </View>

        <Text variant="eyebrow" className="mx-gutter mt-9">
          After 8pm — locked
        </Text>
        <View className="mx-gutter mt-3" style={{ width: cardWidth }}>
          <OutfitPostCard
            look={{ ...G5_LOOK_SARAH, votes: 3 }}
            posterName={g5NameOf(G5_LOOK_SARAH.userId)}
            pickLine={pickLine(3, false, [])}
            isMine={false}
            badge={null}
            locked
            picked={false}
            votePending={false}
            resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
            width={cardWidth}
            onToggleVote={noop}
            onOpenComments={noop}
            commentCount={0}
          />
        </View>

        <View className="mx-gutter mt-5 rounded-plate bg-tray px-4 py-3.5">
          <Text variant="callout" className="text-muted">
            {lockedBoardLine()}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
