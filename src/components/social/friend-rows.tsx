import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  acceptFailedLine,
  NOT_NOW,
  personLine,
  setAsideDetail,
  setAsideLine,
} from '@/components/social/friends-lines';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The Friends page's rows (Friends atlas F-01…F-05), presentational only.
 * Every row takes data and handlers and holds no state of its own — the page
 * owns the request state machine, and `dev-friends` renders these same
 * components with fixture data, which is what keeps that fixture honest.
 */

// ---------------------------------------------------------------------------
// Relative time, in the atlas's vocabulary
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

/** Local midnight — "yesterday" is a calendar boundary, not a 24-hour bucket. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "today" · "yesterday" · "2 days ago" · "last week" · "3 weeks ago" ·
 * "March" — the atlas's own vocabulary for how long a request has waited
 * (F-01 draws "2 days ago" and "last week"). Spelled in full, not the
 * ledger's "2d ago": a request row is a sentence about a person, not a
 * timestamp in a margin. Beyond about five weeks the elapsed count stops
 * meaning anything and the month name takes over, with the year only when it
 * is not this one. Unparseable dates drop the clause rather than printing
 * nonsense under someone's name.
 */
export function waitingSince(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 39) return `${Math.round(days / 7)} weeks ago`;

  const month = at.toLocaleDateString('en-US', { month: 'long' });
  return at.getFullYear() === now.getFullYear() ? month : `${month} ${at.getFullYear()}`;
}

/**
 * "Six people can see your closet." — the F-02 closing line, the only count
 * on the page that matters. Spelled out to twelve because the line is a
 * sentence; past that a numeral stops looking like affectation.
 */
const SPELLED = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
] as const;

export function closetAudienceLine(count: number): string {
  if (count === 1) return 'One person can see your closet.';
  const spelled = count >= 0 && count <= 12 ? SPELLED[count] : String(count);
  return `${spelled} people can see your closet.`;
}

// ---------------------------------------------------------------------------
// Shared anatomy
// ---------------------------------------------------------------------------

/**
 * The atlas's vertical three dots, traced — `ellipsis` is the horizontal
 * cousin and reads as "more text", not "more actions". Byline ink, like the
 * pointing chevrons: furniture, not content.
 */
function OverflowDots({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill={color}>
      <Circle cx={9} cy={4} r={1.5} />
      <Circle cx={9} cy={9} r={1.5} />
      <Circle cx={9} cy={14} r={1.5} />
    </Svg>
  );
}

/**
 * The row's own height — audit 88.
 *
 * 68, down from the 96 the old two-deck row cost: identity and action on ONE
 * line instead of a name block with a button bar under it. Seven rows fit the
 * first viewport at 393×852 against an acceptance floor of five, which is the
 * whole reason the buttons moved beside the name rather than under it.
 */
export const FRIEND_ROW_HEIGHT = 68;

/** 44pt, the atlas's — and the tap target's — number, in one place. */
const AVATAR = 44;

/**
 * Identity block: 44pt disc, the name, one quiet line under it.
 *
 * TYPE, PRECISELY (audit 89). The name is the only Medium string on the row;
 * the handle, the bio and every status line under it are 13pt REGULAR
 * secondary (`note`). A row whose second line is also Medium is a row with two
 * emphases and therefore none.
 *
 * WIDTH, PRECISELY. This block is `flex-1` with `minWidth: 0`, and every
 * action beside it is `flex-none`. That pair is what lets a 24-character name
 * wrap and a 22-character handle run to the action's edge without pushing it
 * off the row — see FR-01's second request, which is that stress case drawn in
 * situ rather than in a separate frame.
 */
