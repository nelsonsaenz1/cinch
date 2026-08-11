import { View } from 'react-native';

import { canvasAlpha } from '@/components/reveal/reveal-stage';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * R-02 / R-04 — the count, in the largest type anywhere in the app
 * (free-tier-contract.md, "beat 2 · the count"). Every figure here is a prop,
 * never computed inline — callers pass what `outfit-count.ts` and
 * `reveal-copy.ts` already worked out, so this component cannot drift into
 * doing its own arithmetic.
 */
export function RevealCount({
  headline,
  derivation,
  chips,
  showScrollHint = true,
}: {
  /** "Ten pieces. Fourteen outfits." — from `headline()`/`zeroHeadline()`. */
  headline: string;
  /** The sentence that derives it — from `defaultDerivation()`/`substitutionDerivation()`. */
  derivation: string;
  chips: string[];
  showScrollHint?: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <Text variant="wordmark" trim style={{ color: theme.canvas }} accessibilityRole="header">
        {headline}
      </Text>
      <Text style={{ marginTop: 20, fontSize: 16, lineHeight: 25, color: canvasAlpha(0.7) }}>
        {derivation}
      </Text>

      {chips.length > 0 ? (
        <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((chip) => (
            <View
              key={chip}
              style={{
                borderWidth: 1,
                borderColor: canvasAlpha(0.22),
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}>
              <Text style={{ fontSize: 12, color: canvasAlpha(0.55) }}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showScrollHint ? (
        <Text style={{ marginTop: 40, fontSize: 13, color: canvasAlpha(0.5) }}>
          Scroll for the first one ↓
        </Text>
      ) : null}
    </View>
  );
}
