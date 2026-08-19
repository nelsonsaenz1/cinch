import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { GarmentImage } from '@/components/media/garment-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { type PlannedDay } from '@/features/plan/packing';
import { type Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

import { dayContextLabel, dayDateLabel, dayHeadLabel, outfitLine } from './day-row';

/** The atlas's 88pt well for an expanded day — one step down from WD-02's 96. */
const WELL = 88;

/**
 * "Linen blouse · Corduroy skirt · Leather boots · Crossbody bag" — the piece
 * list in prose, under the grid.
 *
 * Every piece, not the three the collapsed row's image column stands for: the
 * whole point of opening a day is that nothing is standing in for anything.
 */
export function pieceListLine(pieces: readonly Garment[]): string {
  return pieces
    .map((g) => {
      const s = g.subcategory ?? g.category;
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join(' · ');
}

/**
 * PL-02 — one day, opened in place.
 *
 * ── What the frame asks for, and what it gets ─────────────────────────────
 *
 * · The row expands IN PLACE. Its neighbours keep their two-line form and their
 *   position; nothing scrolls out from under the reader.
 * · The occasion is present but QUIET: it joins the date label in oxblood text
 *   and nothing else on the frame changes shape because a dinner exists.
 * · The composed-look grid, at 88pt, so four pieces are each identifiable
 *   rather than overlapping.
 * · Complete reasoning — the same `explain` sentence the collapsed row shows,
 *   unwrapped and untruncated.
 * · Keeping a plan is the ONE oxblood action; asking for another is its peer.
 *
 * ── What is not drawn ─────────────────────────────────────────────────────
 *
 * There is no "mark worn" here. Marking a plan worn happens on Today or in the
 * diary — the atlas's own transition note — and `plan_outfit_tx` deliberately
 * does not touch `wear_count`, because a plan is an intention and counting it
 * as a wear would corrupt both cost-per-wear and the freshness rule.
 */
export function DayExpanded({
  day,
  resolveImage,
  occasion,
  onKeep,
  keeping,
  kept,
  onTryAnother,
  trying,
  onCollapse,
  isLast,
  units = 'F',
  today,
}: {
  day: PlannedDay;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  /** A Cinch occasion on this day. Never a device-calendar title — see `DayRow`. */
  occasion?: string | null;
  onKeep: () => void;
  keeping?: boolean;
  kept?: boolean;
  onTryAnother: () => void;
  trying?: boolean;
  /** Close this day and return the week to its compact rhythm. See below. */
  onCollapse: () => void;
  isLast?: boolean;
  units?: 'C' | 'F';
  today?: Date;
}) {
  const theme = useTheme();
  const pieces = day.outfit?.items ?? [];

  // The date leads in the serif; the weather stays in the small tracked
  // register under it; the occasion joins that register in oxblood and on its
  // own <Text>, because one accent inside a longer label cannot be read as a
  // second channel if the whole label carries it.
  const date = dayDateLabel(day, today);
  const context = dayContextLabel(day, units, null);
  const head = dayHeadLabel(day, units, occasion, today);

  return (
    <View
      className={[
 'px-gutter py-[18px]',
        isLast ? '' : 'border-b border-rule',
      ].join(' ')}>
      {/* ── TAPPING AN OPEN DAY CLOSES IT — founder order, 2026-08-18 ───────
          The expansion was one-way: `onPlan` set `openKey`, and the only
          things that ever cleared it were a successful save or opening a
          different day. A reader who opened a day just to look at it had no
          way back to the compact week except by opening some OTHER day — the
          control that got them in had no inverse, which is a trap however
          shallow it is. The disclosure is a toggle now.

          THE OUTFIT IS THE HIT AREA, AND THE BUTTONS ARE OUTSIDE IT. Wrapping
          the whole row was the first shape of this and it was wrong twice
          over: `Pressable` defaults `accessible` to true, which collapses its
          whole subtree into ONE VoiceOver node — "Keep this plan" and "Try
          another" would have stopped being reachable controls, which is a far
          worse regression than the one being fixed. And a parent press behind
          two buttons is a hit area whose behaviour depends on which pixel was
          hit.

          So the toggle is the part the founder actually named — the day and
          its outfit — and the two actions sit outside it as the peers they
          are. It is also the same surface `DayRow` presses to OPEN, so the
          thing you tapped to open is the thing you tap to close, in the same
          place, which is the only mapping a reader can guess.

          `accessibilityState.expanded` says so out loud, and the label names
          the collapse rather than leaving it to be discovered. */}
      <Pressable
        onPress={onCollapse}
        accessibilityRole="button"
        accessibilityState={{ expanded: true }}
        accessibilityLabel={`${head}. Collapse this day.`}
        className="active:opacity-60">
        <Text variant="dayhead">{date}</Text>
        <View className="flex-row flex-wrap items-baseline">
          {context ? <Text variant="colophon" className="mt-0.5">{context}</Text> : null}
          {occasion?.trim() ? (
            <Text variant="colophon" className="mt-0.5" style={{ color: theme.accent }}>
              {context ? ` · ${occasion.trim()}` : occasion.trim()}
            </Text>
          ) : null}
        </View>

        {/* The editorial line in the display face — the one place on the week
            where a plan gets a headline rather than a row title. */}
        <Text variant="plate" className="mt-2">
          {outfitLine(pieces)}
        </Text>

        {/* THE REASON SENTENCE IS GONE — founder order, 2026-08-18, and for
            the same argument written out in `day-row.tsx`: `explain()` is the
            scorer's notes, and printing them as prose put machine reasoning in
            the register the app keeps for a human voice. What an opened day
            owes the reader is the OUTFIT in full — every piece at 88pt and
            named — and that is what is left, unabridged. `explain()` itself is
            untouched. */}

        {pieces.length > 0 ? (
          <>
            <View className="mt-4 flex-row flex-wrap gap-2.5">
              {pieces.map((g) => (
                <PieceWell
                  key={g.id}
                  uri={resolveImage(g.platePath, g.cutoutPath, g.thumbPath)}
                  label={g.subcategory ?? g.category}
                />
              ))}
            </View>

            <Text variant="note" className="mt-3">
              {pieceListLine(pieces)}
            </Text>
          </>
        ) : null}
      </Pressable>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Button
          title={kept ? 'Kept' : 'Keep this plan'}
          variant="ink"
          disabled={kept}
          loading={keeping}
          onPress={onKeep}
        />
        <Button title="Try another" variant="secondary" loading={trying} onPress={onTryAnother} />
      </View>
    </View>
  );
}

/** Fitted, never cropped — the same rule as every other well in the app. */
function PieceWell({ uri, label }: { uri: string | undefined; label: string }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="items-center justify-center overflow-hidden rounded bg-tray"
      style={{ width: WELL, height: WELL, padding: 6 }}>
      {/* UX-06 — one considered mark for every way this well can end up with
          no photograph in it, not just for a piece that never had one. */}
      <GarmentImage
        uri={uri}
        contentFit="contain"
        transition={120}
        style={{ width: '100%', height: '100%' }}
        fallback={
          <SymbolView name="tshirt" size={24} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
        }
      />
    </View>
  );
}
