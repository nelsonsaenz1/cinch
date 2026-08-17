import { useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { type DailyReaction } from '@/features/daily-social/types';
import { lookAccessibilityLabel, piecesLine, UNNAMED_LOOK } from '@/features/daily-social/copy';
import { sinceLabel } from '@/features/explore/timeline';

import { LookCollage, type LookCollagePiece } from './look-collage';
import { lookMetaStacked, lookNameTrimmed } from './look-card-spec';
import { ReactionRow } from './reaction-row';

/**
 * A piece as the card takes it — the collage's picture, plus the word for it.
 *
 * The name is the card's business rather than the collage's: the collage is
 * hidden from VoiceOver on purpose, and a name inside it would be a per-tile
 * label, which is the thing the atlas removed. It is printed once, in the
 * outfit line, where it names what is there and offers nothing to count.
 */
export type LookCardPiece = LookCollagePiece & { name: string };

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
  /**
   * Where this look sits in a finite day — the atlas's "Look 1 of 4", spoken
   * and not drawn.
   *
   * Spoken because the ending is the point of the unit and a reader swiping
   * card by card has no other way to feel one coming; not drawn because the
   * subtitle over the list already says how many there are, and a second
   * counter on every card would be the running tally this surface refuses.
   *
   * Optional: a card rendered alone (a fixture, a single look) has no position
   * to report and says nothing rather than "1 of 1".
   */
  position?: { index: number; total: number };
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
  position,
  now,
}: LookCardProps) {
  const { fontScale } = useWindowDimensions();
  const stackedMeta = lookMetaStacked(fontScale);
  const displayName = name?.trim() ? name.trim() : UNNAMED_LOOK;
  const when = sinceLabel(wornAt, now ?? new Date());
  const worn = piecesLine(pieces.map((piece) => piece.name));

  return (
    <Card padding="md">
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
        {/* WHOSE, AND WHEN, ABOVE THE PICTURE — the atlas's card header.

            Attribution comes first because the unit's whole subject is that
            these are someone else's clothes, and the date joins it there rather
            than sitting under the collage: read in that order the card is
            "Maya, this morning, here is what it looked like", which is the
            sentence a person would actually say.

            ONE ROW, WHERE THE ATLAS STACKS THEM, and that is a translation
            rather than a departure. The atlas can stack because its name is
            17pt ink and its timestamp is 13pt sentence-case muted — two clearly
            different voices. In this app both are tracked uppercase micro-labels
            (`eyebrow` and `colophon`), so stacked they read as one noisy block
            with no subject in it. Set across a baseline they read as what they
            are: one attribution line, name at the left margin, date at the
            right, the arrangement the app's own dated rows already use.

            At AX sizes the row becomes two lines — see `lookMetaStacked`. A
            long tracked name squeezing a long tracked date is the shrinking the
            accessibility contract forbids by name, and the atlas answers it the
            same way: above fontScale 1.5 the card meta wraps.

            "YESTERDAY", "5H AGO", "14 JUL" — uppercased and tracked by the
            variant. `sinceLabel` writes it sentence-case so the same string
            reads correctly inside the accessible sentence above. */}
        <View
          style={
            stackedMeta
              ? { gap: 3 }
              : { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }
          }>
          <Text variant="eyebrow" className={stackedMeta ? '' : 'min-w-0 flex-1'}>
            {ownerName}
          </Text>
          {when ? <Text variant="colophon">{when}</Text> : null}
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

        {/* The serif at the plate step, cap-trimmed for the one line it is at
            standard sizes and untrimmed the moment it can wrap — see
            `look-card-spec.ts`. Under the collage, where the atlas puts it: the
            picture is the look and the name is the caption on it. */}
        <View style={{ marginTop: 12 }}>
          <Text variant="plate" trim={lookNameTrimmed(fontScale)}>
            {displayName}
          </Text>
        </View>

        {/* The outfit line — what was worn, in words, joined by the same
            separator the atlas draws. It is the only readable account of the
            look: the collage is hidden from VoiceOver so no per-tile label can
            be counted off, so without this line a reader hears that a look
            exists and never what it was.

            No count and no ellipsis. Every name that crossed is printed, and a
            look whose pieces its owner all kept prints nothing here rather than
            a sentence about the silence. */}
        {worn ? (
          <Text variant="note" style={{ marginTop: 4 }}>
            {worn}
          </Text>
        ) : null}
      </View>

      <View className="mt-3.5 border-t border-rule pt-3.5">
        <ReactionRow reaction={reaction} onReact={onReact} lookName={name} ownerName={ownerName} />
      </View>
    </Card>
  );
}
