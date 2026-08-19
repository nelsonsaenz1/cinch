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

/**
 * The four things a recorded opinion can be in the middle of.
 *
 * `clearing` was added 2026-08-18 with the toggle. It is a distinct status
 * rather than a boolean beside `pending` because the two are drawn and spoken
 * differently — one is a filled pill on its way to existing, the other is a
 * filled pill on its way to not existing — and a reader who cannot see the
 * difference has no way to tell a save from an undo.
 *
 * There is no `clearFailed`. A retraction that did not land leaves the reaction
 * exactly as recorded as it was a moment ago, so the honest drawing of that
 * failure is `saved`: the pill goes back to filled, which is TRUE, and the next
 * tap tries the clear again. Inventing a fifth state would be inventing a
 * distinction the server does not make.
 */
export type TasteState = {
  choice: TasteChoice;
  status: 'pending' | 'saved' | 'failed' | 'clearing';
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

/**
 * ── THE PILLS ARE TOGGLES NOW ───────────────────────────────────────────────
 *
 * Founder defect, 2026-08-18: "Love it" and "Hate it" latched. Once either had
 * been tapped the pair went inert, and the only way out of a mis-tap was to
 * never see that outfit again.
 *
 * A latched control is worse here than almost anywhere else in the app, because
 * of what is on the other end of it. `apply_outfit_reaction` writes into
 * `style_profiles.weights` — a mis-tapped "Hate it" is not a wrong pixel, it is
 * the learner being taught something the user does not believe, on a screen
 * whose whole purpose is to learn what they do. So the retraction is a real
 * server retraction (`useReactToOutfit`'s `clear`, which deletes the training
 * row), not a local un-highlight that leaves the corpus lying.
 *
 * THE PAIR IS STILL ONE ANSWER. Tapping the OTHER pill while one is recorded is
 * still refused, exactly as before and for the original reason: two reactions to
 * one outfit is a contradiction written to the learner. What has changed is that
 * the way to change your mind now exists — clear the one you gave, and both come
 * back. That is one more tap than switching directly and it is the honest shape:
 * the withdrawal and the new opinion are two facts, and the server records them
 * as two.
 *
 * A FAILED SAVE STILL RETRIES RATHER THAN CLEARING. `failed` means nothing was
 * recorded, so there is nothing to take back and the same tap tries again — the
 * rule the wear action follows. Only a `saved` pill clears.
 */
export function TasteRow({
  value,
  large = false,
  disabled = false,
  onChoose,
  onClear,
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
  /**
   * Take the recorded reaction back. Called only for the pill that is currently
   * `saved` — the caller never has to work out which one that was.
   */
  onClear: (choice: TasteChoice) => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-row items-stretch" style={{ gap: 8, paddingTop: 8 }}>
      {(['love', 'hate'] as const).map((choice) => {
        const chosen = value?.choice === choice;
        const failed = chosen && value?.status === 'failed';
        // Mid-write, in either direction. Held inert rather than pressable: a
        // clear that overtakes its own save would delete a row that is not
        // there yet and leave the reaction recorded under a cleared pill.
        const busy = chosen && (value?.status === 'pending' || value?.status === 'clearing');
        // The recorded state, settled — the only one a tap can undo.
        const clears = chosen && value?.status === 'saved';
        // A reaction is spent once EITHER has been recorded — the pair is one
        // answer, not two independent switches, and letting the second be
        // pressed after the first would write a contradiction to the learner.
        const spent = value !== null && value.status !== 'failed';
        const inert = disabled || (spent && !chosen) || busy;

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
                  : value?.status === 'clearing' && chosen
                    ? `${label}, clearing`
                    : value?.status === 'pending' && chosen
                      ? `${label}, saving`
                      : chosen
                        ? `${label}, selected`
                        : LABELS[choice].offer
            }
            // The third channel, and the reason the fill is not doing this work
            // alone: a reader who cannot see which pill is dark is told what
            // the tap will do rather than left to guess that a second press
            // undoes the first.
            accessibilityHint={clears ? 'Clears this reaction' : undefined}
            accessibilityState={{ selected: chosen, disabled: inert, busy }}
            disabled={inert}
            onPress={() => {
              // The lightest intent the policy has, in both directions —
              // `haptics.selection()` is UISelectionFeedbackGenerator, which is
              // what iOS reserves for a value changing under the finger, and
              // setting and clearing a taste note are the same size of event.
              // Nothing here earns `commit()`: a reaction is not a wear.
              haptics.selection();
              if (clears) onClear(choice);
              else onChoose(choice);
            }}
            style={{ flex: 1, minHeight: large ? 56 : 44 }}
            className={[
              'items-center justify-center rounded-md px-4',
              inert && !chosen ? 'bg-tray' : '',
              chosen && !failed ? 'bg-ink' : '',
              failed ? 'border border-accent' : '',
              !chosen && !inert ? 'border border-rule active:opacity-70' : '',
              // Pressable feedback on the recorded pill too. Without it the
              // filled state reads as a label rather than a control, which is
              // precisely how the latch went unnoticed.
              clears ? 'active:opacity-70' : '',
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
