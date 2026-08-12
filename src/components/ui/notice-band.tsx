import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * The group-4 notice band — tray ground, r12, an uppercase CAUSE over a Medium
 * title, prose beneath, and up to two peer actions.
 *
 * Ten distinct causes across the diary, the plan and packing are drawn in this
 * one shape (atlas group 4, §6 "Notice band (tray)"), which is why it is a
 * component rather than ten hand-built cards: PL-03 alone draws three of them
 * on one frame, and the whole point of the frame is that the three read as the
 * same object saying different things.
 *
 * ── Why it lives here ──────────────────────────────────────────────────────
 *
 * It was built inside `components/plan/` because both of its consumers (the
 * diary spine and the plan week) were in one lane, and promoting into
 * `components/ui/**` — the integrator's folder, not a lane's — was recorded as
 * a serialization request instead of taken unilaterally.
 *
 * Group 5 is the later group that request anticipated: its inventory lists the
 * band as "Inherited — now also the moderation and system voice in comments",
 * which puts a third and fourth consumer outside `components/plan/` entirely.
 * The integrator moved it here at the Group-5 checkpoint. Nothing about the
 * shape changed in the move; only the import path did.
 *
 * ── Refusals it holds ──────────────────────────────────────────────────────
 *
 * · The cause is a WORD, never a colour or an icon — "no colour tint" is the
 *   atlas's rule for the planned diary row and it is the same rule here.
 * · Actions are peers. Nothing in this band is filled, because a notice is not
 *   a thing being sold; the two recoveries on PL-03 ("Try Friday again",
 *   "Choose it myself") are deliberately the same weight as each other.
 * · `accessibilityLiveRegion="polite"`: every one of these appears after the
 *   control that caused it has already moved on.
 */
export type NoticeBandAction = {
  label: string;
  onPress: () => void;
  loading?: boolean;
};

export function NoticeBand({
  cause,
  title,
  body,
  actions = [],
  className = '',
}: {
  /** The uppercase cause label — "PLANNING FAILED", "OFFLINE", "SHORT CLOSET". */
  cause: string;
  title: string;
  body: string;
  /** Zero, one or two. Never three: a notice with three ways out is a menu. */
  actions?: NoticeBandAction[];
  className?: string;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      // r12 is the labelled-control radius and the tray's own; `rounded-md`
      // resolves to it (tailwind.config.js), so no new value is spent here.
      className={`rounded-md bg-tray p-4 ${className}`}>
      <Text variant="eyebrow">{cause}</Text>
      {/* The title is a LABEL — Medium, one line of naming — and the body is
          PROSE in the regular cut. `note` rather than `caption` for exactly
          the reason the constitution gives: prose set in `caption` is prose
          wearing a label's clothes. */}
      <Text variant="body" className="mt-1.5 font-semibold">
        {title}
      </Text>
      <Text variant="note" className="mt-1.5">
        {body}
      </Text>

      {actions.length > 0 ? (
        // 8pt apart, and both 44pt — the group's accessibility line for
        // actions inside a notice tray.
        <View className="mt-3.5 flex-row flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              title={action.label}
              variant="secondary"
              loading={action.loading}
              onPress={action.onPress}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
