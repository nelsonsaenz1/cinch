import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

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

/** `@username`, or nothing — the second line never invents a handle. */
function handleLine(profile: SocialProfile): string | null {
  return profile.username ? `@${profile.username}` : null;
}

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

/** Identity block: 38pt sand disc, name, one quiet line under it. */
function Identity({
  profile,
  subtitle,
  subtitleColor,
  subtitleLines = 1,
}: {
  profile: SocialProfile;
  subtitle: string | null;
  /** Inline override for the one accent case (F-04 failed). */
  subtitleColor?: string;
  /**
   * Handles are one line — a truncated @name is still recognisable. Sentences
   * are not: the after-add line (F-05) is the page's statement of the mutual
   * rule, so it wraps rather than ends in an ellipsis. The atlas fits it on one
   * line only because it writes "she says yes"; our they/them wording is a
   * character wider than the row has.
   */
  subtitleLines?: number;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-3">
      <Avatar name={profileName(profile)} size={38} imageUri={profile.avatarUrl} />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
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
 * "Adding…" with the atlas's shimmer keyframes — opacity .55 ↔ .9, no layout
 * movement. Reduce Motion parks it mid-travel, the same convention as the
 * skeleton's band.
 */
function ShimmerText({ children }: { children: string }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [reduced, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: reduced ? 0.7 : pulse.value }));

  return (
    <Animated.View style={style}>
      <Text variant="note" accessibilityLiveRegion="polite">
        {children}
      </Text>
    </Animated.View>
  );
}

/** An accent text control — Undo, Cancel: the atlas's link grammar, 44pt touched. */
function AccentTextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="justify-center px-2 active:opacity-60">
      <Text variant="label" style={{ color: theme.accent }}>
        {label}
      </Text>
    </Pressable>
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
  if (state === 'dismissed') {
    return (
      <View
        className="flex-row items-center justify-between px-4 py-3.5"
        style={{ minHeight: MIN_TAP_TARGET }}>
        <Text variant="callout" className="text-muted" accessibilityLiveRegion="polite">
          Request removed.
        </Text>
        <AccentTextButton label="Undo" onPress={onUndo} />
      </View>
    );
  }

  const handle = handleLine(profile);
  const since = waitingSince(requestedAt);
  const askedLine = handle ? `${handle}${since ? ` · ${since}` : ''}` : since || null;

  if (state === 'adding') {
    return (
      <View className="flex-row items-center px-4 py-3.5">
        <Identity profile={profile} subtitle={handle} />
        <ShimmerText>Adding…</ShimmerText>
      </View>
    );
  }

  if (state === 'accepted') {
    return (
      <View className="flex-row items-center px-4 py-3.5">
        <Identity profile={profile} subtitle="Friends · their closet is open to you" />
      </View>
    );
  }

  if (state === 'failed') {
    return (
      <View className="flex-row items-center gap-3 px-4 py-3.5">
        <Identity
          profile={profile}
          subtitle="Couldn’t accept just now."
          subtitleColor={theme.accent}
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

  return (
    <View className="px-4 py-3.5">
      <Identity profile={profile} subtitle={askedLine} />
      <View className="mt-3 flex-row gap-2">
        <Button
          title="Accept"
          variant="ink"
          onPress={onAccept}
          accessibilityLabel={`Accept ${name}’s friend request`}
          className="flex-1"
        />
        <Button
          title="Not now"
          variant="secondary"
          haptic={false}
          onPress={onNotNow}
          accessibilityLabel={`Not now — set aside ${name}’s request`}
          className="flex-1"
        />
      </View>
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
 * A friend row has nothing to decide, so it has nothing on it but a name and
 * an overflow. The row opens the closet; the dots open the folded actions.
 */
export function FriendRow({ profile, onPress, onOverflow }: FriendRowProps) {
  const theme = useTheme();
  const name = profileName(profile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} — view closet`}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center px-4 py-3 active:opacity-60">
      <Identity profile={profile} subtitle={handleLine(profile)} />
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
      className="flex-row items-center px-4 py-3"
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Identity profile={profile} subtitle={handleLine(profile)} />
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
    relation === 'asked' ? 'Asked · nothing opens until they say yes' : handleLine(profile);

  const trailing =
    relation === 'self' ? (
      <Text variant="note">You</Text>
    ) : relation === 'friends' ? (
      <Text variant="note">Friends</Text>
    ) : relation === 'requested' ? (
      <Text variant="note">Requested</Text>
    ) : relation === 'asked' ? (
      <AccentTextButton label="Cancel" onPress={onCancel} />
    ) : relation === 'accept' ? (
      <Button
        title="Accept"
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
