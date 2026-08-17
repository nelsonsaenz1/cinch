import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Gain } from '@/features/closet/outfit-count';
import { describeShortDate } from '@/features/styling/repeat';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Whole days between two instants, using their LOCAL calendar dates. */
function daysBetween(a: Date, b: Date): number {
  const toNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((toNoon(b) - toNoon(a)) / 86_400_000);
}

/**
 * P-03 — exhausted. Every core the closet can build has a real worn record.
 *
 * THE GRID MAKES THE ARGUMENT; THE CARD NO LONGER RESTATES IT. This used to
 * carry five text blocks — a paragraph explaining that a full grid is the shape
 * of a small closet, and a closing caption naming the day's best outfit —
 * stacked above three plates on a card that is supposed to be additive. Both
 * are gone. `total` filled cells out of `total` say "all of them" without a
 * sentence, and every surviving fact is in the one colophon under it.
 *
 * It stays factually complete: the grid is `total` real cells, `since` is a
 * real first wear date, the best outfit is the day's own top plate, and the gap
 * suggestion is `rankGaps`'s own top entry, not a canned line. Each colophon
 * clause is omitted when its value is null, so nothing is invented to fill the
 * line out.
 *
 * Rendered as a card ABOVE the day's plates, never in place of them (rule 11:
 * this screen does not get redesigned, only added to).
 */
export function RepeatExhausted({
  total,
  since,
  now = new Date(),
  gap,
  topOutfitName,
  topOutfitWearCount,
  onSeePlans,
  onSwapInstead,
}: {
  /** `countOutfits` for this wardrobe — the grid's real size. */
  total: number;
  /** Earliest matched worn date, from real history. */
  since: Date | null;
  now?: Date;
  /** `rankGaps(...)[0]` — the single biggest honest gain available. */
  gap: Gain | null;
  topOutfitName: string | null;
  topOutfitWearCount: number;
  onSeePlans: () => void;
  onSwapInstead: () => void;
}) {
  const theme = useTheme();
  const columns = 7;
  const rows = Math.max(1, Math.ceil(total / columns));
  // Rendered as fixed rows, not a flex-wrapped list — that guarantees exactly
  // `columns` per row regardless of container width. Every index below `total`
  // is a real, worn core (this card only renders once `exhausted` is true, so
  // there is no "real but not yet worn" state to draw); anything at or past
  // `total` is pure padding to square off the grid and stays transparent
  // rather than reading as an unworn slot that does not exist.
  const gridRows = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => r * columns + c < total),
  );
  const dayNumber = since ? Math.max(1, daysBetween(since, now) + 1) : null;
  const colophon = [
    `${total} OF ${total} WORN`,
    since ? `SINCE ${describeShortDate(since).toUpperCase()}` : null,
    topOutfitName
      ? topOutfitWearCount > 0
        ? `BEST ${topOutfitName.toUpperCase()} ×${topOutfitWearCount}`
        : `BEST ${topOutfitName.toUpperCase()}`
      : null,
  ].filter((clause): clause is string => clause !== null);

  return (
    <View className="mx-gutter mt-4 rounded-plate border border-rule bg-surface p-4">
      {dayNumber != null ? (
        <Text variant="eyebrow" className="mb-1.5">
          {`Day ${dayNumber}`}
        </Text>
      ) : null}
      <Text variant="title">You&rsquo;ve now worn all {total}.</Text>

      <View
        className="mt-4"
        style={{ gap: 6 }}
        accessibilityLabel={`${total} of ${total} outfits worn`}>
        {gridRows.map((row, r) => (
          <View key={r} className="flex-row" style={{ gap: 6 }}>
            {row.map((real, c) => (
              <View
                key={c}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 6,
                  // The atlas's grid fill (#D9D2C2) has no token in the
                  // free-tier reconciliation table — `sand` is the closest
                  // structural tan already spent on tile grounds elsewhere.
                  // Logged in .redesign/primitive-requests/repeat.md.
                  backgroundColor: real ? theme.sand : 'transparent',
                }}
              />
            ))}
          </View>
        ))}
      </View>
      {/* Every fact the deleted paragraph and caption were carrying, in the
          register this card already used for the count. A clause whose value is
          null is dropped rather than filled — an unknown first-wear date or a
          day with no top plate simply shortens the line. */}
      <Text variant="colophon" className="mt-2" numberOfLines={2}>
        {colophon.join(' · ')}
      </Text>

      {gap ? (
        <View
          className="mt-4 rounded-md p-3.5"
          style={{ borderWidth: 1, borderColor: theme.rule }}>
          <Text variant="body">
            One more piece would give you {gap.gain} outfit{gap.gain === 1 ? '' : 's'} you&rsquo;ve
            never worn.
          </Text>
          {/* The arithmetic the sentence above already made, as the figure it
              is. It said the same thing twice — "the biggest change your closet
              could make — 14 to 17" restates "3 outfits you've never worn". */}
          <Text variant="colophon" className="mt-1.5">
            {`${total} → ${gap.total}`}
          </Text>
          <View className="mt-3 gap-2">
            {/* ONE OXBLOOD PER FRAME, AND THE CARD DOES NOT GET IT. A drawn
                primary here painted an upsell louder than the wear action on
                the plates below, which still take `accent` on an exhausted day —
                two oxblood actions in one frame, in the wrong order of
                importance. The membership door stays, in the quiet register
                `gap-card.tsx` already establishes on this screen, so the
                closet-first action is the only drawn button in the card. */}
            <Button title="Swap a piece instead" variant="secondary" onPress={onSwapInstead} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See plans"
              onPress={onSeePlans}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="justify-center active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                See plans
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
