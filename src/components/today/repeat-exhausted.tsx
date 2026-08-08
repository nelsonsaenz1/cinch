import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { CountedKind, Gain } from '@/features/closet/outfit-count';
import { describeShortDate, ordinalWord } from '@/features/styling/repeat';
import { useTheme } from '@/theme/tokens';

const KIND_LABEL: Record<CountedKind, string> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'dress',
  shoes: 'pair of shoes',
};

/** Whole days between two instants, using their LOCAL calendar dates. */
function daysBetween(a: Date, b: Date): number {
  const toNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((toNoon(b) - toNoon(a)) / 86_400_000);
}

/**
 * P-03 — exhausted. Every core the closet can build has a real worn record.
 *
 * The one place the argument is made at length, and it earns that by being
 * factually complete: the grid is `total` real cells, `since` is a real first
 * wear date, and the gap suggestion is `rankGaps`'s own top entry, not a
 * canned line. The closing sentence is why this is additive rather than a
 * takeover — Cinch keeps suggesting outfits below this card either way.
 *
 * Rendered as a card ABOVE the day's plates, never in place of them (rule 11:
 * this screen does not get redesigned, only added to).
 */
export function RepeatExhausted({
  total,
  since,
  now = new Date(),
  gap,
  currentCountOfKind,
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
  /** How many of `gap.kind` the closet owns today, for "a second X". */
  currentCountOfKind: number;
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

  return (
    <View className="mx-gutter mt-4 rounded-plate border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark">
      {dayNumber != null ? (
        <Text variant="eyebrow" className="mb-1.5">
          {`Day ${dayNumber}`}
        </Text>
      ) : null}
      <Text variant="title">You&rsquo;ve now worn all {total}.</Text>
      <Text variant="body" className="mt-2.5 text-muted dark:text-muted-dark">
        Every outfit your closet makes has been out at least once. From here Cinch is choosing
        between things you&rsquo;ve already worn — that&rsquo;s the shape of a small closet, not a
        fault in your clothes.
      </Text>

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
      {since ? (
        <Text variant="colophon" className="mt-2">
          {`${total} OF ${total} WORN · SINCE ${describeShortDate(since).toUpperCase()}`}
        </Text>
      ) : null}

      {gap ? (
        <View
          className="mt-4 rounded-md p-3.5"
          style={{ borderWidth: 1, borderColor: theme.rule }}>
          <Text variant="body">
            One more piece would give you {gap.gain} outfit{gap.gain === 1 ? '' : 's'} you&rsquo;ve
            never worn.
          </Text>
          <Text variant="callout" className="mt-1.5 text-muted dark:text-muted-dark">
            A {ordinalWord(currentCountOfKind + 1)} {KIND_LABEL[gap.kind]} is the biggest change
            your closet could make — {total} to {gap.total}.
          </Text>
          <View className="mt-3 gap-2">
            <Button title="See plans" variant="primary" onPress={onSeePlans} />
            <Button title="Swap a piece instead" variant="secondary" onPress={onSwapInstead} />
          </View>
        </View>
      ) : null}

      {/* `caption`'s own colour is `muted`, not `faint` — this sentence is
          real content ("Cinch keeps styling either way"), and `faint` fails
          AA for anything but a decorative mark (Standing refusal 1). */}
      <Text variant="caption" className="mt-3.5">
        Cinch keeps styling either way.
        {topOutfitName
          ? topOutfitWearCount > 0
            ? ` Today's best is ${topOutfitName}, worn ${topOutfitWearCount}×.`
            : ` Today's best is ${topOutfitName}.`
          : ''}
      </Text>
    </View>
  );
}
