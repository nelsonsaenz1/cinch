import { useWindowDimensions, View } from 'react-native';

import { ReactionRow } from '@/components/daily-social/reaction-row';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Text } from '@/components/ui/text';
import { lookAccessibilityLabel, piecesLine, REACTION_LABELS } from '@/features/daily-social/copy';
import { type DailyReaction } from '@/features/daily-social/types';
import {
  headlineStacked,
  LOOK_CARD_RADIUS,
  lookHeadline,
  reactionPrivacyLine,
} from '@/features/explore/explore-spec';
import { sinceLabel } from '@/features/explore/timeline';
import { useTheme } from '@/theme/tokens';

import { LookWell, type LookWellPiece } from './look-well';
import { ReactionFailureStrip } from './reaction-failure-strip';

export type LookEntryPiece = LookWellPiece & { name: string };

export type LookEntryCardProps = {
  /**
   * Whose look this is.
   *
   * The unit is "what my FRIENDS wore", so the reader knows whose clothes they
   * are looking at — but text only, and no avatar. This surface carries no
   * photograph of a person anywhere.
   */
  ownerName: string;
  /** `outfits.name`, which may genuinely be null. */
  name: string | null;
  /** `outfits.worn_at`, an ISO instant. */
  wornAt: string;
  /**
   * The pieces that crossed. Already filtered by `friend_worn_outfit_items` —
   * see `look-well.tsx` for why this can be shorter than what was worn, and
   * why nothing anywhere says so.
   */
  pieces: readonly LookEntryPiece[];
  /** The reader's OWN reaction, or null. Never anybody else's, ever. */
  reaction: DailyReaction | null;
  onReact: (reaction: DailyReaction | null) => void;
  /** True when the last write for this look failed. Recoverable, and says so. */
  reactionFailed?: boolean;
  onRetryReaction?: () => void;
  /** Place in a finite day — spoken, never drawn. */
  position?: { index: number; total: number };
  /** Injectable clock, so the relative date is testable. */
  now?: Date;
};

/**
 * ONE FRIEND'S LOOK, PHOTO FIRST — redesign 17.
 *
 * ── WHAT CHANGED FROM THE SHIPPED CARD, AND WHY ─────────────────────────────
 *
 * The shipped `LookCard` (still in `components/daily-social/`, still what the
 * Daily Social fixture poses) leads with a tracked uppercase attribution line,
 * then the collage, then the name. Redesign 17 inverts it: the photograph is
 * the top of the card, edge to edge, and everything else is the caption under
 * it. Two consequences follow, and both are deliberate:
 *
 *   · **Attribution and name become one serif line** — "Priya wore the wool
 *     coat" — because a tracked micro-label sitting above a picture reads as a
 *     caption on nothing. See `lookHeadline`.
 *   · **The timestamp moves onto that line's baseline**, right-aligned, which
 *     is the arrangement every dated row in this app already uses.
 *
 * This is a NEW component rather than an edit of the old one on purpose. The
 * old card is a general Daily Social primitive with its own accepted geometry
 * and its own tests; this is Explore's card, at Explore's scale, and folding
 * two compositions into one component behind a `variant` prop is how both stop
 * being reviewable.
 *
 * ── WHAT IS NOT ON THIS CARD, AND WHY EACH IS A DECISION ────────────────────
 *
 * Not the **reasoning**, the **note**, the **weather or occasion**, the
 * **rating**, the **wear rating**, the **favourite**, or **cost per wear**.
 * Four columns cross the friend boundary and the omissions are the design.
 *
 * Not a **count of pieces**, drawn or spoken. Not a **count of reactions** —
 * there is none to have: reactions are visible to the look's owner only, RLS
 * shows a reactor their own row and nothing else, and the control below shows
 * the reader's own state and no one else's. Not a **badge, dot or "new"
 * mark**: nothing on this surface may look like a notification.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * The look is ONE accessible element carrying one sentence; the reaction row
 * sits OUTSIDE it as a sibling so its three controls stay individually
 * focusable — wrapping controls inside an `accessible` view is what makes them
 * unreachable on iOS.
 *
 * Nothing is a fixed height and no text is clamped. At AX-XXXL the headline
 * wraps, the timestamp drops to its own line, the three reactions stack, and
 * the card grows — which is the accepted `largest-accessibility-text` frame.
 */
export function LookEntryCard({
  ownerName,
  name,
  wornAt,
  pieces,
  reaction,
  onReact,
  reactionFailed = false,
  onRetryReaction,
  position,
  now,
}: LookEntryCardProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = headlineStacked(fontScale, AX_FONT_SCALE);

  const headline = lookHeadline(ownerName, name);
  const when = sinceLabel(wornAt, now ?? new Date());
  const worn = piecesLine(pieces.map((piece) => piece.name));

  return (
    <View
      style={{
        backgroundColor: theme.tray,
        borderRadius: LOOK_CARD_RADIUS,
        overflow: 'hidden',
      }}>
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={lookAccessibilityLabel({
          ownerName,
          name,
          wornAt,
          pieces: pieces.map((piece) => piece.name),
          position,
          now,
        })}>
        {/* Conditional on the WELL, not merely inside it: a look whose every
            piece its owner kept would otherwise leave the ground where a
            picture used to be, and a shape a reader can notice is a shape they
            can subtract from. It draws nothing, and nothing marks the absence
            — the accepted `hidden-pieces-silently-omitted` frame is a card
            that simply begins at its headline. */}
        {pieces.length > 0 ? <LookWell pieces={pieces} radius={LOOK_CARD_RADIUS} /> : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View
            style={
              stacked
                ? { gap: 4 }
                : {
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                  }
            }>
            {/* Cap-trim only while it is one line. `trim` collapses a serif
                line box with negative margins sized for SINGLE-LINE geometry;
                on a headline that wraps it pulls the continuation up under the
                picture. Same switch, same threshold, as the rest of the app. */}
            <View className={stacked ? '' : 'min-w-0 flex-1'}>
              <Text variant="plate" trim={!stacked}>
                {headline}
              </Text>
            </View>
            {when ? (
              <Text variant="note" style={{ flexShrink: 0 }}>
                {when}
              </Text>
            ) : null}
          </View>

          {/* The outfit line — what was worn, in words. It is the only readable
              account of the look: the well is hidden from VoiceOver so that no
              per-tile label can be counted off. Every name that crossed is
              printed; there is no count and no ellipsis, and a look whose
              pieces its owner all kept prints nothing here rather than a
              sentence about the silence. */}
          {worn ? (
            <Text variant="note" style={{ marginTop: 6 }}>
              {worn}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
        <ReactionRow
          reaction={reaction}
          onReact={onReact}
          lookName={name}
          ownerName={ownerName}
        />

        {/* THE AUDIENCE, IN WORDS, UNDER THE CONTROL THAT NEEDS IT.
            One person can see this, and they are named. No count sits here and
            none can: there is nothing to aggregate. Once a chip is chosen the
            line becomes the way back out, because the press is reversible and
            a reader who tapped the wrong one should not have to guess.

            Hidden from VoiceOver: `REACTION_HINT` already says both facts on
            each control, and a reader who has the hint should not hear the
            same promise a second time from a line beneath it. */}
        {reactionFailed ? null : (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            variant="noteSmall"
            style={{ marginTop: 10 }}>
            {reactionPrivacyLine(ownerName, reaction ? REACTION_LABELS[reaction] : null)}
          </Text>
        )}

        {reactionFailed && onRetryReaction ? (
          <View style={{ marginTop: 10 }}>
            <ReactionFailureStrip onRetry={onRetryReaction} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
