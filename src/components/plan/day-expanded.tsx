import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { type PlannedDay } from '@/features/plan/packing';
import { explain, type Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

import { dayHeadLabel, outfitLine } from './day-row';

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
  isLast?: boolean;
  units?: 'C' | 'F';
  today?: Date;
}) {
  const theme = useTheme();
  const pieces = day.outfit?.items ?? [];

  // The date and weather stay in the label; the occasion joins them in oxblood
  // and on its own <Text>, because one accent inside a longer label cannot be
  // read as a second channel if the whole label carries it.
  const head = dayHeadLabel(day, units, null, today);
  const reasoning = day.outfit ? explain(day.outfit) : null;

  return (
    <View
      className={[
 'px-gutter py-[18px]',
        isLast ? '' : 'border-b border-rule',
      ].join(' ')}>
      <View className="flex-row flex-wrap items-baseline">
        <Text variant="colophon">{head}</Text>
        {occasion?.trim() ? (
          <Text variant="colophon" style={{ color: theme.accent }}>
            {` · ${occasion.trim()}`}
          </Text>
        ) : null}
      </View>

      {/* The editorial line in the display face — the one place on the week
          where a plan gets a headline rather than a row title. */}
      <Text variant="plate" className="mt-2">
        {outfitLine(pieces)}
      </Text>

      {reasoning ? (
        <Text variant="body" className="mt-2 text-muted">
          {reasoning}
        </Text>
      ) : null}

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
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          transition={120}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <SymbolView name="tshirt" size={24} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
      )}
    </View>
  );
}
