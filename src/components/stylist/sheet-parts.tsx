import { SymbolView } from 'expo-symbols';
import type { RefObject } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The Stylist sheet's presentational parts, owned in one place.
 *
 * WHY THIS FILE EXISTS. The pieces of the Stylist sheet — the header, the
 * opening composition and its loading skeleton, the opening door, the answer
 * chip and the grid it wraps in, the questionnaire step's footer and the
 * composer — used to be private functions and inline markup inside
 * `src/app/stylist.tsx`. The fixture at `src/app/dev-stylist.tsx`, whose entire
 * job is previewing this sheet state by state on a simulator, could not import
 * them, so it kept hand copies under a comment asking the next person to "keep
 * the two in step by hand". The two sets drifted apart twice. The second time,
 * the fixture was previewing a pre-alignment version of the screen — a
 * design-verification tool showing something the app does not draw, which is
 * worse than having no fixture at all, because it invites a reviewer to sign
 * off on a frame nobody ships. A comment asking for discipline had two chances
 * and failed both. So the pieces live here once, and `stylist.tsx` and
 * `dev-stylist.tsx` both import them. There is no longer a copy to keep in
 * step.
 *
 * WHAT COUNTS AS A PIECE. Anything both files were drawing by hand, not just
 * anything reusable-looking. The opening block, the S-08 skeleton and the
 * answer grid's wrapper were lifted here in the same pass as the original five
 * for exactly that reason: each of the three had ALREADY drifted (the fixture's
 * skeleton and opening were on `pt-6`/`mt-4`/`mt-7`/`mt-5` where the screen was
 * on the atlas's 26/8/14/12), so leaving them behind would have left the drift
 * that motivated this file open in three places.
 *
 * WHAT MAY LIVE HERE. Presentational parts only: props in, callbacks out. No
 * hook that touches data, network, navigation or a session — the fixture
 * renders signed out, and any such hook here would put it straight back to
 * copying. `useTheme()` is fine; it reads a colour table, nothing more.
 *
 * HOW CALLBACKS BEHAVE, since the two call sites want different things from
 * them. There are two rules, and every prop below follows one of them:
 *
 *   - A callback that GATES an affordance (`onNewQuestion`, `onBack`) draws
 *     that affordance when present and omits it when absent. That is the real
 * screen's own semantics — "New question" is reachable only once there is a
 *     thread to leave, **Back** only once there is a step behind — and it lets
 *     the fixture draw either frame by passing a no-op or nothing at all.
 *   - A callback on an ALWAYS-DRAWN control (`onPress`, `onType`, `onSend`) is
 *     optional and simply does nothing when absent. That is how the fixture
 *     gets an inert sheet without a second set of components: the rows still
 *     press and dim, the composer still takes text and repaints its send
 *     button, and nothing is sent anywhere.
 *
 * ATLAS. Geometry and colour here are read off "Stylist State Atlas.dc.html",
 * frames S-01 (opening, doors, resting composer), S-02 and S-03 (question,
 * answers, step footer), S-05 (header with "New question") and S-08 (the
 * wardrobe-reading skeleton). Every literal below names the frame it came from.
 */

// ── Atlas geometry ──────────────────────────────────────────────────────────

/**
 * The corner on both tappable rows — the four opening doors and the
 * questionnaire's answers.
 *
 * The atlas draws both at `border-radius:10px` (S-01's doors, S-02/S-03's
 * answers), and draws them identically, which is the point: an answer is the
 * same kind of object as a door, one step further in.
 *
 * WAS 10, page-local, on the ground that "one screen's pair of rows does not
 * justify minting a radius the rest of the app would then have to have an
 * opinion about". Reference board C settles it the other way: the app now has
 * exactly one opinion — flat band, `md`, `plate`, `sheet` — and page-local
 * geometry is the thing it removes. 12 is the nearest step and the one every
 * other row-shaped container in the app already carries.
 *
 * The 18/4 bubble corners in message-bubble.tsx did NOT move with this. A
 * bubble is a speech shape rather than a container, the directive's stylist
 * pass (§3.8) names the input, the send glyph and the sparkle but not the
 * bubbles, and that file argues its own case in writing — so it is recorded as
 * an open conflict in docs/design/refacing/AC-HANDOVER.md, not overridden here.
 */
const ROW_RADIUS = 12;

/**
 * The step footer's own offset above itself — 18, the atlas's value in S-02 and
 * S-03. A wider break than the 12 between the question and its answers, so the
 * progress line reads as chrome under the step rather than as a fifth option in
 * it. No spacing token lands on 18, hence a number.
 *
 * It belongs to the footer rather than to the caller because that is exactly
 * where it drifted: the screen set 18 and the fixture's copy set `mt-4` (16),
 * so the one frame a reviewer was meant to check the spacing on was the frame
 * with the wrong spacing. A part that owns its own atlas offset cannot be
 * mis-set by a call site.
 */
const FOOTER_GAP = 18;

// ── The tappable row ────────────────────────────────────────────────────────

/**
 * The one row drawing behind both `StartRow` and `AnswerChip`.
 *
 * The two used to be separate function bodies sharing only `ROW_RADIUS`, on the
 * stated ground that "the two rows must stay identical to each other: if they
 * ever diverge it should be a decision, not a missed edit". They had diverged
 * by a missed edit: the door carried `py-3`, so with `body`'s computed line
 * height of 26 it rendered 12 + 26 + 12 = 50 and its `minHeight: 44` never
 * bound, while the answer — with no vertical padding — landed on exactly the 44
 * the atlas draws (S-01 lines 60-63: `min-height:44px; padding:10px 16px`; the
 * web box's 10 is absorbed by the taller native line box). Deleting the `py-3`
 * restores the atlas height AND the stated invariant, and with the two now
 * byte-identical, sharing a constant is no longer enough to hold them together
 * — they share the drawing instead. Splitting them again is then an edit
 * someone has to make on purpose, which is what the invariant asked for.
 *
 * Not the shared `Chip`, for the reason the answers have always given: `Chip`
 * buys its 44pt target with `hitSlop`, which is right for a single row of
 * filters and wrong here, where answers wrap onto two or three lines and
 * neighbouring slop regions would overlap into each other. This is 44pt of real
 * geometry, so a wrapped grid of these stays honest about what was tapped.
 *
 * Width comes from the parent, not from here: in the opening's column a row
 * stretches full-bleed, in the answers' `flex-wrap` row it hugs its label.
 */
function TappableRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: MIN_TAP_TARGET, borderRadius: ROW_RADIUS }}
      className="justify-center border border-rule px-4 active:opacity-60">
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/**
 * A full-width opening door — one of S-01's four quick starts. Wider than an
 * answer because it is a decision, though only by the column it sits in: the
 * drawing is the same, deliberately.
 */
