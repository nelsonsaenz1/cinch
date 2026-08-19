import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/tokens';

/**
 * Today's taste row — "Love it" and "Hate it", beside the day's decision.
 *
 * ── WHY THIS EXISTS AGAIN ───────────────────────────────────────────────────
 *
 * Redesign 11 took the reaction bar off Today and argued that the wear sheet's
 * stars would carry the learner instead: one opinion a day, about the outfit
 * actually put on. The founder has reversed that. The reasoning behind the
 * reversal is the arithmetic the redesign did not do — a wear is ONE signal a
 * day and only ever a positive one, so the learner stopped hearing about the
 * two cards that were passed over every morning. Those are the cheapest and
 * most numerous signals the app can collect, and `favorExactCores` /
 * `apply_outfit_reaction` were still sitting there wired up with nothing
 * calling them from this screen.
 *
 * Nothing about the LEARNER changed to bring them back. This row calls
 * `useReactToOutfit` with `source: 'today'`, exactly as the bar did before
 * redesign 11 removed its call site.
 *
 * ── WHY NOT `ReactionBar` ───────────────────────────────────────────────────
 *
 * `components/today/reaction-bar.tsx` still draws this pair for the legacy
 * plate, and mounting it here was the obvious reach. It brings three things
 * Today does not want: a dislike-reason chooser that asks a second question
 * after the first one is answered, a wear control that would be a duplicate of
 * the pill this row sits under, and a direct `expo-haptics` import — the run
 * goes through `@/lib/haptics` now. So Today draws its own pair in redesign
 * 11's hand and the legacy bar is left untouched for the screens that still
 * mount it.
 *
 * ── THE GRAMMAR, WHICH IS NOT NEW ───────────────────────────────────────────
 *
 * The states are `w3ReactionSpec`'s states, drawn at redesign 11's sizes:
 * idle is an outline, a recorded reaction is filled ink with a canvas label,
 * and a write that did not land keeps the oxblood edge rather than pretending
 * to have saved. The heights match the `Wear this` pill directly above rather
 * than the 48/60 of the W3-G2 three-across row, because on this card these are
 * the SECOND rank: the day's decision is the filled oxblood above them, and a
 * taste note is not its peer.
 */

export type TasteChoice = 'love' | 'hate';

export type TasteState = {
  choice: TasteChoice;
  status: 'pending' | 'saved' | 'failed';
} | null;

/**
 * The labels, in the founder's own words.
 *
 * The legacy bar says "Not for me", which is the app's softer register and was
 * chosen when the control sat under a reason chooser that would ask why. This
 * row asks nothing further, so the label is the whole of what is recorded and
 * the founder's "Hate it" is the honest strength of it — a signal that costs
 * the outfit real ranking weight should not be phrased as a shrug.
 *
 * Both verbs change once they are spent. "Love it" is an offer; "Loved" is a
 * record — the same third channel the legacy bar uses, and the reason a
 * recorded state does not rely on the fill alone.
 */
const LABELS: Record<TasteChoice, { offer: string; recorded: string }> = {
  love: { offer: 'Love it', recorded: 'Loved' },
  hate: { offer: 'Hate it', recorded: 'Noted' },
};

export function TasteRow({
  value,
  large = false,
  disabled = false,
  onChoose,
}: {
  value: TasteState;
  /** An accessibility text size — the pills grow with the label. */
  large?: boolean;
  /**
   * True with no connection to write over. The controls are drawn quiet and
   * inert rather than removed: a row that vanishes offline is a row the reader
   * has to rediscover, and this one sits in a fixed place under the card.
   */
  disabled?: boolean;
  onChoose: (choice: TasteChoice) => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-row items-stretch" style={{ gap: 8, paddingTop: 8 }}>
      {(['love', 'hate'] as const).map((choice) => {
        const chosen = value?.choice === choice;
        const failed = chosen && value?.status === 'failed';
        // A reaction is spent once EITHER has been recorded — the pair is one
        // answer, not two independent switches, and letting the second be
        // pressed after the first would write a contradiction to the learner.
        const spent = value !== null && value.status !== 'failed';
        const inert = disabled || (spent && !chosen);

        const label = chosen ? LABELS[choice].recorded : LABELS[choice].offer;

        return (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityLabel={
              disabled
                ? `${LABELS[choice].offer}, unavailable without a connection`
                : failed
                  ? `${LABELS[choice].offer}, not saved — tap to try again`
                  : chosen
                    ? `${label}, selected`
                    : LABELS[choice].offer
            }
            accessibilityState={{ selected: chosen, disabled: inert }}
            disabled={inert}
            onPress={() => {
              haptics.selection();
              onChoose(choice);
            }}
            style={{ flex: 1, minHeight: large ? 56 : 44 }}
            className={[
 'items-center justify-center rounded-md px-4',
              inert && !chosen ? 'bg-tray' : '',
              chosen && !failed ? 'bg-ink' : '',
              failed ? 'border border-accent' : '',
              !chosen && !inert ? 'border border-rule active:opacity-70' : '',
            ].join(' ')}>
            <Text
              variant="label"
              style={{
                color: failed
                  ? theme.accent
                  : chosen
                    ? theme.canvas
                    : inert
                      ? theme.muted
                      : theme.ink,
              }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
