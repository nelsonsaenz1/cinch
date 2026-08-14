import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { shadow, useTheme } from '@/theme/tokens';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * R-01 — the tenth piece settles. No number appears anywhere on this beat, not
 * greyed, not as a skeleton: "a placeholder where a computed fact will go is
 * the first small lie". The engine is still building the count; the screen says
 * so in words instead of guessing at digits.
 *
 * NOT REDRAWN BY THIS ATLAS — the hallway draws R-02, R-04 and R-05 and leaves
 * this beat alone, so its composition is unchanged. What did change is the
 * ground under it: the stage is canvas now (see `reveal-stage.tsx`), and a beat
 * that stayed on ink would have flashed dark for a second and then paled, which
 * is worse than either ground on its own.
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
   * How many pieces actually arrived. Ten on the ordinary path, and this
   * eyebrow reads the real figure rather than always printing "Ten of ten" —
   * the Reveal is reachable from routes that do not fill the grid.
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
              borderRadius: 12,
              overflow: 'hidden',
              // `sand` — the deepest paper tone, which is what a recessed
              // tile is on a canvas ground. The old value was canvas at 6%
              // over ink, and it disappeared entirely when the stage stopped
              // being ink.
              backgroundColor: theme.sand,
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
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: theme.surface,
            // Warm ink, not a neutral black — the app has no true black
            // anywhere else either (theme.ink's own docs).
            shadowColor: theme.ink,
            // The app's one elevation: the contact shadow, 0/5/11 at 16%.
            // The old 0/10/22 at 45% was a dark-ground lift and reads as a
            // bruise on paper.
            shadowOpacity: 0.16,
            shadowRadius: shadow.contact.blur,
            shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy },
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

      <View style={{ marginTop: 22 }}>
        <Text variant="eyebrow">
          {`${cap(numberWord(pieceCount))} of ${numberWord(pieceCount)}`}
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <Text variant="display" trim>
          That&rsquo;s your closet.
        </Text>
      </View>
      <Text variant="note" style={{ marginTop: 10, fontSize: 15 }}>
        Working out what it makes&hellip;
      </Text>
    </View>
  );
}