export function StartRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return <TappableRow label={label} onPress={onPress} />;
}

/** A tappable answer to a questionnaire step — S-02 and S-03's option rows. */
export function AnswerChip({ label, onPress }: { label: string; onPress?: () => void }) {
  return <TappableRow label={label} onPress={onPress} />;
}

/**
 * A step's answers, in the wrapping row the atlas draws them in.
 *
 * The wrapper is the part, not just the chips inside it, because the wrapper is
 * where the atlas's spacing lives and where both files were writing that
 * spacing out by hand: `mt-3 flex-row flex-wrap gap-2 px-gutter`. The `mt-3` is
 * 12, the atlas's `margin-top:12px` above this row in S-02 and S-03, and it is
 * the whole reason this is a component rather than a `.map()` at each call
 * site — that 12 is half of a two-part measurement, and the other half is a
 * `flush` on the question bubble above (see message-bubble.tsx's prop note:
 * React Native has no margin collapsing, so a bubble that keeps its own 16pt
 * bottom margin turns this 12 into 28). Two numbers that only add up when set
 * together must not be settable apart, in two files.
 *
 * `gap-2` is the atlas's 8 between chips, in both axes, which is what makes a
 * grid that wraps to two or three lines read as one block of options.
 *
 * Generic in the option key so a caller with a real union — the screen's
 * `QuestionOption` — keeps it end to end, while the fixture can hand over plain
 * strings without either side reaching for a cast.
 */
export function AnswerGrid<K extends string>({
  options,
  onAnswer,
}: {
  options: readonly { key: K; label: string }[];
  /** Absent on the fixture: the chips still press and dim, and answer nothing. */
  onAnswer?: (key: K) => void;
}) {
  return (
    <View className="mt-3 flex-row flex-wrap gap-2 px-gutter">
      {options.map((option) => (
        <AnswerChip
          key={option.key}
          label={option.label}
          onPress={onAnswer ? () => onAnswer(option.key) : undefined}
        />
      ))}
    </View>
  );
}

// ── The opening ─────────────────────────────────────────────────────────────

