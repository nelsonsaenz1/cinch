import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { EXPLORE_COPY } from '@/features/explore/explore-spec';
import { useTheme } from '@/theme/tokens';

/**
 * UX-10's rule between what is new and what you have already seen.
 *
 * ── THE LOGIC IS UNTOUCHED; ONLY THE DRAWING MOVED ──────────────────────────
 *
 * `unseen.ts` still decides everything that matters: whether a boundary has
 * been proven at all (unproven means silent — no dot, no rule, no guess), and
 * which row the rule sits above. It only ever draws when both sides of it
 * exist, because a rule above the first row separates the page from itself.
 * This file draws what that arithmetic decided and adds one thing the accepted
 * frame prints and the shipped page did not: the DAY the boundary falls on.
 *
 * A rule with a word on it, never a coloured pill and never a count. The
 * boundary is a fact about your last visit, not an alert, and "3 new" is the
 * notification grammar this surface refuses by name.
 *
 * ── Two labels, one shape ───────────────────────────────────────────────────
 *
 * The frame sets the new side flush left with the rule running out to the
 * right, and the earlier side the same way one tone quieter. Both are `muted`
 * rather than the frame's clay: clay is `accentWarm`, which the contrast table
 * marks as furniture and not type. The distinction the frame draws with hue is
 * kept with weight and position instead — the new side leads the page, the
 * earlier side follows a card.
 */
export function NewSinceRule({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={EXPLORE_COPY.newSinceAccessibility}
      className="flex-row items-center gap-3 py-2.5">
      <Text variant="eyebrow" style={{ letterSpacing: 1.2 }}>
        {label}
      </Text>
      <View className="h-hair flex-1" style={{ backgroundColor: theme.rule }} />
    </View>
  );
}

/**
 * The other side of the boundary.
 *
 * `header` too, and deliberately: a reader navigating by headings should be
 * able to land on either side of the rule, not only on the new one. It says
 * only "Earlier" — never "older", never "previous looks", nothing that reads
 * as a page of content waiting to be paged into.
 */
export function EarlierRule() {
  const theme = useTheme();
  return (
    <View accessibilityRole="header" className="flex-row items-center gap-3 py-2.5">
      <Text variant="eyebrow" style={{ letterSpacing: 1.2 }}>
        {EXPLORE_COPY.earlier}
      </Text>
      <View className="h-hair flex-1" style={{ backgroundColor: theme.rule }} />
    </View>
  );
}
