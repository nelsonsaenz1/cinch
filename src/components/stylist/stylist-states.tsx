import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';
import { CircledExclamationGlyph } from '@/features/explore/glyphs';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { useTheme } from '@/theme/tokens';

/**
 * The Stylist page's two full-page states, drawn the way the Stylist atlas
 * draws them — which is NOT the way the shared states kit draws everything else.
 *
 * The kit at `@/components/ui/empty-state` and `@/components/ui/error-state` is
 * the house grammar: hard-left on the gutter, a 22pt SF Symbol in `muted` or
 * `warning`, one serif line, body, and a full-bleed action. `EmptyState`'s
 * docblock is emphatic that the centred-composition alternative is a named
 * AI-slop tell the design brief exists to escape, and `ErrorState` argues that a
 * retry is bordered at every size so a recovery step never spends the screen's
 * one accent action. Both arguments are correct — for the eleven screens that
 * share that grammar.
 *
 * The Stylist atlas overrides them for this page and only this page. S-09
 * ("Closet too small to style") and S-10 ("Closet didn't load") are both drawn
 * as a centred column inside the sheet: a 34pt OUTLINE glyph stroked in oxblood,
 * a centred serif line, centred body, and a width-hugging ink-filled button. The
 * override reads as deliberate rather than sloppy because of where it sits — not
 * on the page, but inside the stylist sheet, under a header that has just
 * promised "Only your clothes — nothing invented". The composition is the page's
 * whole content at that moment, so it takes the middle of the sheet the way the
 * conversation would have.
 *
 * These therefore live HERE, Stylist-local, and not in the kit:
 *
 *   - The kit must not change. Eleven other screens read as one app because they
 *     share its left-aligned grammar; widening it to take a `centred` flag is
 *     how that grammar becomes optional, and an optional grammar is no grammar.
 *   - These must not be copied outward. If a second page wants a centred state,
 *     that is a question for its own atlas, not a licence to import from here.
 *
 * So: do not "fix" these back into `EmptyState`/`ErrorState`, and do not lift
 * them into `ui/`. If the Stylist atlas ever redraws these frames left-aligned,
 * delete this file and call the kit — that is the correct end state, reached by
 * the atlas changing, not by a tidying pass.
 *
 * What the atlas does NOT override, it inherits. The retry's "Trying…" label and
 * its disabled-while-in-flight behaviour come straight from `ErrorState`; the
 * atlas draws a single resting frame and is silent on the in-flight one, and
 * silence is not contradiction.
 */

// ── Atlas geometry ──────────────────────────────────────────────────────────
// Read out of the S-09/S-10 frames rather than eyeballed, and kept as named
// constants because the two states must stay identical to each other: the only
// thing that may differ between an absence and a failure is what is said, never
// how it is set. None of these are tokens — `px-gutter` is 20 and the two
// vertical gaps fall between spacing steps — so they are local literals for the
// same reason the bubble radii in message-bubble.tsx are.

/**
 * `padding:0 42px`. Twice the gutter and a bit: a centred measure wants to be
 * narrower than a left-aligned one, or the eye loses the start of each line.
 */
const FRAME_PADDING_X = 42;
/**
 * 34px. The kit's glyph is 22 because it sits above left-aligned text as a
 * marker; this one is the top of a centred composition and carries more.
 */
const GLYPH_SIZE = 34;
/**
 * The atlas strokes every outline mark at 1.4, the same weight as the Lately
 * glyphs — thin enough to read as a drawn line rather than an icon font.
 */
const GLYPH_STROKE = 1.4;
/** `margin-top:18px` under the glyph. */
const TITLE_GAP = 18;
/**
 * `margin-top:10px` under the title — tighter than the kit's 16, because a
 * centred title and its body read as one block rather than two.
 */
const BODY_GAP = 10;
// The atlas's fourth gap — `margin-top:20px` above the action — is not a
// constant here: `Button` omits `style` from its props, so it is spelled `mt-5`
// at the call site below. See the comment there.

