import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { useTheme } from '@/theme/tokens';

/**
 * C-05 — nothing filed yet.
 *
 * ── WHAT THIS REPLACES, AND WHY ───────────────────────────────────────────
 *
 * `ExampleCloset` drew an illustrated example grid: ghost tiles standing in for
 * garments the user does not own. C-05 refuses exactly that, twice over —
 * "never illustrated — no empty hangers, no dashed placeholder grid, no
 * exclamation" — and its reason is the one worth keeping: a grid of things that
 * are not yours is a promise the screen cannot keep, and it teaches a reader to
 * discount the grid they will later be shown.
 *
 * So the frame draws one card instead: what the closet needs, why, and the
 * single door in.
 *
 * ── THE THREE ANNOTATIONS ─────────────────────────────────────────────────
 *
 * · "Approved positioning line" — audit 100 sweeps this surface, and the line
 *   appears VERBATIM. It is a constant rather than a sentence typed here, so a
 *   later edit to the paragraph cannot quietly reword it.
 * · "Zero is quiet" — the count is stated once, in the same 13pt line that
 *   would carry 148, and nowhere else on the frame. The filter row is absent
 *   rather than present-and-disabled; a row of chips reading zero teaches
 *   nothing. That absence is the caller's, and `(tabs)/closet.tsx` honours it.
 * · "Oxblood spent here" — one accent on the frame, on the one action.
 */

/**
 * The approved positioning line, exact to the letter.
 *
 * Audit 100's acceptance is "the approved positioning line appears on the empty
 * closet" and "no absolute about shopping appears anywhere in the group". Held
 * as a constant so `tests/w3-g3-intake-copy.test.ts` can check the surface for
 * the sentence rather than for a paraphrase of it.
 */
export const POSITIONING_LINE =
  'Your closet first. Shop only when something is genuinely missing.';

/** The rest of the paragraph — what the two doors are, in the frame's words. */
const DOORS_LINE =
  'Start with the pieces you reach for most. Photograph them, choose a saved image, describe them, or search the catalogue — every route builds the same closet.';

export function EmptyCloset({ onAddClothes }: { onAddClothes: () => void }) {
  const theme = useTheme();

  return (
    // `justify-center` on a flex-1 parent: the frame floats the card in the
    // space between the title block and the tab bar rather than pinning it
    // under the title, so an empty closet does not read as a page that failed
    // to load its top.
    <View className="flex-1 justify-center px-gutter">
      <View className="rounded-plate border border-hairline bg-surface px-5 py-6">
        {/* 30px, between `display` (40) and `title` (28). Inline, never a second
            `text-*` class — NativeWind gives no precedence between two size
            utilities on one element. */}
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 34 }}>
          {`Start with ${numberWord(PLANS.free.items)} pieces that feel like you.`}
        </Text>

        {/* 16px prose in the regular cut. `note` is 13; the frame sets this one
            a step up because it is the paragraph the whole screen is, not a
            footnote under something else. */}
        <Text variant="note" className="mt-4" style={{ fontSize: 16, lineHeight: 25 }}>
          {`${POSITIONING_LINE} ${DOORS_LINE}`}
        </Text>

        {/* The frame's one filled action. Hand-built rather than `Button`
            because the frame sets it at 48pt with a 16pt Medium label, and the
            shared primary is neither — and because the accent belongs to this
            control alone on this frame. r12: a labelled control is 12, never a
            capsule. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add clothes"
          accessibilityHint="Opens the four ways to file a piece"
          onPress={onAddClothes}
          style={{ minHeight: 48, backgroundColor: theme.accent }}
          className="mt-6 items-center justify-center rounded-md active:opacity-80">
          {/* Inline colour, not `text-canvas`: two colour utilities on one
              element resolve by their order in the generated stylesheet, so the
              class would lose to the variant's own `text-*` and the label would
              vanish into the fill. */}
          <Text
            variant="body"
            style={{ fontSize: 16, color: theme.canvas }}>
            Add clothes
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