/**
 * S-01's opening composition: the salutation, the line under it, the four
 * doors, and the closing caption that points at the composer.
 *
 * ITS RHYTHM IS THE POINT. S-01's message area is `padding:16px 20px 0`, and
 * the rhythm under it is 8 to the subline, 14 to the doors, 12 to the closing
 * caption. Tighter than the 8pt scale would have guessed at every step, and
 * deliberately so: the four doors are one decision presented once, so the
 * greeting, the doors and the caption have to read as a single block rather
 * than as four stacked sections. 8 and 12 land on scale steps; 14 does not, so
 * it is inline — the same call message-bubble.tsx makes for its own 14 and 18.
 *
 * IT DOES NOT OWN ITS TOP OFFSET. The 16 belongs to the scroll container, not
 * to this View, because the transcript branch that replaces this one needs 20
 * in the same place (S-03, S-05, S-06) and the two must never add. See the
 * conditional `paddingTop` in stylist.tsx's ScrollView.
 *
 * The greeting itself is a prop rather than a `greeting()` call inside here:
 * that function reads a clock, and a part that reads a clock is a part the
 * fixture cannot pin to "Wednesday 6 August, 19:00" to reproduce the frame.
 */
export function StylistOpening<K extends string>({
  salutation,
  line,
  starts,
  onStart,
}: {
  /** "Evening" — the serif line. */
  salutation: string;
  /** The sentence under it, which already knows the hour and the forecast. */
  line: string;
  /** The four doors, in order. */
  starts: readonly { key: K; label: string }[];
  /** Absent on the fixture, which draws the doors without opening one. */
  onStart?: (key: K) => void;
}) {
  const theme = useTheme();

  return (
    <View className="px-gutter">
      <Text variant="title" trim>
        {salutation}
      </Text>
      {/* `muted` (#6B665C), S-01's colour for this line, inline rather than as
          a `text-muted` class because `variant="body"` already carries
 `text-ink`. NativeWind gives no precedence between two `text-*` colour
          utilities on one element — it breaks the tie by key order in
          tailwind.config.js's `colors`, so this line drew muted only because
 `muted` happens to be declared after `ink` there, and reordering that
          palette would silently have repainted it. Same collision that shipped
          every primary button ink-on-oxblood once already (button.tsx).
          This is the line the rule was actually broken on: in the screen this
          block came from it read `variant="body" className="mt-2 text-muted"`,
          a dozen lines under a comment arguing at length that precisely that
          must never be written. A stacked pair that happens to look right is
          the hardest version of this bug to see, which is why it survived the
          comment. An inline style always wins. */}
      <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
        {line}
      </Text>

      <View className="gap-2" style={{ marginTop: 14 }}>
        {starts.map((start) => (
          <StartRow
            key={start.key}
            label={start.label}
            onPress={onStart ? () => onStart(start.key) : undefined}
          />
        ))}
      </View>

      <Text
        // S-01 sets this line at 13px in #8A8578 — `label`, not `caption`
        // (11px), and one step quieter than `label`'s own `muted`. `faint` is
        // right here for the reason text.tsx reserves it: the sentence restates
        // in prose what the composer directly below already offers, so it is
        // genuinely the redundant layer rather than content being whispered.
        //
        // Inline for the same precedence reason as the subline above.
        variant="note"
        className="mt-3">
        Or just say it. The stylist answers with clothes you own — and tells you plainly when
        you don&rsquo;t own the right thing.
      </Text>
    </View>
  );
}

/**
 * S-08 — the opening composition as bars, while the wardrobe is being read.
 *
 * Its geometry is read off that frame rather than off the rhythm scale:
 * `padding:26px 20px 0`, then 24×176 r12, then +18 for 14×80% r7, then +28 for
 * four 48-tall r10 bars gapped 8. Only the 20 gutter, the +28 and the gap land
 * on tokens; 26, 18, 7 and 10 have no step, so they are inline the way
 * message-bubble.tsx's bubble radii are.
 *
 * The bars must keep matching the real opening above — a skeleton whose shapes
 * differ from what replaces them makes the screen jump when the wardrobe lands,
 * which reads as a bug rather than as content arriving. That is exactly what
 * the fixture's hand copy had already lost: it sat on `pt-6`/`mt-4`/`mt-7`
 * against the screen's 26/18/28, so the one frame a reviewer was meant to check
 * the no-jump promise on was drawn from different numbers than the screen it
 * was promising about. Being one component is what makes that unsayable now.
 *
 * This one DOES own its top offset, unlike `StylistOpening`: it is never a
 * scroll container's child — the loading branch has no transcript to share a
 * padding with — so there is nothing for it to double up against.
 */
