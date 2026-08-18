import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { invitedLabel } from '@/features/circles/copy';
import { accentAlpha, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * THE ROOM, DRAWN AS A TABLE — redesign 27.
 *
 * The brief for this page is one sentence: "the room as a table — member
 * avatars prominent, invitations as warm bands, the roster grammar preserved
 * exactly." This file is the first two halves of it. The third half is not
 * here and could not be: every word on this surface still comes from
 * `@/features/circles/copy`, which is the module the vocabulary contract and
 * six test files hold. NOTHING IN THIS FILE WRITES A SENTENCE.
 *
 * ── WHY A TABLE RATHER THAN A LIST ──────────────────────────────────────────
 *
 * A private group holds at most twelve people, and the shipped screen drew
 * them as a vertical list of 44pt rows — the same grammar the app uses for
 * settings, garments and merchants. That grammar says "records to scan". A
 * room of at most twelve friends is not a record set; it is a table with
 * people at it, and the redesign draws it that way: a four-column grid of
 * sixty-point discs with a name under each. The number of seats is small
 * enough that the whole group is one glance, which is the entire point of the
 * cap.
 *
 * ── AND THE PENDING SEATS SIT AT THE SAME TABLE ─────────────────────────────
 *
 * `SeatTable` takes members and pending invitations and lays them in ONE grid,
 * because that is what a seat is: taken or promised, it is off the twelve
 * either way (`enforce_circle_size` counts `invited` together with `joined`).
 * A pending seat is drawn on the blush ground and captioned with
 * `invitedLabel`, so the difference between a person and a promise is a WORD
 * and a fill, never a fill alone.
 *
 * Pending seats are passed ONLY by the owner's surfaces. That is not a rule
 * this component can enforce and it does not pretend to: the roster policy
 * hands every row in every state to anybody who is `joined`, and "only the
 * owner has business with an unanswered invitation" is a decision the screens
 * make. What this component guarantees is that it invents nothing — it draws
 * the seats it is given and no others.
 *
 * ── NOTHING HERE IS CAPPED, AND NOTHING SHRINKS ─────────────────────────────
 *
 * No `numberOfLines`, no `fontSize`, no fixed height anywhere. A seat's name
 * wraps under its disc and the row grows; at AX-XXXL the grid is taller and
 * the page scrolls, which is the only answer the accessibility contract
 * permits. The columns are percentage flex bases rather than measured widths,
 * so there is no breakpoint to get wrong.
 */

/** The disc at a seat. One number, so a seat and its ring cannot drift apart. */
const SEAT = 60;

/** Four to a row, as the frames draw it. A percentage, so no width is measured. */
const SEAT_COLUMN = '25%';

/** The abstract person-mark on a list plate. Smaller than a seat, on purpose. */
const MARK = 26;

/** How many marks a list plate ever draws, however many people are in the room. */
const MARK_LIMIT = 5;

/** How far each mark tucks under the one before it. */
const MARK_OVERLAP = 8;

// ---------------------------------------------------------------------------
// The warm band
// ---------------------------------------------------------------------------

/**
 * A BAND, WHICH IS THE PAGE'S ONE NEW SHAPE.
 *
 * Every notice on this flow used to be a rule with a serif line under it —
 * correct, quiet, and indistinguishable from the page it interrupted. The
 * redesign gives all of them one warm ground instead, and the tone says which
 * kind of interruption it is:
 *
 * · `blush` — something is being OFFERED. An invitation waiting for an answer,
 *   the one-person group asking for a second. The app's warmest surface, spent
 *   here because these are the two moments the flow is actually for.
 * · `tray` — something is a BOUNDARY. The group is full; the group is gone.
 *   Neither is a failure and neither is an emptiness, so neither gets a glyph
 *   of absence or an error's alarm — they get the recessed ground, which reads
 *   as a fact about the room rather than an event that arrived.
 *
 * The ground is the only thing the tone changes. Both carry their sentences in
 * `ink` and `muted` at full strength, because a band whose meaning lived in its
 * fill would be meaning carried by colour alone — and the whole reason this
 * flow states every refusal as a word is that it refuses to do that.
 */
export function WarmBand({
  tone = 'blush',
  children,
  className = '',
}: {
  tone?: 'blush' | 'tray';
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-plate p-5 ${tone === 'blush' ? 'bg-blush' : 'bg-tray'} ${className}`}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/** One seat: a disc, a name, and — when it is a promise rather than a person — when. */
function Seat({
  name,
  invitedAt,
  waiting,
}: {
  name: string;
  invitedAt: string | null;
  waiting: boolean;
}) {
  const theme = useTheme();
  const detail = waiting ? invitedLabel(invitedAt) : '';

  return (
    <View
      // One accessible element per seat, and the label is composed from the
      // same two facts that are drawn. A reader who swiped through the disc,
      // the name and the caption separately would hear a table of fragments.
      accessible
      accessibilityRole="text"
      accessibilityLabel={detail ? `${name}. ${detail}` : name}
      className="items-center px-1 pb-5"
      style={{ flexBasis: SEAT_COLUMN, minHeight: MIN_TAP_TARGET }}>
      <View
        className="items-center justify-center rounded-full"
        style={{
          // A well UNDER the disc, not a tint ON it: `Avatar` owns its own
          // ground, and a pending seat has to be legible as pending without
          // the person's initials changing colour.
          padding: waiting ? 3 : 0,
          backgroundColor: waiting ? accentAlpha(0.1) : undefined,
        }}>
        <Avatar name={name} size={SEAT} />
      </View>
      <Text variant="note" className="mt-2 text-center">
        {name}
      </Text>
      {detail ? (
        <Text variant="note" className="mt-0.5 text-center" style={{ color: theme.muted }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * EVERYBODY AT THE TABLE.
 *
 * Members first, then the seats that are promised — the order `useCircleMembers`
 * already sorts by (owner, then name), followed by whatever the caller filtered
 * as `invited`. There is no re-sort here: a roster that reordered itself
 * between the manage screen and the room would be two different tables of the
 * same people.
 */
export function SeatTable({
  members,
  pending = [],
}: {
  members: readonly { userId: string; name: string }[];
  /** Owner-only. See the header: this component draws what it is given. */
  pending?: readonly { userId: string; name: string; invitedAt: string | null }[];
}) {
  return (
    <View className="flex-row flex-wrap">
      {members.map((member) => (
        <Seat key={member.userId} name={member.name} invitedAt={null} waiting={false} />
      ))}
      {pending.map((seat) => (
        <Seat key={seat.userId} name={seat.name} invitedAt={seat.invitedAt} waiting />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The list plate's seat marks
// ---------------------------------------------------------------------------

/**
 * A ROOM WITH PEOPLE IN IT, WITHOUT SAYING WHO.
 *
 * ── THIS IS THE ONE PLACE THE FRAMES AND THE DATA DISAGREE, AND WHY ─────────
 *
 * Every populated frame of the groups LIST draws each row with a cluster of
 * real member avatars — "AR CM PN DK" — under the group's name. The room does
 * exactly that and this does not, and the difference is not an omission:
 *
 * 1. **The list has no roster.** `useCircles` returns a name, an owner and
 *    `circle_member_count` — a scalar from an RPC that is deliberately not a
 *    view, precisely because a view is joinable back to the membership table
 *    and names people. Drawing faces here would mean fetching a roster per row
 *    for a screen whose whole content is "these rooms exist".
 * 2. **The row's spoken label is fixed.** `groupRowAccessibilityLabel` is
 *    pinned by value — "Sunday tennis. 4 members. Private. You own it." — and
 *    it names nobody. Faces the label cannot speak would be a row that says
 *    four things to the eye and three to VoiceOver, which is the asymmetry the
 *    accessibility contract exists to prevent.
 *
 * So the count is drawn as a count: overlapping unnamed discs, the same figure
 * the empty state uses for "people, not yet". It carries exactly the fact the
 * label already speaks, and it carries no fact the label does not.
 *
 * Five is the ceiling because a twelve-disc row is a bar chart. Beyond it the
 * marks stop and the number in `groupRowLine` keeps going, which is the honest
 * split: the picture is a texture, the sentence is the datum.
 */
export function SeatMarks({ memberCount }: { memberCount: number }) {
  const theme = useTheme();
  const safe = Number.isFinite(memberCount) ? Math.floor(memberCount) : 0;
  const marks = Math.max(Math.min(safe, MARK_LIMIT), 0);

  if (marks === 0) return null;

  return (
    <View
      // Decorative and derived: the count is already spoken by the row's own
      // label, so a second announcement here would be the same fact twice.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="flex-row items-center">
      {Array.from({ length: marks }, (_, index) => (
        <View
          key={index}
          className="rounded-full"
          style={{
            width: MARK,
            // `aspectRatio` rather than a height: a disc beside text has to
            // stay a disc when the text grows, and the kit forbids a fixed
            // height around anything that shares a row with a sentence.
            aspectRatio: 1,
            backgroundColor: theme.sand,
            borderWidth: 2,
            borderColor: theme.canvas,
            marginLeft: index === 0 ? 0 : -MARK_OVERLAP,
          }}
        />
      ))}
    </View>
  );
}
