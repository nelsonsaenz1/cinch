import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

import {
  capacityNoteApplies,
  capacityNoteBody,
  capacityNoteHeading,
} from './capacity-note-copy';

/**
 * TD-00 — "Paywall dismissed — Today, free closet intact."
 *
 * The last thing on the page the first-run hallway hands into, and the whole of
 * what makes TD-00 a state rather than a repeat of T-01: after MB-07 is closed,
 * Today says plainly that the free closet is whole and that nothing was locked
 * by the dismissal.
 *
 * WHAT IT IS NOT, AND THE ATLAS SAYS SO IN ONE LINE: "The capacity note is a
 * fact in tray, not an upgrade prompt — no price and no tier name one screen
 * after a dismissed paywall." So it carries no action at all. There is no
 * button, no "See plans", no chevron — a control here would be the second
 * attempt to persuade that MB-05's own annotation refuses ("there is no second
 * attempt to persuade after a decline"), and the paywall is a remotely rendered
 * Superwall document this lane may not duplicate in any case.
 *
 * ONE OXBLOOD PER FRAME, AND THIS IS NOT IT. The frame's accent belongs to the
 * plate's wear action, exactly as TD-00's own "Oxblood spent here" marker sets
 * it. This band is tray and ink, and it competes with nothing.
 *
 * ZERO IS QUIET, AND SO IS EVERY OTHER SIZE. The note renders only where its
 * sentence is true — see `capacityNoteApplies` for the three conditions and why
 * each one would otherwise print something false.
 */
export function CapacityNote({
  /**
   * The ACTIVE closet — `useWardrobe`'s own rows, which are already filtered to
   * `is_archived = false`. Deliberately the same array Today styles from, so
   * this count and the grid above it can never disagree.
   */
  activePieces,
  /**
   * The account's plan, from `usePlan()` — or NULL while it is still being read
   * and if the read failed. `usePlan` answers `free` in both of those cases,
   * which is the right default for a gate (refuse nothing) and the wrong one
   * for a sentence (claim nothing).
   */
  plan,
}: {
  activePieces: number;
  plan: string | null;
}) {
  const theme = useTheme();

  if (!capacityNoteApplies(plan, activePieces)) return null;

  return (
    <View className="mx-gutter mt-4 rounded-md bg-tray px-4 py-3.5">
      <Text variant="label" style={{ color: theme.ink }}>
        {capacityNoteHeading(activePieces)}
      </Text>
      <Text variant="note" className="mt-1">
        {capacityNoteBody(activePieces)}
      </Text>
    </View>
  );
}