/**
 * S-09's mark: a pair of speech bubbles, the second overlapping the first.
 *
 * Traced from the atlas SVG stroke for stroke, on its own 24-unit grid (S-10's
 * circled exclamation is drawn on 22 — they are two drawings, not one family, so
 * the viewBoxes are not reconciled). Round joins, because both paths turn
 * corners; S-10's glyph wants round *caps* instead, since its strokes are open.
 *
 * Not an SF Symbol. `bubble.left.and.bubble.right` is the closest system mark
 * and is filled at these sizes, which would read as a solid oxblood blob where
 * the atlas draws a line — and would sit beside S-10's outline mark as a
 * mismatched pair. Since `react-native-svg` is already a dependency (15.15.4,
 * used by features/explore/glyphs.tsx and the avatar crop sheet), drawing the
 * atlas path costs nothing and matches exactly.
 */
function SpeechBubblePairGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 5.5h12v8H8l-5 4z" stroke={color} strokeWidth={GLYPH_STROKE} strokeLinejoin="round" />
      <Path d="M9 16.5h7l5 4v-4" stroke={color} strokeWidth={GLYPH_STROKE} strokeLinejoin="round" />
    </Svg>
  );
}

type AtlasStateProps = {
  glyph: ReactNode;
  title: string;
  body: string;
  actionTitle: string;
  onAction: () => void;
  actionDisabled?: boolean;
  /**
   * `summary` for an absence, `alert` for a failure — the same distinction the
   * shared kit draws between `EmptyState` and `ErrorState`, and it survives the
   * atlas's visual override because it is not a visual decision. A state that
   * appears after a wait, where the user expected an answer, should be
   * announced; a state that was simply always true of a nine-item closet should
   * be findable by swiping to it and nothing louder.
   */
  role: 'summary' | 'alert';
};

/**
 * The composition both frames share. Private on purpose: exporting it would
 * invite exactly the outward copying the file docblock rules out.
 */
function AtlasState({
  glyph,
  title,
  body,
  actionTitle,
  onAction,
  actionDisabled = false,
  role,
}: AtlasStateProps) {
  const theme = useTheme();

  return (
    /**
     * Directive #35. The composition is unchanged — centred column, same four
     * gaps — but the box it centres in is a scroll now. `flex-1 items-center
     * justify-center` on a View overflows at both ends once its content is
     * taller than the screen, and at the accessibility sizes both of these
     * frames are: a serif title, a three-line body at 1.8x and a 44 pt button
     * come to more than an iPhone SE holds, and the button was the half that
     * went under the tab bar. `flexGrow: 1` keeps the centring while it fits
     * and scrolls when it does not; `paddingBottom` is the tab bar's 96, which
     * this screen owes because it is a tab and `Composer` is not on these
     * branches to hold the space.
     */
    <ScrollView
      accessibilityRole={role}
      className="flex-1"
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: FRAME_PADDING_X,
        paddingTop: 24,
        paddingBottom: 96,
      }}>
      {glyph}

      {/* The title's own box is wrapped rather than given a margin directly,
          because `trim` collapses that box to the cap height with negative
          margins — a `marginTop` on the same element would be fighting them.
          Same construction as the shared kit, for the same reason. */}
      <View style={{ marginTop: TITLE_GAP }}>
        <Text variant="title" trim style={{ textAlign: 'center' }}>
          {title}
        </Text>
      </View>

      <Text
        // `callout` is 16px. The atlas's 15px is a web value with no step on the
        // native scale (the neighbours are `body` 17 and `label` 13), and 16 is
        // the nearest one; a 15px variant invented for two frames would be a new
        // size in the type scale forever. The line height rides along with the
        // variant — never hand-write one over these, per text.tsx.
        variant="callout"
        // Colour and alignment inline, not as `text-muted text-center` classes:
        // the `callout` variant already carries `text-ink`, and NativeWind gives
        // no guaranteed precedence between two `text-*` colour utilities on one
        // element. That exact collision shipped every primary button ink-on-
        // oxblood once already (see button.tsx). An inline style always wins.
        style={{ marginTop: BODY_GAP, color: theme.muted, textAlign: 'center' }}>
        {body}
      </Text>

      <Button
        title={actionTitle}
        onPress={onAction}
        disabled={actionDisabled}
        haptic
        // `ink`, per the atlas's `background:#1C1A16` — and it is the right call
        // for the reason the kit already states: an ink fill is the atlases'
        // workhorse action, so the page keeps its one oxblood commitment in
        // reserve. Note this makes S-10's retry LOUDER than the shared
        // `ErrorState`'s bordered one; that is the atlas's call, and it holds
        // because a stylist that cannot read the closet has nothing else on
        // screen for the retry to compete with.
        variant="ink"
        // `self-center` is what makes the button hug its label instead of
        // stretching: the kit's full-page states pass `self-stretch`, and inside
        // an `items-center` column a Button with neither would hug anyway — it
        // is written out so the intent is not an accident of the parent.
        // `Button` already carries `px-5` (the atlas's `padding:0 20px`) and a
        // 44pt `minHeight` (the atlas's `height:44px`), so neither is repeated.
        //
        // `mt-5` is 20px on NativeWind's 16px rem — the atlas's
        // `margin-top:20px` exactly, and the only one of this file's four gaps
        // that lands on a scale step, which is why the other three are inline
        // numbers above. It is a class rather than a style because `ButtonProps`
        // omits `style` outright, to keep the paint under the component.
        //
        // One accepted deviation: the atlas draws `border-radius:10px` and the
        // button paints `rounded-md` (12). The fill is drawn on a Reanimated
        // layer that NativeWind cannot style, so 10 is unreachable without
        // editing button.tsx — and tailwind.config.js is explicit that a control
        // carrying a text label is `md`, full stop. Two points of curvature is a
        // cheaper loss than either a second radius vocabulary or a hand-rolled
        // button that would have to re-implement the press compression, the
        // haptic, and the label-colour fix.
        className="mt-5 self-center"
      />
    </ScrollView>
  );
}