function Identity({
  profile,
  subtitle,
  subtitleColor,
  subtitleLines = 1,
}: {
  profile: SocialProfile;
  subtitle: string | null;
  /** Inline override for the one accent case (a failed accept). */
  subtitleColor?: string;
  /**
   * Handles are one line — a truncated @name is still recognisable. Sentences
   * are not: a status line is the row's statement of what happened, so it wraps
   * rather than ending in an ellipsis.
   */
  subtitleLines?: number;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-3" style={{ minWidth: 0 }}>
      <Avatar name={profileName(profile)} size={AVATAR} imageUri={profile.avatarUrl} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text variant="body" numberOfLines={2}>
          {profileName(profile)}
        </Text>
        {subtitle ? (
          <Text
            variant="note"
            numberOfLines={subtitleLines}
            className="mt-0.5"
            style={subtitleColor ? { color: subtitleColor } : undefined}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The quiet alternative beside a filled action — Not now, Undo, Cancel.
 *
 * 44pt of target, 13pt of ink-coloured label, and `flex-none` so its width is
 * its own word. Deliberately NOT a bordered button: audit 90's rule is one
 * filled action per row with a text alternative beside it, and two outlined
 * pills side by side is the "stack of badges" the audit is against.
 */
function QuietTextButton({
  label,
  onPress,
  accessibilityLabel,
  tone,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  /** `accent` for the one reversal (Undo); ink everywhere else. */
  tone?: 'accent';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: MIN_TAP_TARGET, flexGrow: 0, flexShrink: 0 }}
      className="justify-center px-2 active:opacity-60">
      <Text variant="note" style={{ color: tone === 'accent' ? theme.accent : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A pending answer — a TRAY-FILLED LABEL IN THE PRESENT PARTICIPLE.
 *
 * Replaces the old shimmering "Adding…". Two reasons, and they are the same
 * two that decided AV-02's pending row: a participle on a still ground says
 * which verb is in flight where a pulse says only "wait"; and an animation that
 * never settles cannot reproduce its own bytes in a capture, so a state drawn
 * with one can never be verified from a screenshot.
 */
function PendingLabel({ children }: { children: string }) {
  return (
    <View
      className="items-center justify-center rounded-md bg-tray px-3"
      style={{ height: 34, flexGrow: 0, flexShrink: 0 }}>
      <Text variant="note" accessibilityLiveRegion="polite">
        {children}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// F-01 / F-04 · The request row and its states
// ---------------------------------------------------------------------------

/**
 * Where an unanswered request stands, per-row (atlas F-04). `waiting` carries
 * the two buttons; every other state resolves in place with no toast and no
 * alert — only the row that was answered changes.
 */
export type RequestRowState = 'waiting' | 'adding' | 'accepted' | 'dismissed' | 'failed';

export type RequestRowProps = {
  profile: SocialProfile;
  /** ISO — when the request arrived. */
  requestedAt: string;
  state: RequestRowState;
  onAccept: () => void;
  onNotNow: () => void;
  /** `dismissed` only — restores the row inside the five-second window. */
  onUndo: () => void;
  /** `failed` only. */
  onRetry: () => void;
};

export function RequestRow({
  profile,
  requestedAt,
  state,
  onAccept,
  onNotNow,
  onUndo,
  onRetry,
}: RequestRowProps) {
  const theme = useTheme();
  const name = profileName(profile);

  // "Not now" swaps the whole row for the receipt — the identity leaves with
  // the request, because a lingering name would read as a standing judgement.
  //
  // SET ASIDE, NOT REMOVED. The write is `DISMISSED_KEY` in
  // `src/app/friends/index.tsx` — an AsyncStorage set on this device, and
  // nothing on the server. Nothing reached the sender, so the receipt says so
  // and offers the real reversal beside it: `undoNotNow` deletes the id from
  // that same set, which is a reversal that exists rather than a drawn one.
  if (state === 'dismissed') {
    return (
      <View
        className="flex-row items-center gap-3 px-4 py-3.5"
        style={{ minHeight: MIN_TAP_TARGET }}>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text variant="body" accessibilityLiveRegion="polite">
            {setAsideLine(name)}
          </Text>
          <Text variant="note" className="mt-0.5">
            {setAsideDetail(name)}
          </Text>
        </View>
        <QuietTextButton
          label="Undo"
          tone="accent"
          onPress={onUndo}
          accessibilityLabel={`Undo — put ${name}’s request back`}
        />
      </View>
    );
  }

  const quiet = personLine(profile);
  // How long it has waited is real (`follows.created_at`) and useful, but it is
  // not one of the four things audit 89 lets the row PRINT. It survives as
  // speech on the action, where it answers "how old is this?" without adding a
  // third string to a 68pt row.
  const since = waitingSince(requestedAt);

  if (state === 'adding') {
    return (
      <View
        className="flex-row items-center gap-3 px-4"
        style={{ minHeight: FRIEND_ROW_HEIGHT }}>
        <Identity profile={profile} subtitle={quiet} />
        <PendingLabel>Accepting…</PendingLabel>
      </View>
    );
  }

  if (state === 'accepted') {
    return (
      <View
        className="flex-row items-center gap-3 px-4"
        style={{ minHeight: FRIEND_ROW_HEIGHT }}>
        <Identity profile={profile} subtitle="Friends · their closet is open to you" />
      </View>
    );
  }

  // A failed accept keeps the row, its avatar and its position, and names what
  // did NOT happen — above all that nothing reached her. Retry is in place.
  if (state === 'failed') {
    return (
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Identity
          profile={profile}
          subtitle={acceptFailedLine(name)}
          subtitleColor={theme.accent}
          subtitleLines={3}
        />
        <Button
          title="Retry"
          variant="secondary"
          onPress={onRetry}
          accessibilityLabel={`Retry accepting ${name}`}
        />
      </View>
    );
  }

  // The resting request. ONE filled action, its width set by its own word, and
  // the quiet alternative beside it — `waitingSince` is deliberately not on
  // this row any more: audit 89 leaves the quiet line to handle and bio.
  return (
    <View
      className="flex-row items-center gap-2 px-4"
      style={{ minHeight: FRIEND_ROW_HEIGHT }}>
      <Identity profile={profile} subtitle={quiet} />
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <Button
          title="Accept"
          variant="ink"
          onPress={onAccept}
          accessibilityLabel={
            since
              ? `Accept ${name}’s friend request, asked ${since}`
              : `Accept ${name}’s friend request`
          }
        />
      </View>
      <QuietTextButton
        label={NOT_NOW}
        onPress={onNotNow}
        accessibilityLabel={`Not now — set aside ${name}’s request. Nothing is sent.`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// F-01 · The friend row
// ---------------------------------------------------------------------------

export type FriendRowProps = {
  profile: SocialProfile;
  onPress: () => void;
  onOverflow: () => void;
};

/**
 * A friend row has nothing to decide, so it carries NO filled action at all —
 * audit 88's third case. The row opens the closet; the dots open the folded
 * actions, and they stay on the row as their own 44pt target rather than
 * collapsing into a sheet that lists everyone.
 */
export function FriendRow({ profile, onPress, onOverflow }: FriendRowProps) {
  const theme = useTheme();
  const name = profileName(profile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} — view closet`}
      onPress={onPress}
      style={{ minHeight: FRIEND_ROW_HEIGHT }}
      className="flex-row items-center px-4 active:opacity-60">
      <Identity profile={profile} subtitle={personLine(profile)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More about ${name}`}
        onPress={onOverflow}
        hitSlop={10}
        // 44pt of its own — a destructive menu must never be a graze off the
        // navigation tap beside it.
        style={{ minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET }}
        className="items-end justify-center active:opacity-60">
        <OverflowDots color={theme.byline} />
      </Pressable>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// F-01 · The sent row
// ---------------------------------------------------------------------------

/** A request still out in the world. Nothing to do but wait, so it says so. */
export function SentRow({ profile }: { profile: SocialProfile }) {
  return (
    <View
      accessibilityLabel={`${profileName(profile)} — request sent, waiting`}
      className="flex-row items-center gap-3 px-4"
      style={{ minHeight: FRIEND_ROW_HEIGHT }}>
      <Identity profile={profile} subtitle={personLine(profile)} />
      <Text variant="note">Waiting</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// F-05 · Search results — every row ends in what you already are to them
// ---------------------------------------------------------------------------

/**
 * The five standings a username search can find, plus `asked` — the state a
 * row enters the moment Add lands. `accept` is the one people forget: they
 * already asked you, so the row offers Accept, never Add — the same
 * friendship must not be requested twice.
 */
export type SearchRelation = 'self' | 'friends' | 'requested' | 'asked' | 'accept' | 'add';

export type SearchResultRowProps = {
  profile: SocialProfile;
  relation: SearchRelation;
  /** `add` — send the request. */
  onAdd: () => void;
  /** `accept` — follow back. */
  onAccept: () => void;
  /** `asked` — withdraw silently. */
  onCancel: () => void;
  /** `friends` — the row taps through to their closet. */
  onOpen: () => void;
  /** True while this row's add/accept is in flight. */
  pending?: boolean;
};

export function SearchResultRow({
  profile,
  relation,
  onAdd,
  onAccept,
  onCancel,
  onOpen,
  pending = false,
}: SearchResultRowProps) {
  const name = profileName(profile);

  // The one moment the mutual rule matters most — the second a person expects
  // to be able to see a closet, the row says nothing opens yet.
  const subtitle =
    relation === 'asked' ? 'Asked · nothing opens until they say yes' : personLine(profile);

  const trailing =
    relation === 'self' ? (
      <Text variant="note">You</Text>
    ) : relation === 'friends' ? (
      <Text variant="note">Friends</Text>
    ) : relation === 'requested' ? (
      <Text variant="note">Requested</Text>
    ) : relation === 'asked' ? (
      <QuietTextButton label="Cancel" tone="accent" onPress={onCancel} />
    ) : relation === 'accept' ? (
      // "Add back" — the returning friend, audit 88's second case. One filled
      // action whose width is its own words.
      <Button
        title="Add back"
        variant="ink"
        loading={pending}
        onPress={onAccept}
        accessibilityLabel={`Accept ${name}’s friend request`}
      />
    ) : (
      <Button
        title="Add"
        variant="secondary"
        loading={pending}
        onPress={onAdd}
        accessibilityLabel={`Add ${name} as a friend`}
      />
    );

  const row = (
    <View className="flex-row items-center gap-3 px-4 py-3" style={{ minHeight: MIN_TAP_TARGET }}>
      <Identity profile={profile} subtitle={subtitle} subtitleLines={relation === 'asked' ? 2 : 1} />
      {trailing}
    </View>
  );

  if (relation === 'friends') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} — friends, view closet`}
        onPress={onOpen}
        className="active:opacity-60">
        {row}
      </Pressable>
    );
  }

  return row;
}
