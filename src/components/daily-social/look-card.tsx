import { useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { type DailyReaction } from '@/features/daily-social/types';
import { lookAccessibilityLabel, UNNAMED_LOOK } from '@/features/daily-social/copy';
import { sinceLabel } from '@/features/explore/timeline';

import { LookCollage, type LookCollagePiece } from './look-collage';
import { lookNameTrimmed } from './look-card-spec';
import { ReactionRow } from './reaction-row';

/** Re-exported so a call site takes one import for the card and its pieces. */
export type LookCardPiece = LookCollagePiece;

export type LookCardProps = {
  /**
   * Whose look this is.
   *
   * ── A JUDGEMENT, FLAGGED RATHER THAN SLIPPED IN ───────────────────────────
   *
   * DS-03 says a look is "the pieces, the outfit's name, and when it was worn —
   * nothing else", and that list is read here as the OUTFIT's own columns: it
   * is the refusal of `reasoning`, `note`, `context_snapshot`, `rating`,
   * `favorited_at` and cost per wear, every one of which is private taste or
   * private prose about the owner's day. It is not read as anonymity — the unit
   * is "what my FRIENDS wore", the frame is drawn as three to five friends'
   * looks, and a reaction is described as private between two people, all of
   * which presume the reader knows whose look they are looking at.
   *
   * Text only. No avatar, per the atlas's "no avatar-on-the-look" and its wider
   * refusal of any photograph of a person on this surface.
   */
  ownerName: string;
  /** `outfits.name`, which may genuinely be null. */
  name: string | null;
  /** `outfits.worn_at`, an ISO instant. */
  wornAt: string;
  /**
   * The pieces that crossed. Already filtered by `friend_worn_outfit_items` —
   * see `look-collage.tsx` for why this can be shorter than what was worn and
   * why nothing says so.
   */
  pieces: readonly LookCardPiece[];
  /** The reader's own reaction, or null. Never anybody else's, ever. */
  reaction: DailyReaction | null;
  onReact: (reaction: DailyReaction | null) => void;
  /** Injectable clock, so the relative date is testable. */
  now?: Date;
};

/**
 * ONE FRIEND'S LOOK — DS-03.
 *
 * Presentational, and the whole of it: pieces, name, when, and the three
 * reactions. It fetches nothing, signs nothing and knows about no mutation.
 *
 * ── What is not on this card, and why each one is a decision ────────────────
 *
 * Not the **reasoning** (model prose about the owner's day). Not the **note**
 * (500 characters of private diary). Not the **weather or the occasion**
 * (`context_snapshot` carries location and event titles). Not the **rating**,
 * the **wear rating** or the **favourite** — private taste, shipped
 * deliberately private on Today. Not **cost per wear**, which implies what
 * someone paid for their clothes and is the most sensitive of the closet stats.
 * Four columns cross the friend boundary and the omissions are the design.
 *
 * Not a **count of pieces**, spoken or drawn. See `look-collage.tsx`.
 *
 * Not a **badge, a dot, or a "new" marker**. Nothing on this surface may look
 * like a notification; it is opened, never pushed.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * The look itself is ONE accessible element carrying one sentence — a reader
 * swiping through an eyebrow, a serif line, a picture and a tracked date hears
 * four fragments of a fact they could have had once. The reaction row sits
 * OUTSIDE that element, as a sibling, so its three controls stay individually
 * focusable; wrapping controls inside an `accessible` view is what makes them
 * unreachable on iOS.
 *
 * Nothing here is a fixed height, and no text is clamped. At AX-XXXL the name
 * wraps, the row of reactions stacks, and the card grows.
 */
export function LookCard({
  ownerName,
  name,
  wornAt,
  pieces,
  reaction,
  onReact,
  now,
}: LookCardProps) {
  const { fontScale } = useWindowDimensions();
  const displayName = name?.trim() ? name.trim() : UNNAMED_LOOK;
  const when = sinceLabel(wornAt, now ?? new Date());

  return (
    <Card padding="md">
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={lookAccessibilityLabel({ ownerName, name, wornAt, now })}>
        <Text variant="eyebrow">{ownerName}</Text>

        {/* The serif at the plate step, cap-trimmed for the one line it is at
            standard sizes and untrimmed the moment it can wrap — see
            `look-card-spec.ts`. */}
        <View style={{ marginTop: 4 }}>
          <Text variant="plate" trim={lookNameTrimmed(fontScale)}>
            {displayName}
          </Text>
        </View>

        {/* Conditional on the wrapper, not just inside the collage: a look
            whose every piece its owner has hidden would otherwise leave the
            gap where a grid used to be, and a gap is a shape a reader can
            notice and subtract from. Nothing marks the absence. */}
        {pieces.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <LookCollage pieces={pieces} />
          </View>
        ) : null}

        {/* When it was worn, in the colophon the rest of the app dates things
            with — "YESTERDAY", "5H AGO", "14 JUL". Uppercased and tracked by
            the variant; written sentence-case by `sinceLabel` so the same
            string reads correctly in the accessible sentence above. */}
        {when ? (
          <Text variant="colophon" style={{ marginTop: 10 }}>
            {when}
          </Text>
        ) : null}
      </View>

      <View className="mt-3.5 border-t border-rule pt-3.5">
        <ReactionRow reaction={reaction} onReact={onReact} lookName={name} />
      </View>
    </Card>
  );
}