export function OpeningSkeleton() {
  return (
    <View
      accessibilityLabel="Reading your wardrobe"
      className="px-gutter"
      style={{ paddingTop: 26 }}>
      <Skeleton className="h-6 w-44 rounded-chip" />
      <Skeleton className="h-3.5 w-4/5" style={{ marginTop: 18, borderRadius: 7 }} />
      <View className="mt-7 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" style={{ borderRadius: 10 }} />
        ))}
      </View>
    </View>
  );
}

// ── The header ──────────────────────────────────────────────────────────────

/**
 * The sheet's header: a small oxblood-tinted mark, the serif name, and the
 * promise that keeps the feature trustworthy — stated plainly, every time.
 * `pt-5` clears the native sheet grabber; the hairline hands off to the
 * message list the way a card's rule hands off to its body.
 *
 * This mark is the screen's single accent. Everything below it — the opening
 * doors, the questionnaire answers — is drawn in `rule` and ink, which is what
 * lets one small red circle still read as the app's voice speaking.
 *
 * `rule` (.12), not `hairline` (.09), and the distinction is not pedantry on
 * this screen: the two tokens have different jobs here and both are in use
 * within a few points of each other. `hairline` draws the two structural
 * separators — this header's underline and the composer's top border — while
 * `rule` draws the borders of objects you can tap, the doors and the answers.
 * Swapping either way would either make the chrome compete with the content or
 * make a row look like a divider.
 */
