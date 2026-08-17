import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  provenanceAccessibilityLabel,
  provenanceFrom,
} from '@/features/saved-looks/copy';

/**
 * OS-04's provenance row — who the look belonged to, how visible it was, and
 * when.
 *
 * ── READ-ONLY, AND THAT IS A SECURITY PROPERTY RATHER THAN A STYLE ─────────
 *
 * The frame draws a chevron on this row and this component does not, because
 * there is nowhere for it to go. Following it would mean opening somebody else's
 * look from inside the reader's private shelf — a read path that does not exist
 * in the schema, cannot be added without a new policy, and would break the
 * moment the source became unavailable, which is exactly when a reader is most
 * likely to tap it. So the row is `accessibilityRole="summary"`, has no press
 * handler, and is a statement.
 *
 * ── EVERY FIELD IS THE SNAPSHOT, NOT A LIVE READ ───────────────────────────
 *
 * "Visible to your Circle" is the visibility AS IT WAS when the look was kept.
 * After a revocation there is nothing left to re-read it from, and OS-04 still
 * has to be able to say what the look was — so all three values are frozen
 * columns and the immutability trigger keeps them that way.
 *
 * ── STACKS AT AX SIZES ─────────────────────────────────────────────────────
 *
 * OS-10a puts the visibility line under the name instead of beside it. That is
 * the default composition here, not a branch: the two lines are already stacked
 * at every size, and only the avatar sits alongside. One layout is one thing to
 * be right about.
 */

export type ProvenanceRowProps = {
  /** "Maya's Daily look" — the snapshot label, never rebuilt from a live profile. */
  sourceLabel: string;
  /** "Visible to your Circle", "Event look", "Private". */
  visibility: string;
  /** The source's own date, already formatted by the caller. */
  when: string;
};

export function ProvenanceRow({ sourceLabel, visibility, when }: ProvenanceRowProps) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-md bg-tray p-3"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={provenanceAccessibilityLabel({ sourceLabel, visibility, when })}>
      <View className="flex-1 gap-1">
        {/*
          No `numberOfLines`. §9: "provenance wraps to two lines" at AX sizes,
          which means it must be allowed to wrap rather than told to.
        */}
        <Text variant="label">{provenanceFrom(sourceLabel)}</Text>
        <Text variant="caption" className="text-muted">
          {visibility} · {when}
        </Text>
      </View>
    </View>
  );
}
