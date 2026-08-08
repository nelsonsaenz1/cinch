import { View } from 'react-native';

import { canvasAlpha } from '@/components/reveal/reveal-stage';
import { Text } from '@/components/ui/text';
import type { MissingRow } from '@/features/onboarding/reveal-copy';
import { useTheme } from '@/theme/tokens';

/**
 * R-05 — the honest failure. Zero is a legitimate count and gets the exact
 * same typographic treatment as fourteen: the same `wordmark` headline
 * `RevealCount` sets, never a smaller or apologetic register
 * (free-tier-contract.md, The Reveal atlas 02).
 */
export function RevealEmpty({
  headline,
  body,
  rows,
  fix,
  onFix,
}: {
  /** "Ten pieces. No outfits yet." — from `zeroHeadline()`. */
  headline: string;
  body: string;
  rows: MissingRow[];
  /** The smallest real fix — from `smallestFix()`; null closets never reach here. */
  fix: string | null;
  onFix: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <Text variant="wordmark" trim style={{ color: theme.canvas }} accessibilityRole="header">
        {headline}
      </Text>
      <Text style={{ marginTop: 20, fontSize: 16, lineHeight: 25, color: canvasAlpha(0.7) }}>
        {body}
      </Text>

      <View
        style={{
          marginTop: 22,
          borderTopWidth: 1,
          borderTopColor: canvasAlpha(0.16),
          paddingTop: 16,
          gap: 10,
        }}>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, color: theme.canvas }}>{row.label}</Text>
            <Text
              style={{
                fontSize: 15,
                fontFamily: 'HelveticaNeue',
                fontVariant: ['tabular-nums'],
                color: row.needed ? theme.accentWarm : canvasAlpha(0.6),
              }}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {fix ? (
        <View style={{ marginTop: 28 }}>
          <Text
            onPress={onFix}
            accessibilityRole="button"
            accessibilityLabel={fix}
            style={{
              backgroundColor: theme.canvas,
              color: theme.ink,
              borderRadius: 12,
              textAlign: 'center',
              paddingVertical: 15,
              fontSize: 16,
              fontWeight: '500',
            }}>
            {fix}
          </Text>
          <Text
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontSize: 15,
              color: canvasAlpha(0.6),
            }}>
            Or keep them — nothing is deleted
          </Text>
        </View>
      ) : null}
    </View>
  );
}
