import { Pressable, View } from 'react-native';

import { Rule } from '@/components/ui/rule';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  META_LEADING,
  META_SIZE,
  NOTE_RADIUS,
  ROW_AVATAR,
  ROW_GAP,
  ROW_PAD_Y,
  SKELETON_ROWS,
} from '@/features/activity-center/activity-spec';
import {
  EMPTY_BODY,
  EMPTY_TITLE,
  ERROR_BODY,
  ERROR_RETRY,
  ERROR_TITLE,
  LOADING_STATUS,
  OFFLINE_BANNER,
} from '@/features/activity-center/copy';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * AC-01, AC-06 and AC-07 — the three states with no rows in them, plus the
 * banner AC-07 draws ABOVE rows that do exist.
 *
 * The distinction that matters most here is the one between AC-01 and AC-07. An
 * empty inbox and a failed read look identical from the outside and mean
 * opposite things: one says nothing has happened, the other says we could not
 * find out. Dressing the second as the first would tell a reader that nobody
 * had invited them to anything when in fact the app had simply failed to look.
 *
 * ── REDESIGN 28 RETIRED THE CENTRED HERO ──────────────────────────────────
 *
 * All three used to be a glyph over a centred serif line over centred body
 * copy, on the app's standard hero geometry. None of the frames draws one. The
 * empty page is two ranged-left lines at the gutter; the failure is a tinted
 * CARD at the top of the page, in the position the offline banner already
 * occupied. That is a real improvement rather than a restyle: a failure sitting
 * where a banner sits is a failure the reader can place, and the two states
 * ("could not read at all" / "read failed over a cached list") now differ in
 * their content rather than in the shape of the whole screen.
 *
 * The glyphs are gone from this file with them. `ActivityCenterEmptyGlyph` and
 * `CircleMark` are still exported from `./glyphs` because the two detail
 * screens draw them; nothing on the list does.
 */

// ---------------------------------------------------------------------------
// AC-01 · empty
// ---------------------------------------------------------------------------

/**
 * AC-01 · "Nothing yet."
 *
 * NO BUTTON, and that is the design rather than an omission. There is nothing
 * on an empty inbox to do — the page fills because other people did things —
 * and a "Find friends" or "Make a group" here would be this surface borrowing
 * Explore's job in order to have something to ask for. Quiet is the normal
 * state, and a surface that cannot bear its own quiet is an engagement surface.
 *
 * Ranged left at the gutter, sitting a little below the page's centre, which is
 * `activity-list-empty` exactly. Centred type would have been the app's hero
 * geometry; this page has a masthead ranged left and a colophon ranged left,
 * and a centred pair between them reads as a different screen.
 */
