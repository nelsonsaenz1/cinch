import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * GF-04 — the active shelf is full, drawn as the gap card's own tray footer.
 *
 * ── CORRECTION 20: "ADD ANYWAY AND STORE LATER" IS DELETED ─────────────────
 *
 * Not disabled, not moved, not reworded. Deleted. At an active limit the piece
 * cannot be created until a slot is freed, and that is not a policy — it is
 * what the database does. `enforce_item_limit()` raises `closet_limit_reached`
 * on `before insert on items` when the unarchived count is at the plan's
 * active ceiling (migration 20260808190100), so "add anyway and store later"
 * described a sequence the app cannot perform: the add fails first, and the
 * storing that was promised for later never gets a row to attach to. Drawing
 * it was drawing a state the app cannot enter, which is the standing "never a
 * dead control" refusal.
 *
 * The two recoveries that remain are the two the app really has, and their
 * wording is the Closet's own — "See stored" is the exact string
 * `app/add-clothes.tsx` uses for the same destination, and the sentence about
 * what a stored piece keeps is that screen's sentence verbatim, because two
 * screens describing the same act in two voices is how a user learns to
 * distrust both.
 *
 * ── THE TOTAL CEILING IS A DIFFERENT CASE ──────────────────────────────────
 *
 * The same migration enforces a SECOND ceiling — `storage_limit_reached`, over
 * every row the account holds, archived included — and its hint is a different
 * hint for a reason: "Delete a stored piece, or upgrade." Storing does not help
 * there, because the stored pieces are the problem. `useCapacity` exposes the
 * two counts separately (`full` vs `storageFull`) precisely so this footer can
 * tell them apart, and the `total` variant offers the only remedy that exists
 * rather than an action that would fail the same way twice.
 *
 * NO TIER, NO PRICE, NO PAYWALL. Capacity is arithmetic from the current plan;
 * membership is reached from Profile. That is `add-clothes.tsx`'s rule for the
 * same notice and it holds here.
 */
export type GapLimitFooterProps = {
  /** 'active' — storing frees a slot. 'total' — it does not. */
  ceiling: 'active' | 'total';
  used: number;
  limit: number;
  /** Only offered on the active ceiling: on the total one it cannot succeed. */
  onChooseToStore?: () => void;
  onSeeStored: () => void;
};

/** The Closet's own sentence about what a stored piece keeps. Verbatim. */
export const STORED_KEEPS_SENTENCE =
  'Stored pieces keep their photographs, wear history and price.';

export function GapLimitFooter({
  ceiling,
  used,
  limit,
  onChooseToStore,
  onSeeStored,
}: GapLimitFooterProps) {
  const active = ceiling === 'active';

  const count = active ? `${used} of ${limit} active pieces` : `${used} of ${limit} pieces in all`;

  const body = active
    ? `Store something you are not reaching for and the new piece can take its place. ${STORED_KEEPS_SENTENCE}`
    : `Every slot is taken, stored ones included, so storing another piece would not make room. Deleting a stored piece frees one. ${STORED_KEEPS_SENTENCE}`;

  return (
    <View className="bg-tray" style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 }}>
      <Text variant="body" style={{ fontSize: 15 }}>
        {count}
      </Text>
      <Text variant="note" className="mt-1">
        {body}
      </Text>

      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        {active && onChooseToStore ? (
          // Ink, not oxblood: this is the workhorse action, and the accent is
          // not spent on a capacity decision.
          <View className="flex-1">
            <Button title="Choose one to store" variant="ink" onPress={onChooseToStore} />
          </View>
        ) : null}
        <View className="flex-1">
          <Button title="See stored" variant="secondary" onPress={onSeeStored} />
        </View>
      </View>
    </View>
  );
}
