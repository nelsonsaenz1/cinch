import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import type { MissingRow } from '@/features/onboarding/reveal-copy';
import { useTheme } from '@/theme/tokens';

/**
 * R-05 — the honest zero.
 *
 * Zero is a legitimate count and gets exactly the same typographic treatment as
 * fourteen: the same 46px serif headline, never a smaller or apologetic
 * register. The zero prints here because it is the subject of the screen.
 *
 * "NEEDED" IS A WORD AND A COLOUR, never a colour alone — a reader who cannot
 * separate oxblood from ink still has the word beside the figure.
 *
 * THE FRAME'S OXBLOOD IS SPENT ON THE NEEDED MARKS, so the action is INK. This
 * is the one frame in the hallway whose primary action is not the accent, and
 * it is the atlas's own instruction: the thing that matters on this screen is
 * what is missing, not the button.
 */
export function RevealEmpty({
  headline,
  body,
  rows,
  fix,
  onFix,
  onOpenToday,
}: {
  /** "Ten pieces. No outfits yet." — from `zeroHeadline()`. */
  headline: string;
  body: string;
  rows: MissingRow[];
  /** The smallest real fix — from `smallestFix()`; null closets never reach here. */
  fix: string | null;
  onFix: () => void;
  onOpenToday: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1">
      <View className="flex-1">
        <Text variant="wordmark" trim accessibilityRole="header" style={{ fontSize: 46 }}>
          {headline}
        </Text>
        <Text variant="note" style={{ marginTop: 14, fontSize: 17, lineHeight: 26 }}>
          {body}
        </Text>

        {/* Only the kinds that bear on the failure are listed — a closet with a
            dress and no shoes shows Dresses and Shoes, never a Bottoms row
            nobody's outfit needs. */}
        <View style={{ marginTop: 26 }}>
          {rows.map((row) => (
            <View key={row.label}>
              <Rule />
              <View
                className="flex-row items-center justify-between"
                style={{ paddingVertical: 12 }}>
                <Text variant="body" style={{ fontSize: 16 }}>
                  {row.label}
                </Text>
                <Text
                  variant="heading"
                  style={{
                    fontSize: 16,
                    fontVariant: ['tabular-nums'],
                    color: row.needed ? theme.accent : theme.ink,
                  }}>
                  {row.value}
                </Text>
              </View>
            </View>
          ))}
          <Rule />
        </View>
      </View>

      <View style={{ paddingBottom: 20 }}>
        {fix ? <Button title={fix} variant="ink" onPress={onFix} className="self-stretch" /> : null}
        {/* Nothing is withheld by leaving: the pieces are already in the closet
            and every other surface still works. */}
        <Button
          title="Open Today anyway"
          variant="ghost"
          onPress={onOpenToday}
          className="self-stretch"
        />
      </View>
    </View>
  );
}