export function ActivityEmpty() {
  return (
    <View
      accessibilityRole="summary"
      className="flex-1 justify-center px-gutter"
      // The frame's optical centre — the block sits below the true middle, so
      // it reads as the body of the page rather than as a floating notice.
      style={{ paddingBottom: 96 }}>
      <Text variant="title" trim>
        {EMPTY_TITLE}
      </Text>
      <Text className="mt-3 text-muted" style={{ fontSize: 17, lineHeight: 25 }}>
        {EMPTY_BODY}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AC-07 · the read failed
// ---------------------------------------------------------------------------

/**
 * AC-07 · the read failed and there is nothing cached to fall back on.
 *
 * A blush card at the top of the page — `activity-list-read-error`. Blush is
 * the palette's warm rose surface and the accent's own ground; the body sits in
 * `critical` on it (7.0:1) and the retry in `accent` (6.9:1), so the card
 * carries the failure in colour without a single hex outside the palette.
 *
 * `lastUpdated` is the frame's "Last updated 5 hours ago". Drawn only when there
 * genuinely was a previous success; a fabricated one would be worse than none,
 * because the whole point of the line is to say how stale this is.
 */
export function ActivityError({
  onRetry,
  lastUpdated,
}: {
  onRetry: () => void;
  lastUpdated?: string | null;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      className="mx-gutter mt-3 px-4 py-4"
      style={{ borderRadius: NOTE_RADIUS, backgroundColor: theme.blush }}>
      <Text variant="body" style={{ fontSize: 17, lineHeight: 23 }}>
        {ERROR_TITLE}
      </Text>
      <Text className="mt-1.5" style={{ fontSize: 15, lineHeight: 21, color: theme.critical }}>
        {ERROR_BODY}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ERROR_RETRY}
        onPress={onRetry}
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET, alignSelf: 'flex-start', justifyContent: 'center' }}
        className="active:opacity-60">
        <Text style={{ fontSize: 17, color: theme.accent }}>{ERROR_RETRY}</Text>
      </Pressable>
      {lastUpdated ? (
        <Text variant="note" style={{ fontSize: META_SIZE, lineHeight: META_LEADING }}>
          {`Last updated ${lastUpdated}`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * AC-07's banner, for the case that matters more: a failed refresh over a list
 * that is still perfectly readable.
 *
 * It sits ABOVE the rows and never instead of them. A reader who opened the app
 * on a train wants yesterday's invitation, correctly labelled as yesterday's,
 * rather than a full-screen apology in front of data the device is already
 * holding. `accessibilityLiveRegion="polite"` so it is announced when it
 * appears without interrupting whatever VoiceOver is reading.
 *
 * The alert ring came off it in redesign 28. `activity-list-offline-cached`
 * draws a plain tray card with muted copy, and that is right: being offline is
 * a condition, not an error, and an exclamation mark beside a complete list is
 * the surface raising its voice about nothing having gone wrong.
 */
export function OfflineBanner() {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="mx-gutter mt-3 bg-tray px-4 py-3.5"
      style={{ borderRadius: NOTE_RADIUS }}>
      <Text variant="body" className="text-muted" style={{ fontSize: 15, lineHeight: 21 }}>
        {OFFLINE_BANNER}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// AC-06 · loading
// ---------------------------------------------------------------------------

/**
 * AC-06 · six rows of the geometry the real ones have.
 *
 * The pulse is `Skeleton`'s own sweep, which already freezes under Reduce Motion
 * (`useReducedMotion` inside the primitive) — so §10's "skeleton pulse frozen"
 * is honoured by using the shared primitive rather than by a branch here.
 *
 * ── THE STATUS LINE IS SPOKEN AND NOT DRAWN ───────────────────────────────
 *
 * It used to be a visible centred sentence under the rows. `activity-list-
 * loading` has no such line — the skeletons say it — but a reader who has just
 * pushed this screen and cannot see it still needs to be told that something is
 * happening. So it stays as a zero-height polite live region: the announcement
 * is unchanged, and the frame is met. Dropping it outright would have removed
 * information that exists only for the readers who cannot see the page.
 */
export function ActivitySkeleton() {
  return (
    <View>
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityLabel={LOADING_STATUS}
        style={{ height: 0 }}
      />

      {Array.from({ length: SKELETON_ROWS }, (_, i) => i).map((i) => (
        <View key={i}>
          <View
            className="flex-row items-center"
            style={{ paddingVertical: ROW_PAD_Y, paddingHorizontal: GUTTER, gap: ROW_GAP }}>
            <Skeleton
              style={{ width: ROW_AVATAR, height: ROW_AVATAR, borderRadius: ROW_AVATAR / 2 }}
              delay={i * 120}
            />
            <View className="flex-1" style={{ gap: 8 }}>
              <Skeleton className="rounded-chip" style={{ height: 13, width: '100%' }} delay={i * 120} />
              <Skeleton className="rounded-chip" style={{ height: 13, width: '52%' }} delay={i * 120} />
            </View>
          </View>
          <View className="px-gutter">
            <Rule tone="hairline" />
          </View>
        </View>
      ))}
    </View>
  );
}
