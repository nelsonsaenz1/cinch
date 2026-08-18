import { View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import {
  CAUGHT_UP_ACCESSIBILITY_LABEL,
  CAUGHT_UP_LINE,
  NOBODY_SHARING,
  OFFLINE,
  QUIET_DAY,
  quietDayCoverage,
} from '@/features/daily-social/copy';
import { useTheme } from '@/theme/tokens';

/**
 * FOUR OF THE SIX STATES, DRAWN — DS-01b, DS-02, DS-04, DS-05.
 *
 * S-3, the day itself, is `look-card.tsx` in a list; it is the only one with
 * content, and the one these exist to be distinguishable from.
 *
 * ── AND S-1a IS DRAWN BY THE PAGE, NOT BY THIS FILE ─────────────────────────
 *
 * A reader with no circle already meets Explore's own empty hero: an
 * invitation, no stranger suggestions, "Find a friend" as the way out
 * (`src/app/(tabs)/explore.tsx`). That is precisely what §4 asks DS-01a to be,
 * and it shipped before this unit existed. A second no-circle screen would put
 * two of them on one page, so the day begins where a circle does and this file
 * draws four states rather than five. `resolveDailyState` still returns
 * `no_circle` — the model is the contract's; only the drawing is delegated.
 *
 * Every one of these is presentational: props in, no query, no navigation, no
 * mutation. The actions are callbacks the integration owner wires.
 *
 * ── ONE NEW COMPOSITION, AND IT IS THE QUIET DAY ────────────────────────────
 *
 * Three of the four are the shared kit unchanged: `EmptyState` and
 * `ErrorState`, so DS-01b and DS-05 inherit the claims discipline those two
 * components hold — an empty state describes the data, an error state refuses
 * to. That discipline is the whole reason the kit exists and re-drawing these
 * by hand would be how a failed read comes to be dressed as an empty circle
 * again.
 *
 * `QuietDayState` is the exception and is argued below.
 *
 * ── NOTHING HERE IS A FIXED HEIGHT ──────────────────────────────────────────
 *
 * Every one of these must survive AX-XXXL with no clipped meaning. There are no
 * heights, no `numberOfLines` and no capped containers in this file; the
 * compositions grow and the page scrolls, which is the only answer the
 * accessibility contract permits.
 */

// ---------------------------------------------------------------------------
// S-1b · DS-01b — mutuals exist, nobody has turned sharing on
// ---------------------------------------------------------------------------

/**
 * The state most people meet on day one, and the only one whose action is
 * about the reader.
 *
 * `onOpenSharing` opens DS-07, the reader's own sharing switch — NOT people
 * search. More friends who are also not sharing changes nothing about this
 * page, and offering "find more friends" here would be answering a question
 * nobody asked while leaving the real one standing.
 */
export function NobodySharingState({ onOpenSharing }: { onOpenSharing: () => void }) {
  return (
    <View className="flex-1">
      <EmptyState
        symbol={NOBODY_SHARING.symbol}
        title={NOBODY_SHARING.title}
        body={NOBODY_SHARING.body}
        actionTitle={NOBODY_SHARING.action}
        onAction={onOpenSharing}
      />

      {/* THE NON-RETROACTIVE PROMISE, UNDER THE BUTTON THAT ACTS ON IT.
          Redesign 17 moved it out of the body and into its own quiet line,
          which is where the accepted frame puts it and where a person actually
          reads it: on the way to the control, not three clauses back. It is
          not decoration — someone turning sharing on here is making a decision
          about their own history, and `worn_outfits_shared_since` is the
          column that keeps this sentence true. */}
      <Text variant="note" className="mt-4 px-gutter">
        {NOBODY_SHARING.note}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// S-2 · DS-02 — a quiet day
// ---------------------------------------------------------------------------

/**
 * NOT AN EMPTY STATE, AND THAT IS THE WHOLE POINT — the justification this
 * lane owes for the one composition it does not take from the kit.
 *
 * `EmptyState` was the obvious reach and is wrong here, on its own terms. Its
 * docblock says it "makes a claim about the data: there is nothing here", and
 * it draws that claim with a glyph, a serif headline and a way forward — the
 * grammar of a page that is missing something. A quiet day is not missing
 * anything. Everything worked, everybody who shares is sharing, and nobody wore
 * something new. §4 says so in as many words: "Not an error, not empty-styled."
 * Rendering it through `EmptyState` would put a symbol of absence and a
 * corrective action on a page whose only honest message is that today was
 * quiet, and the reader would go looking for what they had done wrong.
 *
 * So it is the kit's parts without the kit's grammar: the same gutter, the same
 * serif step, the same `muted` body, no glyph, and no action — because there is
 * no action. Where a glyph would go, the atlas puts a 28pt rule: it opens the
 * statement without claiming anything, which is more than a hanger or a cloud
 * can manage. Under the statement sit the two things §4 requires, "the
 * caught-up line, and the date it covers". The date is what stops a second read
 * of the same quiet day being indistinguishable from a page that never loaded.
 */
export function QuietDayState({ now }: { now?: Date }) {
  return (
    <View className="flex-1 justify-center px-gutter" accessibilityRole="summary">
      {/* THE MARK THE ATLAS OPENS DS-02 WITH — a 28pt rule above the sentence
          rather than a glyph in front of it.

          It is doing the job an empty state's symbol would do, and doing it
          without making a claim: a hanger, a cloud or a circled anything would
          say something went missing. A short printed rule says only that a
          statement begins here, which is the most a quiet day has to announce.
          Above the heading, where the atlas puts it, and not between the
          statement and its closure, where the previous full-width rule made a
          separation the frame does not have. */}
      <View className="w-7">
        <Rule />
      </View>

      {/* The margin rides a wrapper, not the trimmed heading: `trim` sets a
          negative `marginTop` as an INLINE style, and an inline style beats a
          NativeWind class — an `mt-*` here is silently discarded. Same trap
          `explore.tsx` documents under its masthead. */}
      <View className="mt-4">
        <Text variant="title" trim>
          {QUIET_DAY.title}
        </Text>
      </View>

      <Text variant="body" className="mt-4 text-muted">
        {QUIET_DAY.body}
      </Text>

      <Text variant="note" className="mt-6">
        {CAUGHT_UP_LINE}
      </Text>
      <Text variant="colophon" className="mt-1.5">
        {quietDayCoverage(now)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// S-4 · DS-04 — the end of the day
// ---------------------------------------------------------------------------

/**
 * The closure line, and nothing under it.
 *
 * Terminal by construction: there is no button here, no spinner, no sentinel
 * for an infinite scroller to trip, and no "load more". A page that never says
 * it has ended is telling the reader there is always more, which is the
 * mechanic this product rejects by name.
 *
 * `summary`, not `header` — it is a fact about the page, and it is the last
 * thing a reader swiping down should hear.
 *
 * The composition is `explore.tsx`'s own closure line, deliberately: two
 * surfaces that both end a circle should end it in the same words AND the same
 * setting, or the shared sentence stops reading as the same idea.
 */
export function CaughtUpLine() {
  const theme = useTheme();

  return (
    // `items-center` before the margin, not after: the hidden-piece scanner in
    // `daily-social-copy.test.ts` reads the rendered source for a digit followed
    // by "item", and `mt-6 items-center` is one. The rule is coarse on purpose
    // and this lane does not get to loosen it, so the class order moves instead.
    <View className="items-center mt-6" accessibilityRole="summary">
      {/* THE FULL STOP — DS-04's oxblood dot, above the line.

          The one place on this surface the accent is spent, and the reason it
          is spendable here: this mark appears once, at the end, and never
          again. A dot is not a badge and cannot be mistaken for one — it counts
          nothing, it does not appear before the reader arrives, and there is
          nothing behind it to open. It is punctuation, and the sentence it ends
          is the day.

          Hidden from VoiceOver: the line below already says the day is over,
          and a decorative mark announced beside it would be the same fact
          twice. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: theme.accent }}
      />

      <Text
        accessibilityLabel={CAUGHT_UP_ACCESSIBILITY_LABEL}
        variant="note"
        className="mt-3 text-center">
        {CAUGHT_UP_LINE}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// S-5 · DS-05 — offline or failed
// ---------------------------------------------------------------------------

/**
 * Says OFFLINE, in a word, above a sentence that refuses to describe the data.
 *
 * `ErrorState`'s `kicker` is what carries the word: caps oxblood in place of
 * the warning glyph, which is the one treatment on this surface that cannot be
 * mistaken for the quiet day's composure. Two different states, two different
 * sentences, and one of them announced — the view takes `accessibilityRole
 * ="alert"`, because a failure that appears after a wait should be announced
 * rather than merely findable by swiping to it.
 *
 * `onRetry` is required rather than optional: without it this screen is a dead
 * end, and the state the reader is in is the one where "try again" is the whole
 * remedy.
 */
export function DailyOfflineState({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <ErrorState
      kicker={OFFLINE.kicker}
      title={OFFLINE.title}
      body={OFFLINE.body}
      retryTitle={OFFLINE.action}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}
