import { SymbolView } from 'expo-symbols';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlateCard, PlateCardSkeleton } from '@/components/boards/plate-card';
import { BackButton, Button, Chip, ErrorState, Skeleton, Text } from '@/components/ui';
import { allChipLabel } from '@/features/boards/board-lines';
import type { Board, KeptPlate } from '@/features/boards/types';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * KP-01, KP-02 and KP-05 — the lookbook, empty and arriving.
 *
 * Presentational on purpose, like `FriendsPage` before it: `saved.tsx` reads
 * the data and `dev-saved.tsx` hands it fixtures, and both draw exactly the
 * same object. A dev route that redraws an approximation of a screen verifies
 * the redrawing.
 *
 * THE CHIPS NAVIGATE, they do not filter in place. KP-03 is a board with its
 * own back chevron, its own serif title, its own Edit and its own Send to
 * Packing — that is a page, not a filtered state of this one, and the atlas
 * draws no in-place filtered frame. So `All` is where you are and the rest are
 * where you can go.
 */

/** The atlas's two-column grid: 20pt gutters, a 14pt gap between columns. */
const COLUMN_GAP = 14;

export type SavedPageProps = {
  loading: boolean;
  error: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  /** Every kept plate. `All` is the whole set; the chips lead elsewhere. */
  plates: KeptPlate[];
  boards: Board[];
  /** A plate's board name, for the meta line. */
  boardNameFor: (boardId: string | null) => string | null;
  /** Signed URLs for a plate's four cells, in order. */
  imageUrisFor: (plate: KeptPlate) => readonly (string | undefined)[];
  onOpenBoard: (boardId: string) => void;
  onOpenPlate: (plate: KeptPlate) => void;
  onPlanALook: () => void;
  /**
   * Saved is reached by a push, not by a tab — the atlas draws it inside the
   * tab bar because that is where it lives in the design, and this app has no
   * fifth tab to put it in. A pushed page needs a way back, so it gets the
   * house's own disc.
   */
  onBack?: () => void;
};

export function SavedPage({
  loading,
  error,
  retrying = false,
  onRetry,
  plates,
  boards,
  boardNameFor,
  imageUrisFor,
  onOpenBoard,
  onOpenPlate,
  onPlanALook,
  onBack,
}: SavedPageProps) {
  const { width } = useWindowDimensions();
  const column = Math.floor((width - GUTTER * 2 - COLUMN_GAP) / 2);

  // The chip row survives every state that has anything to put in it, which is
  // the KP-05 rule stated as layout: "square skeletons in the same grid, so
  // board chips and the first row do not move when plates arrive".
  const showChips = loading || boards.length > 0 || plates.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        {onBack ? (
          <View className="px-gutter pt-2">
            <BackButton label="Back" onPress={onBack} />
          </View>
        ) : null}

        <View className="px-gutter pt-2">
          <Text variant="eyebrow" className="mb-1.5">
            Kept for later
          </Text>
          <Text variant="display" trim accessibilityRole="header">
            Saved
          </Text>
        </View>

        {showChips ? (
          <View className="pt-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-gutter">
              {loading && boards.length === 0 ? (
                // Chip-shaped, so the row that is about to hold "All 14 · Work
                // · Weekends" is already the right height and does not shove
                // the first row of plates down when the names land.
                [96, 74, 108].map((chipWidth, i) => (
                  <Skeleton
                    key={i}
                    className="rounded-chip"
                    style={{ width: chipWidth, height: 32 }}
                    delay={i * 80}
                  />
                ))
              ) : (
                <>
                  {/* "All 14" as one label rather than `Chip`'s label+count
                      pair: the atlas sets both words in the same 13px run, and
                      the count slot draws its figure in the serif.
                      THE COUNT IS DROPPED WHILE THE SET IS STILL ARRIVING —
                      KP-05 draws this chip as bare "All" for the same reason.
                      An unread collection has an unknown size, and `plates`
                      is empty during a read; printing "All 0" would be an
                      estimate dressed as a fact. */}
                  <Chip
                    label={loading ? 'All' : allChipLabel(plates.length)}
                    selected
                    selectedGround="ink"
                  />
                  {boards.map((board) => (
                    <Chip
                      key={board.id}
                      label={board.name}
                      onPress={() => onOpenBoard(board.id)}
                      accessibilityHint="Opens this board"
                    />
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        ) : null}

        {error ? (
          // Not an empty state. An empty state claims there is nothing kept,
          // and an unread collection is not an empty one — the distinction
          // `EmptyState`'s own docblock exists to hold.
          <View className="pt-4">
            <ErrorState
              kicker="Couldn’t reach it"
              title="Couldn’t read what you’ve kept"
              body="Cinch couldn’t reach your saved looks just now. Nothing has been lost — this is a connection problem, and everything you kept is still there."
              onRetry={onRetry}
              retrying={retrying}
            />
          </View>
        ) : loading ? (
          <View
            className="flex-row flex-wrap px-gutter pt-4"
            style={{ gap: COLUMN_GAP }}
            accessibilityLabel="Reading what you’ve kept">
            {[0, 1, 2, 3].map((i) => (
              <PlateCardSkeleton key={i} size={column} delay={i * 100} />
            ))}
          </View>
        ) : plates.length === 0 ? (
          <NothingKeptYet onPlanALook={onPlanALook} />
        ) : (
          <View className="flex-row flex-wrap px-gutter pt-4" style={{ gap: COLUMN_GAP }}>
            {plates.map((plate) => (
              <PlateCard
                key={plate.id}
                plate={plate}
                boardName={boardNameFor(plate.boardId)}
                size={column}
                imageUris={imageUrisFor(plate)}
                onPress={() => onOpenPlate(plate)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * KP-02 — the hero empty.
 *
 * Centred rather than set hard-left on the gutter, which is `EmptyState`'s
 * grammar: its own docblock carves out the whole-screen empties (the closet's
 * "An empty rail", Today's) as centred compositions that keep their own frame,
 * and the atlas draws this one that way. So it is hand-built here rather than
 * bent out of the shared component.
 *
 * The copy is the atlas's, unedited, because it is doing the work: it names
 * the difference this page defends — a collection at rest, not a feed — and
 * the way in is to plan a look, so that is the button.
 */
function NothingKeptYet({ onPlanALook }: { onPlanALook: () => void }) {
  const theme = useTheme();

  return (
    <View className="items-center px-10 pt-24" accessibilityRole="summary">
      <SymbolView name="bookmark" size={34} tintColor={theme.muted} resizeMode="scaleAspectFit" />
      <View style={{ marginTop: 18 }}>
        <Text variant="title" trim className="text-center">
          Nothing kept yet
        </Text>
      </View>
      <Text variant="body" className="mt-4 text-center text-muted">
        When a look is worth having again, keep it. Saved looks sit here as plates — a collection,
        not a feed — and you can pull one straight into a day.
      </Text>
      {/* Ink, not oxblood. Every atlas sets an empty state's way forward as an
          ink fill and keeps the accent for the screen's one commitment; this
          page has none, so it spends no accent at all. */}
      <Button title="Plan a look" variant="ink" onPress={onPlanALook} haptic className="mt-6 px-6" />
    </View>
  );
}