export function StylistHeader({ onNewQuestion }: { onNewQuestion?: () => void }) {
  const theme = useTheme();

  return (
    <View className="flex-row items-center gap-3 border-b border-hairline px-gutter pb-3 pt-5">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-light">
        <SymbolView name="sparkles" size={15} tintColor={theme.accent} resizeMode="scaleAspectFit" />
      </View>
      <View className="flex-1">
        <Text variant="plate" trim accessibilityRole="header">
          Stylist
        </Text>
        <Text
          // S-01 sets this line at 12px in #8A8578. There is no 12px step on the
          // native type scale — it goes `caption` 11 → `label` 13 — so this is
          // `caption`, one pixel under the atlas, on purpose. Minting a 12px
          // variant to close a 1px gap on one line would put a new size in the
          // scale forever, which is the trade text.tsx and stylist-states.tsx
          // both decline elsewhere. Record it as a decision, not an oversight.
          variant="noteSmall"
          // The colour goes inline rather than as a `text-faint` class because
          // `caption` already carries `text-muted`, and NativeWind gives no
          // precedence between two `text-*` colour utilities on one element —
          // it resolved to #8A8578 only because `faint` happens to follow
          // `muted` in tailwind.config.js's `colors`, so reordering that palette
          // would have silently repainted this line. Same collision that shipped
          // every primary button ink-on-oxblood once already (button.tsx). An
          // inline style always wins.
          className="mt-0.5">
          Only your clothes — nothing invented
        </Text>
      </View>
      {/* Reachable only once there is a thread to leave — the designed opening
          (greeting, four doors, questionnaire) was otherwise reachable exactly
          once per account, because nothing called the chat hook's `clear()`.
          Hence the affordance being gated on the callback rather than on a
          separate flag: a screen with nowhere to go back to cannot pass one. */}
      {onNewQuestion ? (
        <Pressable
          onPress={onNewQuestion}
          accessibilityRole="button"
          accessibilityLabel="Start a new question"
          hitSlop={12}
          className="active:opacity-60">
          {/* No colour class: `label` already carries `text-muted` (#6B665C),
              which is exactly what S-05 sets this at. The `text-muted` that used
              to be repeated here was the same stacked-`text-*` pattern the
              promise line above had to be rescued from — harmless only because
              both classes named the same colour. */}
          <Text variant="label">New question</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ── The questionnaire step footer ───────────────────────────────────────────

/**
 * The step footer: position on the left, the escapes on the right.
 *
 * The one part of the flow where the atlas has something specific to say —
 * S-02 omits **Back** because there is nowhere behind the first question, and
 * S-03 shows it. Driving that off `canGoBack` rather than off which frame is
 * being drawn is what makes the two frames one component with two inputs.
 *
 * `canGoBack` stays a separate prop from `onBack` rather than being inferred
 * from it, because those are two different facts: whether there IS a step
 * behind belongs to the questionnaire, and whether pressing does anything
 * belongs to the caller. The fixture needs S-03's frame — Back drawn, pressing
 * inert — and inferring one from the other would make that unsayable.
 *
 * `eyebrow` already carries `uppercase` (text.tsx), so "1 OF 4" is drawn as the
 * atlas draws it without a second class here.
 */
export function StepFooter({
  position,
  total,
  canGoBack,
  onBack,
  onType,
}: {
  /** The 1-based step number — the "1" of the atlas's "1 of 4". */
  position: number;
  /** How many steps the flow committed to up front — the "4". */
  total: number;
  /** Whether there is a step behind this one. Draws **Back** when true. */
  canGoBack: boolean;
  onBack?: () => void;
  onType?: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="flex-row items-center justify-between px-gutter"
      style={{ marginTop: FOOTER_GAP }}>
      <Text variant="eyebrow">
        {position} of {total}
      </Text>
      <View className="flex-row items-center gap-5">
        {canGoBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to the previous question"
            hitSlop={12}>
            {/* Ink, inline. The atlas's spans for both escapes (S-02 line 105,
                S-03 line 150) are `font-size:13px;font-weight:500;text-
                decoration:underline` with NO colour, so they inherit the
 document's #1C1A16 — these are ink. `label` carries `text-muted`
                in its variant string, which drew them a step quiet, and a second
 `text-*` class cannot reliably beat the first (see the header's
                promise line). So the colour is a style. The underline is the
                only thing left for `className` here, and it is not a colour, so
                it cannot collide. */}
            <Text variant="label" className="underline" style={{ color: theme.ink }}>
              Back
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onType}
          accessibilityRole="button"
          accessibilityHint="Closes the questions and opens the keyboard"
          hitSlop={12}>
          <Text variant="label" className="underline" style={{ color: theme.ink }}>
            I&rsquo;ll just type
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── The composer ────────────────────────────────────────────────────────────

export type ComposerProps = {
  /** The draft text. Held by the caller so the screen can clear it on send. */
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Fired by the send button and by the keyboard's return key, and only when
   * there is trimmed text and `sending` is false — so a caller never has to
   * re-check what the button already checked to decide its own fill. Absent on
   * the fixture, which wants a composer that repaints but posts nothing.
   */
  onSend?: () => void;
  /** A request is in flight: the send button holds its idle fill and refuses. */
  sending?: boolean;
  /**
   * Handed through to the `TextInput`, so the screen can focus the field when
   * someone abandons the questionnaire with "I'll just type". The only reason
   * this part is not entirely self-contained, and it is a ref rather than an
   * `autoFocus` flag because the focus is an event, not a state.
   */
  inputRef?: RefObject<TextInput | null>;
};

/**
 * The composer: the field, and the send button beside it.
 *
 * Present in every atlas frame that draws the sheet's bottom bar (S-01, S-02,
 * S-03, S-05), identically, which is why it is one part rather than a per-state
 * arrangement.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  sending = false,
  inputRef,
}: ComposerProps) {
  const theme = useTheme();

  /**
   * The armed test, computed once and used for the guard, the fill and the
   * arrow's tint — three places that were previously spelled out separately and
   * are required to agree.
   *
   * The disabled rule stays as it is: S-06 draws the send button ink-active over
   * an empty composer, but that is a drafting slip in the mock rather than a
   * spec — an armed send with nothing to send is not a state this screen wants.
   */
  const canSend = value.trim().length > 0 && !sending;
  const send = () => {
    if (canSend) onSend?.();
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-hairline px-gutter pb-2 pt-3">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={send}
        // The placeholder does the job a feature tour would: it shows the
        // one question nothing else on the market can answer.
        placeholder="Ask about tonight…"
        // `faint` (#8A8578), the atlas's placeholder colour in every frame
        // that draws the composer — a step quieter than the `muted` this
        // carried. Placeholder text is the case `faint` exists for: it is
        // not content, it vacates the moment anything is typed, and holding
        // it at `muted` made an empty field look like a filled one.
        placeholderTextColor={theme.muted}
        multiline
        textAlignVertical="top"
        returnKeyType="send"
        blurOnSubmit
        accessibilityLabel="Ask the stylist"
        // The atlas pins `min-height:44px` on this field in every frame that
        // draws it. Without the floor, the height was an arithmetic accident
        // that happened to come out at 44 — `py-2.5` (10) plus `callout`'s
        // computed line height (24) plus 10 — and only at the default Dynamic
        // Type setting: a below-default accessibility text size shrinks the line
        // box and drops the field under the 44pt tap-target minimum. The repo's
        // only other composer pins it explicitly for the same reason
        // (src/app/event/[id]/comments.tsx:255-256); this follows that
        // precedent. `maxHeight` is unchanged — the field grows with a long
        // question, to a point.
        style={{ minHeight: MIN_TAP_TARGET, maxHeight: 110 }}
        // `font-body text-callout` — the same computed, floor-safe line
        // height every other field carries (src/theme/font-metrics.js).
        // The bare `text-ink` this used to carry set colour only, leaving
        // the box sized off RN's undocumented default TextInput font.
        // `rounded-md`, not `rounded-full`. §1.3 of the Refacing: `full` is a
        // circle on a 1:1 box, never a capsule on a wider-than-tall one, and a
        // text field is the widest control on the page. Named on reference
        // board C as one of the app's three known capsule violations. The send
        // button beside it keeps `full` — it IS 1:1 (44×44), so it is a disc.
        className="flex-1 rounded-md border border-rule bg-surface px-4 py-2.5 font-body text-callout text-ink"
      />
      <Pressable
        onPress={send}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
        className={`items-center justify-center rounded-full active:opacity-60 ${
          canSend ? 'bg-ink' : 'bg-tray'
        }`}>
        {/* Idle: `faint` on the tray ground, both straight from the atlas's
            resting composer. Active: canvas on ink. The idle arrow was `muted`,
            which read as an enabled control over a disabled one. */}
        <SymbolView
          name="arrow.up"
          size={17}
          tintColor={canSend ? theme.canvas : theme.faint}
          resizeMode="scaleAspectFit"
        />
      </Pressable>
    </View>
  );
}

/**
 * The transcript's own top padding, and the opening's.
 *
 * Two numbers rather than one because the atlas draws two: the message area is
 * `padding:20px 0 0` where it holds a thread (S-03, S-05, S-06) and
 * `16px 20px 0` where it holds the opening (S-01). The opening's is the tighter
 * of the two because it is the one branch whose first line is a serif title
 * rather than a filled bubble, and a title reads as belonging to the header it
 * hangs under, where a bubble has to clear it.
 *
 * They belong on the ScrollView's content container, one or the other, never
 * both — safe because the opening and the thread are mutually exclusive, and
 * the reason neither branch carries a `pt-*` of its own.
 *
 * Here rather than in either screen because both screens need them and they
 * were briefly declared twice, which is the same drift this module exists to
 * end — two numbers agreeing today with nothing to keep them agreeing.
 *
 * The mock is not self-consistent about the thread's value: S-02 and S-04 draw
 * 22 where S-03, S-05 and S-06 draw 20. 20 wins on a 3-2 count, and the two
 * frames that disagree are the two with the least content below them, which is
 * where a 2pt difference is least likely to have been measured deliberately.
 */
export const TRANSCRIPT_TOP = 20;
export const OPENING_TOP = 16;

/**
 * The three refinement chips under a settled answer.
 *
 * The labels and the sentences they send are not the same strings — "Dressier"
 * submits "A bit dressier", because the chip is a label and the message is
 * speech, and the parser downstream reads the latter. That mapping is the
 * reason this is a part rather than three `Chip`s at each call site: it is the
 * kind of detail a hand copy gets subtly wrong.
 *
 * `onRefine` receives the sentence to send, not the label. Absent, the chips
 * draw and press and say nothing, which is what the fixture wants.
 *
 * S-05 draws the row at `padding:0 20px 10px` — 10 below, so the chips sit a
 * shade clear of the composer's hairline instead of tucking under it. The chips
 * themselves stay `Chip` at its own 12pt corner: the atlas draws them as 17pt
 * capsules, and that is the one atlas value on this screen refused outright
 * rather than adapted, because tailwind.config.js reserves `full` for "CIRCLES
 * AND GLASS CHROME ONLY — never a labelled capsule", and these carry labels.
 */
const REFINEMENTS: { label: string; message: string }[] = [
  { label: 'Something warmer', message: 'Something warmer' },
  { label: 'Dressier', message: 'A bit dressier' },
  { label: 'More casual', message: 'More casual' },
];

export function RefinementRow({ onRefine }: { onRefine?: (message: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2 px-gutter pb-2.5">
      {REFINEMENTS.map((r) => (
        <Chip key={r.label} label={r.label} onPress={() => onRefine?.(r.message)} />
      ))}
    </View>
  );
}
