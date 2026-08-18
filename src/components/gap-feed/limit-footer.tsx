import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CARD } from '@/features/closet/gap-feed-spec';
import { useTheme } from '@/theme/tokens';

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
 *
 * ── REDESIGN 26: THE FRAME'S "SEE PLANS" IS NOT ADDED HERE ─────────────────
 *
 * The artifact draws this footer as a blush panel whose ONLY action is an
 * oxblood "See plans". The panel is adopted; the action is not, on two grounds
 * that point the same way.
 *
 * The packet's own law is that the See-plans placement "fires exactly as
 * shipped — placement key, trigger, routing; restyle only". As shipped there is
 * no See-plans trigger on the FEED at all: the placement
 * (`Placement.AddGarmentOverLimit`) is reached from the gap DETAIL screen, by
 * way of the closet-full sheet. Putting a second door on the feed would be a
 * new trigger for the same key, which is the one thing "as shipped" rules out.
 *
 * And the paragraph above this one already refused a paywall in this exact
 * position, for the reason `add-clothes.tsx` refuses it in the same notice: the
 * ceiling is arithmetic, and answering "you are full" with "pay us" skips the
 * free remedy that is sitting right there. Both remedies this footer offers are
 * real, and both still work at the ceiling.
 *
 * The restyle IS taken: the blush ground, the ink headline over a muted body,
 * and the panel inset inside the card's tray region, so a capacity notice and a
 * merchant tray occupy the same slot in the same geometry. Reported as a
 * deviation with this reasoning.
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

  // Redesign 26's wording, with the app's own figures in it. Both forms still
  // derive every number from `useCapacity`, which mirrors the limit triggers —
  // nothing here is typed, and the sentence follows a plan change on its own.
  const count = active
    ? `Your closet is full at ${limit} active pieces`
    : `You are at ${used} of ${limit} total pieces`;

  const body = active
    ? `Store something you are not reaching for and the new piece can take its place. ${STORED_KEEPS_SENTENCE}`
    : `Every slot is taken, stored ones included, so storing another piece would not make room. Deleting a stored piece frees one. ${STORED_KEEPS_SENTENCE}`;

  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.sand,
        paddingHorizontal: CARD.trayPaddingX,
        paddingTop: CARD.trayPaddingTop,
        paddingBottom: CARD.trayPaddingBottom,
      }}>
      <View
        accessible
        accessibilityLabel={`${count}. ${body}`}
        style={{
          borderRadius: 14,
          backgroundColor: theme.blush,
          paddingHorizontal: 16,
          paddingVertical: 15,
        }}>
        {/* Ink over muted, never a weight: the app has two cuts and neither is
            Medium (TY-01). The frame's bold headline is carried by size and
            colour instead. */}
        <Text variant="body" style={{ fontSize: 17, lineHeight: 23 }}>
          {count}
        </Text>
        <Text variant="body" className="mt-1.5" style={{ color: theme.muted, lineHeight: 22 }}>
          {body}
        </Text>

        <View className="mt-3.5 flex-row" style={{ gap: 8 }}>
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
    </View>
  );
}
