import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { EXPLORE_COPY } from '@/features/explore/explore-spec';
import { useTheme } from '@/theme/tokens';

/**
 * THE END OF THE WEEK, AS A DESIGNED MARK — the accepted
 * `caught-up-designed-ending` frame.
 *
 * ── Why the ending is furniture and not a footnote ──────────────────────────
 *
 * Explore stops. A feed that never says so is telling the reader there is
 * always more, which is the mechanic this product rejects by name — and the
 * shipped page said it in a 13pt grey line at the bottom, which is what a
 * disclaimer looks like, not what an ending looks like. Redesign 17 gives it a
 * composition: a short rule, the sentence in the serif, the reason underneath,
 * and one oxblood full stop.
 *
 * The words changed with the setting, and the change is the point. "You're
 * caught up with your circle" says the scroll ran out. "You've seen the whole
 * week" says the WINDOW ran out — seven days is the entire life of a shared
 * look, so a reader at the bottom of this page has genuinely seen all there
 * is, and the line below names the rule that makes it true. The old sentence
 * survives untouched where it belongs: `features/explore/feed.ts` still owns
 * it, `daily-social/copy.ts` still imports it, and the secondary additions
 * list still ends on its own quieter mark.
 *
 * ── Terminal by construction ────────────────────────────────────────────────
 *
 * No button, no spinner, no sentinel for an infinite scroller to trip, no
 * "load more" and nothing that implies content past it. There is nothing below
 * this on the page.
 *
 * ── THE DOT ─────────────────────────────────────────────────────────────────
 *
 * The one place this page spends the accent on something that is not a
 * reaction, and it is spendable because it appears once, at the end, and never
 * again. A dot is not a badge and cannot be mistaken for one: it counts
 * nothing, it does not appear before the reader arrives, and there is nothing
 * behind it to open. It is punctuation, and the sentence it ends is the week.
 *
 * Hidden from VoiceOver — the lines above already say the page is over, and a
 * decorative mark announced beside them is the same fact twice.
 */
export function CaughtUpMark() {
  const theme = useTheme();

  return (
    <View
      className="items-center"
      accessibilityRole="summary"
      accessibilityLabel={EXPLORE_COPY.endingAccessibility}>
      <View className="h-hair w-14" style={{ backgroundColor: theme.rule }} />

      <View style={{ marginTop: 22 }}>
        <Text variant="title" trim className="text-center">
          {EXPLORE_COPY.endingTitle}
        </Text>
      </View>

      <Text variant="note" className="mt-3 text-center">
        {EXPLORE_COPY.endingBody}
      </Text>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mt-6 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: theme.accent }}
      />
    </View>
  );
}

/**
 * The secondary timeline's closure — the accepted `quiet-day` frame's mark.
 *
 * Quieter than the week's ending on purpose: it closes a LIST, not the page,
 * and two full stops of equal weight on one screen would each undo the other.
 * Same refusals hold — nothing here implies anything past it.
 */
export function AdditionsEndMark() {
  const theme = useTheme();

  return (
    <View className="items-center" accessibilityRole="summary">
      <View className="h-hair w-14" style={{ backgroundColor: theme.rule }} />
      <Text variant="note" className="mt-3 text-center" style={{ fontStyle: 'italic' }}>
        {EXPLORE_COPY.additionsEnding}
      </Text>
    </View>
  );
}
