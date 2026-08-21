import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/** Reactions before the profile is worth quoting back. S-09/S-10's own number. */
const THRESHOLD = 8;

/**
 * How much Cinch has actually learned, drawn rather than narrated.
 *
 * The page used to end on a sentence doing a gauge's job — "3 more reactions
 * and Cinch will start recognising your taste." — stacked under the capacity
 * note, so the last thing after a page of clothing was three paragraphs of
 * explanation. Eight bars say the same thing in the grid grammar
 * `repeat-exhausted.tsx` already uses for worn cores, and the colophon under
 * them carries the surviving facts in the page's quietest register.
 *
 * NOTHING IS LOST TO A SCREEN READER. The sentence this replaced is still the
 * `accessibilityLabel` of the block, verbatim — the bars are a picture of it,
 * not an abbreviation of it.
 *
 * NO ACCENT. The frame's one oxblood stays on the plate's wear action; this is
 * sand on hairline and a muted line, and it competes with nothing.
 */
export function TasteMark({
  /** `profile.feedbackCount` — real reactions, never a placeholder. */
  feedbackCount,
  /** `profile.summary[0]` if it exists, else null. */
  summary,
}: {
  feedbackCount: number;
  summary: string | null;
}) {
  const theme = useTheme();
  const learning = feedbackCount >= THRESHOLD;
  const filled = Math.min(feedbackCount, THRESHOLD);

  // The sentence the bars replaced, kept whole for assistive tech.
  const spoken = learning
    ? summary
      ? `Learning from ${feedbackCount} reactions — it thinks you ${summary}.`
      : `Learning from ${feedbackCount} reactions.`
    : `${THRESHOLD - feedbackCount} more reactions and Cinch will start recognizing your taste.`;

  const figure = learning
    ? summary
      ? `LEARNING FROM ${feedbackCount} REACTIONS · ${summary.toUpperCase()}`
      : `LEARNING FROM ${feedbackCount} REACTIONS`
    : `${feedbackCount} OF ${THRESHOLD} REACTIONS`;

  return (
    <View accessible accessibilityLabel={spoken}>
      <Text variant="eyebrow">Taste</Text>
      <View className="mt-2 flex-row" style={{ gap: 6 }}>
        {Array.from({ length: THRESHOLD }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: i < filled ? theme.sand : theme.hairline,
            }}
          />
        ))}
      </View>
      <Text variant="colophon" className="mt-2">
        {figure}
      </Text>
    </View>
  );
}
