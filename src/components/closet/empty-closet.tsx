import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';
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

/** CX-03's title. */
export const EMPTY_TITLE = 'Start your closet';

/** CX-03's action. Named for the first photograph, not for the chooser. */
export const EMPTY_ACTION = 'Add your first piece';

/**
 * CX-03's body — NO LONGER RENDERED, and deliberately still here.
 *
 * The card drew this sentence, the count line at the top of `(tabs)/closet.tsx`
 * and the example card's heading, all stating the same ten. The mark row below
 * says it once, as a shape, and the sentence's job is done — but the wording is
 * still the approved one, so it stays exported for the fixtures and tests that
 * quote it rather than being reworded out of existence.
 *
 * `PLANS.free.items` rather than a typed "10": every other statement of the
 * free closet reads from that constant, and a sentence that disagrees with the
 * ceiling it quotes is the bug this codebase keeps closing. At today's value it
 * reads exactly as the correction writes it.
 */
export const emptyClosetBody = (): string =>
  `Add ${PLANS.free.items} pieces and Cinch can start building outfits from what you own.`;

export type EmptyClosetProps = {
  onAddClothes: () => void;
  /**
   * How the card sits in the page.
   *
   * `centred` is C-05's original: the card floats in the space between the
   * title block and the tab bar, because it WAS the page and pinning it under
   * the title made an empty closet read as one that failed to load its top.
   *
   * `stacked` is CI-01, where that reasoning no longer holds — the card is the
   * third block under a profile and an example closet, and a `flex-1` child
   * inside the scroll view would absorb the leftover height and push the
   * starter card an unpredictable distance below the example it is supposed to
   * sit 26pt beneath.
   */
  flow?: 'centred' | 'stacked';
};

export function EmptyCloset({ onAddClothes, flow = 'centred' }: EmptyClosetProps) {
  const theme = useTheme();

  return (
    <View className={flow === 'stacked' ? 'px-gutter' : 'flex-1 justify-center px-gutter'}>
      <View className="rounded-plate border border-hairline bg-surface px-5 py-6">
        {/* 30px, between `display` (40) and `title` (28). Inline, never a second
            `text-*` class — NativeWind gives no precedence between two size
            utilities on one element. */}
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 34 }}>
          {EMPTY_TITLE}
        </Text>

        {/* The paragraph, drawn instead of written.
            `Add 10 pieces and Cinch can start building outfits…` was a sentence
            doing a gauge's work, on the one screen that already states the same
            ten twice above it. Ten cells, none filled, read the ceiling at a
            glance and re-read as progress on the next visit — no new component,
            no second number. `sand` is the track colour the app already uses
            for a mark that sits back from its ground.
            One node, not ten: read cell by cell VoiceOver announces nothing at
            all, so the row carries the sentence's fact as its label. */}
        <View
          className="mt-4 flex-row gap-1"
          accessible
          accessibilityRole="text"
          accessibilityLabel={`0 of ${PLANS.free.items} pieces filed`}>
          {Array.from({ length: PLANS.free.items }, (_, i) => (
            <View key={i} className="h-1.5 flex-1 rounded-xs bg-sand" />
          ))}
        </View>

        {/* Audit 100's approved positioning line, kept and moved rather than
            dropped: CX-03 fixes the paragraph above word for word, so the line
            that has to appear verbatim on this surface needs its own row. The
            route list that used to trail it is gone — the chooser one tap away
            now explains the four ways in, and explaining them twice was how
            this card grew to five sentences. */}
        <Text variant="noteSmall" className="mt-3">
          {POSITIONING_LINE}
        </Text>

        {/* The frame's one filled action. Hand-built rather than `Button`
            because the frame sets it at 48pt with a 16pt Medium label, and the
            shared primary is neither — and because the accent belongs to this
            control alone on this frame. r12: a labelled control is 12, never a
            capsule. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={EMPTY_ACTION}
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
            {EMPTY_ACTION}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
