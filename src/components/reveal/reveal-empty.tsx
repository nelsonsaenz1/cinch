import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { REVEAL_COPY } from '@/features/onboarding/reveal-spec';
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
  needs,
  fix,
  onFix,
  onOpenToday,
}: {
  /** "Not an outfit yet." — the result, stated as a result. */
  headline: string;
  body: string;
  /**
   * What is missing, as things a person could photograph — from
   * `missingPhrases()`. This was a label/value TABLE and the accepted frames
   * replace it with phrases, because a reader who has just been told the
   * arithmetic came back nothing should not have to do the arithmetic again to
   * work out what to do.
   */
  needs: string[];
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

        {/* Only what bears on the failure is listed — a closet with a dress
            and no shoes names shoes, never a bottom nobody's outfit needs. */}
        <View style={{ marginTop: 26 }}>
          {needs.map((need) => (
            <View key={need}>
              <Rule />
              <View style={{ paddingVertical: 14 }}>
                <Text variant="body" style={{ fontSize: 16, color: theme.ink }}>
                  {need}
                </Text>
              </View>
            </View>
          ))}
          {needs.length > 0 ? <Rule /> : null}
        </View>
      </View>

      <View style={{ paddingBottom: 20 }}>
        {fix ? <Button title={fix} variant="ink" onPress={onFix} className="self-stretch" /> : null}
        {/* Nothing is withheld by leaving: the pieces are already in the closet
            and every other surface still works. */}
        <Button
          title={REVEAL_COPY.zeroOpenToday}
          variant="ghost"
          onPress={onOpenToday}
          className="self-stretch"
        />
      </View>
    </View>
  );
}
