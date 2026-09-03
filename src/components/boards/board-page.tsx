import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlateCard, PlateCardSkeleton } from '@/components/boards/plate-card';
import { Button, ErrorState, ScreenHeader, Text } from '@/components/ui';
import { boardDetailLine } from '@/features/boards/board-lines';
import type { Board, KeptPlate } from '@/features/boards/types';
import { GUTTER, MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * KP-03 — one board open.
 *
 * "A board is a plain named set with an optional date range. When it has dates
 * it can be handed to Packing whole, which is the only place boards touch
 * another screen."
 *
 * Everything on this page follows from that sentence. There is no cover, no
 * description and no colour because a board has none; the summary line is
 * three facts and drops any it does not have; and `Send to Packing` appears
 * exactly when `isDatedBoard` is true and never otherwise — an undated board
 * has no forecast to ask for and nothing to prefill, so the action would be a
 * button that opens a questionnaire it cannot answer.
 */

const COLUMN_GAP = 14;

export type BoardPageProps = {
  board: Board;
  plates: KeptPlate[];
  loading: boolean;
  error: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  imageUrisFor: (plate: KeptPlate) => readonly (string | undefined)[];
  onBack: () => void;
  onEdit: () => void;
  onOpenPlate: (plate: KeptPlate) => void;
  /**
   * Null for an undated board — the absence IS the rule, not a disabled
   * button. "Dates make it a trip"; without them this is a plain collection
   * and the action does not exist to be greyed out.
   */
  onSendToPacking: (() => void) | null;
  onAddPlate: () => void;
  /** Raises SV-02's confirmation. Absent while the board itself is unread. */
  onDelete?: () => void;
  /**
   * Injectable clock, for the fixture routes only. A saved month read from the
   * system clock would make a captured frame stop matching itself in September.
   */
  now?: Date;
};

export function BoardPage({
  board,
  plates,
  loading,
  error,
  retrying = false,
  onRetry,
  imageUrisFor,
  onBack,
  onEdit,
  onOpenPlate,
  onSendToPacking,
  onAddPlate,
  onDelete,
  now,
}: BoardPageProps) {
  const { width } = useWindowDimensions();
  // AUDIT 100 #61. The `- 2` is the card's own hairline border, and it is
  // load-bearing — `saved-page.tsx` (KP-01/02) already carries the same
  // adjustment and its own comment names the mechanism exactly: `PlateCard`
  // carries `border border-rule` with no explicit width, so its OUTER width
  // is the tile plus two pixels. Without it, `2 × (column + 2) + COLUMN_GAP`
  // overflows the measure by four points and `flex-wrap` does not shrink to
  // fit, it wraps — which is how this screen was rendering one plate per
  // row, with the whole right half of a Pro-sized phone sitting empty next
  // to it, and no visual cue that anything was wrong. This screen (KP-03)
  // had the same `PlateCard` grid and had never been given the same fix.
  const column = Math.floor((width - GUTTER * 2 - COLUMN_GAP) / 2) - 2;

  // SV-02's line: `5 plates · started in March`, or the trip's dates when the
  // board has them. The distinct-piece total moved off this line — it is a
  // packing fact, and it now travels with `Send to Packing` rather than sitting
  // in a masthead where it read as a third count nobody asked for.
  const summary = boardDetailLine({
    plateCount: plates.length,
    startsOn: board.startsOn,
    endsOn: board.endsOn,
    createdAt: board.createdAt,
    now,
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        <ScreenHeader
          align="leading"
          title={board.name}
          onBack={onBack}
          trailing={
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${board.name}`}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET - 12 }}
              className="justify-center active:opacity-60">
              <Text variant="label">Edit</Text>
            </Pressable>
          }
        />

        <View className="px-gutter pt-3">
          <Text variant="title" trim accessibilityRole="header">
            {board.name}
          </Text>
          {/* `note` — 13px regular in `muted`. The atlas sets this line in
              #8A8578, which is the `faint` token: ~3.5:1 on canvas and an AA
              failure. It carries the plate count, the dates and the piece
              count, so it is content and takes the darker step.

              AUDIT 100 #61 — gated on `!loading`, matching `saved-page.tsx`'s
              own masthead. `plates` reads `[]` before the read has answered,
              so `summary` was printing "No plates yet" — a claim about the
              data — directly above the loading skeletons beneath it, which
              is the exact "empty state or still loading?" ambiguity the
              finding names. An unread board has an unknown plate count; this
              line says nothing until it actually knows one. */}
          {!loading && !error ? (
            <Text variant="note" className="mt-2">
              {summary}
            </Text>
          ) : null}
        </View>

        {error ? (
          <View className="pt-4">
            <ErrorState
              kicker="Couldn’t reach it"
              title="Couldn’t read this board"
              body="Cinch couldn’t reach the plates on this board just now. Nothing has moved — this is a connection problem."
              onRetry={onRetry}
              retrying={retrying}
            />
          </View>
        ) : loading ? (
          <View
            className="flex-row flex-wrap px-gutter pt-4"
            style={{ gap: COLUMN_GAP }}
            accessibilityLabel="Reading this board">
            {[0, 1].map((i) => (
              <PlateCardSkeleton key={i} size={column} delay={i * 100} />
            ))}
          </View>
        ) : plates.length === 0 ? (
          // Stated, not illustrated. A board with nothing on it is one tap old,
          // and the summary line above already says "No plates yet" — this is
          // the sentence that says what to do about it.
          <Text variant="body" className="px-gutter pt-6 text-muted">
            Keep a look onto this board and it will sit here. Every plate you keep can be moved from
            the same sheet that saved it.
          </Text>
        ) : (
          <View className="flex-row flex-wrap px-gutter pt-4" style={{ gap: COLUMN_GAP }}>
            {plates.map((plate) => (
              <PlateCard
                key={plate.id}
                plate={plate}
                size={column}
                imageUris={imageUrisFor(plate)}
                now={now}
                onPress={() => onOpenPlate(plate)}
              />
            ))}
          </View>
        )}

        {error ? null : (
          <View className="flex-row flex-wrap gap-2 px-gutter pt-5">
            {onSendToPacking ? (
              <Button
                title="Send to Packing"
                variant="ink"
                onPress={onSendToPacking}
                haptic
                className="px-4"
              />
            ) : null}
            <Button
              title="Add a plate"
              variant="secondary"
              onPress={onAddPlate}
              haptic
              className="px-4"
            />
            {/* SV-02. Quiet ink text, not an oxblood button: the accent is
                spent on the confirmation's own Delete, once, after the sentence
                that says what is kept. A destructive control that is loud
                BEFORE its consequence has been read is a trap. */}
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${board.name}`}
                onPress={onDelete}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET }}
                className="justify-center px-2 active:opacity-60">
                <Text variant="note">Delete this board</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
