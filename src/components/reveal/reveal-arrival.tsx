import { Image } from 'expo-image';
import { View } from 'react-native';

import { canvasAlpha } from '@/components/reveal/reveal-stage';
import { Text } from '@/components/ui/text';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { useTheme } from '@/theme/tokens';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * R-01 — the tenth piece settles. No number appears anywhere on this beat,
 * not greyed, not as a skeleton: "a placeholder where a computed fact will go
 * is the first small lie" (The Reveal atlas). The engine is still building the
 * count; the screen says so in words instead of guessing at digits.
 */
export function RevealArrival({
  otherUris,
  lastUri,
  pieceCount,
}: {
  /** The rest of the closet, dimmed behind the last piece. */
  otherUris: (string | undefined)[];
  /** The piece that just finished — full brightness, full size. */
  lastUri?: string;
  /**
   * How many pieces settled — usually ten, but "keep the slot open" finishes
   * at nine, honestly, and this eyebrow has to say so rather than always
   * reading "Ten of ten".
   */
  pieceCount: number;
}) {
  const theme = useTheme();

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {otherUris.slice(0, 6).map((uri, i) => (
          <View
            key={i}
            style={{
              width: '31.4%',
              aspectRatio: 1,
              borderRadius: 10,
              overflow: 'hidden',
              // Canvas composited over ink at low alpha, not a new hex — the
              // atlas's `#26241F` recessed tile isn't in the reconciliation
              // table, so it's derived from an existing token instead of
              // typed as a new literal (free-tier-contract.md §3).
              backgroundColor: canvasAlpha(0.06),
            }}>
            {uri ? (
              <Image
                source={{ uri }}
                contentFit="contain"
                style={{ width: '100%', height: '100%', opacity: 0.55 }}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>
        ))}
      </View>

      <View style={{ marginTop: 8, width: '31.4%' }}>
        <View
          style={{
            aspectRatio: 1,
            borderRadius: 10,
            overflow: 'hidden',
            backgroundColor: theme.canvas,
            // Warm ink, not a neutral black — the app has no true black
            // anywhere else either (theme.ink's own docs).
            shadowColor: theme.ink,
            shadowOpacity: 0.45,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
          }}>
          {lastUri ? (
            <Image
              source={{ uri: lastUri }}
              contentFit="contain"
              style={{ width: '100%', height: '100%', padding: 6 }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      </View>

      <Text
        style={{
          marginTop: 22,
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: canvasAlpha(0.55),
        }}>
        {`${cap(numberWord(pieceCount))} of ${numberWord(pieceCount)}`}
      </Text>
      <View style={{ marginTop: 8 }}>
        <Text variant="display" trim style={{ color: theme.canvas }}>
          That&rsquo;s your closet.
        </Text>
      </View>
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: canvasAlpha(0.66) }}>
        Working out what it makes&hellip;
      </Text>
    </View>
  );
}