/**
 * S-09 — the closet is too small to style. Trigger: `!canGenerate(items)`.
 *
 * Not an error and not an empty closet: there are pieces, just not enough of
 * them to answer honestly with. The copy leads with what the stylist is FOR
 * rather than with the shortfall, because the header directly above has just
 * promised clothes you actually own — and inventing a coat to fill the gap would
 * break that promise far worse than asking for ten pieces first does.
 */
export function ClosetTooSmall({ onAddClothes }: { onAddClothes: () => void }) {
  const theme = useTheme();

  return (
    <AtlasState
      role="summary"
      glyph={<SpeechBubblePairGlyph size={GLYPH_SIZE} color={theme.accent} />}
      title="Ask for anything"
      // The ask is `PLANS.free.items`, spelled by the Reveal's `numberWord`
      // rather than typed as a word (positioning-contract.md §7). It is NOT
      // `MIN_CLOSET_FOR_OUTFITS`, the eight that actually trips this state:
      // `tour-copy.ts:17-28` settles that eight is the engine's internal floor
      // and is never printed, while ten is the number the user has already met
      // in the tour and in The Ten. Two numbers for "enough clothes" is how a
      // user learns the app cannot count. "About" carries the rest — the real
      // gate is a shape (a top and a bottom, or a dress), not a total.
      body={`Dinner at 7 and drinks after? A trip to pack for? Add about ${numberWord(PLANS.free.items)} pieces first — the stylist only ever answers with clothes you actually own.`}
      actionTitle="Add clothes"
      onAction={onAddClothes}
    />
  );
}

/**
 * S-10 — the closet read failed. Trigger: `wardrobe.isError`.
 *
 * This branch exists to keep the page from falling through to `ClosetTooSmall`,
 * which would tell someone with a full wardrobe to go photograph it again — the
 * app asserting something false about her data, which is the whole reason
 * `ErrorState` was added to the kit. So the copy claims nothing about the closet
 * except that it was not read: it says the clothes have not changed, and offers
 * the read again.
 *
 * `retrying` drives the label and the disabled state rather than swapping the
 * button for a spinner, so the frame stays put and the promise stays legible —
 * the established grammar from `ErrorState`, which the atlas does not
 * contradict.
 */
export function ClosetDidntLoad({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  const theme = useTheme();

  return (
    <AtlasState
      role="alert"
      // Reused rather than re-traced: the atlas's S-10 mark is stroke for stroke
      // the circled exclamation already drawn for the Lately empty — same
      // 22-unit grid, same r=8 circle, same two strokes, same 1.4 weight. Two
      // copies of one drawing is how two screens' identical marks quietly drift
      // apart. The module is a leaf: pure SVG, no feature state, no cycle back.
      glyph={
        <CircledExclamationGlyph size={GLYPH_SIZE} color={theme.accent} strokeWidth={GLYPH_STROKE} />
      }
      title="Your closet didn’t load."
      body="The stylist only answers with clothes you actually own, so it needs to read them first. Your closet hasn’t changed — this is a connection problem."
      actionTitle={retrying ? 'Trying…' : 'Try again'}
      onAction={onRetry}
      actionDisabled={retrying}
    />
  );
}
