import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { RefObject } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  COPY,
  inviteHeadingFor,
  isOfflineLike,
  isSearching,
  searchTerm,
  shareSubtitle,
  showsInviteRows,
  STATE_COPY,
} from '@/features/social-graph/people-search-spec';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { capTrim, leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme, warningAlpha } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE } from '@/theme/type-scale';

/**
 * Find people — the drawn surface. Redesign 09, accepted 2026-08-17.
 *
 * Split from the route for the reason every other rebuilt page in this repo
 * is: a screen that reaches for `useProfileSearch` at the top cannot be posed,
 * and a state nobody can open is a state nobody checks. Everything here is a
 * function of the `view` object, so `dev-ps-01…06` draw the six accepted
 * frames out of `people-search-fixtures.ts` without a session, a network, or
 * a single mutable row on the other end.
 *
 * ── THE DEFECT THIS REPLACES ──────────────────────────────────────────────
 *
 * The directive lists People Search as "P0 — has a live visual defect the
 * founder sees — overlapping text". The old row put a `flex-1` text column
 * beside a trailing control that declared no shrink behaviour at all, so a
 * long display name and an "Add" pill negotiated the same points and the
 * loser was drawn over. Every row below states all three parts explicitly:
 * the avatar and the trailing control are `flex-shrink: 0`, the text column
 * is `flex-1` with `minWidth: 0`, and both its lines are `numberOfLines={1}`.
 * That is the artifact's own note — "results rows are flex with a fixed
 * avatar column, min-width:0 text column, and single-line truncation" — and
 * it is why the fix is a property of the layout rather than of the data that
 * happened to be in it.
 *
 * ── LARGE TYPE ────────────────────────────────────────────────────────────
 *
 * `large` is the accepted AX frame, not a smaller version of the standard
 * one: Cancel drops under the title, the invite rows shed their glyph and
 * chevron to keep both lines whole, and a result becomes three stacked
 * elements with a full-width control. Nothing is capped, truncated or scaled
 * below its documented size — height is allowed to grow and the page scrolls.
 */

export type PeopleState = 'add' | 'friends' | 'requested' | 'you';

export type PeopleRow = SocialProfile & { state: PeopleState };

export type PeopleSearchView = {
  query: string;
  onChangeQuery: (query: string) => void;
  onCancel: () => void;
  /** The signed-in member's own handle, for the oxblood row's second line. */
  shareHandle: string | null;
  /** Every invite affordance on this page. One destination: Share, page 10. */
  onShare: () => void;
  results: PeopleRow[];
  recent: PeopleRow[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpenProfile: (row: PeopleRow) => void;
  onAdd: (row: PeopleRow) => void;
  adding: boolean;
  inputRef?: RefObject<TextInput | null>;
  autoFocus?: boolean;
};

// 31, down from 36 — the 2026-08-24 founder call that stepped every page-title
// masthead back 15% (the `display` token moved 40 → 34 in the same pass).
const TITLE_SIZE = 31;
const TITLE_LEADING = leading('instrument', TITLE_SIZE, 1.05);

/**
 * The compact navigation title, above `PEOPLE_SEARCH_STACK_SCALE`.
 *
 * Directive #37: this page "technically scrolls at large text but loses usable
 * viewport and hierarchy — People Search puts Cancel below the enlarged
 * title", and the remedy it names is a compact navigation bar.
 *
 * 22 is chosen so that the title AS DRAWN at the accessibility sizes — 22 ×
 * `MAX_DISPLAY_SCALE` — lands on 31, exactly the size the standard-size page
 * draws. The bar is then the same height at every setting, which is what
 * "compact" has to mean for a masthead that sits above a keyboard: this is a
 * `formSheet` with a focused field, so every point the title takes is a point
 * of the answer list, and the enlarged title was spending four of them on two
 * words the reader already knows.
 */
const TITLE_SIZE_COMPACT = 22;
const TITLE_LEADING_COMPACT = leading('instrument', TITLE_SIZE_COMPACT, 1.05);
const HEADLINE_SIZE = 31;
const HEADLINE_LEADING = leading('instrument', HEADLINE_SIZE, 1.1);

/** The row disc. Large enough to carry two initials at reading size. */
const DISC = 52;

/**
 * ── THE SECOND OVERLAP, AND IT WAS NOT A FLEX BUG ─────────────────────────
 *
 * Founder defect, 2026-08-18: "the 'Share your link' oxblood row is covering
 * the text above it". The first overlap on this page was a flex negotiation
 * inside a row (see the header); this one was a padding that never arrived.
 *
 * The scroll view declared its inset TWICE — `contentContainerClassName="pb-16"`
 * and `contentContainerStyle={{ paddingTop: 16 }}` — and NativeWind compiles
 * `contentContainerClassName` INTO `contentContainerStyle`. Two declarations of
 * one prop, with no precedence between them, is the same hazard this repository
 * has already written up twice: "NativeWind gives no precedence between two size
 * utilities on one element" (`components/ui/text.tsx`) and "a className on a
 * Reanimated component is silently dropped" (`app/(tabs)/index.tsx`). Whichever
 * of the two won, the other's value was gone — and the loser was the top inset,
 * so the oxblood row came to rest hard against the search field above it.
 *
 * Both numbers are stated once, in one prop, as points. `pb-16` was 64.
 */
const LIST_TOP = 16;
const LIST_BOTTOM = 64;

/**
 * How much further down the two invite rows sit, and how far apart.
 *
 * Not folded into `LIST_TOP`: that inset belongs to every state this scroll view
 * draws — the results, the skeleton, the empty page — and lowering all of them
 * to fix the resting page would push a list of names off the bottom of a small
 * screen. These two numbers are the resting page's own breathing room.
 *
 * Larger at an accessibility size, because both rows are taller there and the
 * subtitle is allowed to wrap: the crowding this fixes is a function of how much
 * ink is in the row, and at AX there is more of it.
 *
 * 2026-08-18, second pass: the founder looked at 14 and asked for the rows
 * "below the search box", plural and unambiguous — the offer is a destination,
 * not a continuation of the field. With `LIST_TOP` the first row now clears
 * the field by 50pt.
 *
 * 2026-08-21, third pass — the cards move BELOW the results. With the field
 * autofocused and the keyboard up, the two cards filled the visible viewport
 * and the founder read it as "covering everything I wanna see". So the field
 * and the RECENT list own the top of the page, and the two ways out sit under
 * them. `INVITE_TOP` now measures the cards' clearance from whatever is above
 * them — the RECENT list usually, or the field itself when there is nothing
 * recent to show (fine: with no list there is nothing for the cards to cover).
 */
const INVITE_TOP = 34;
const INVITE_TOP_AX = 44;
const INVITE_GAP = 14;
const INVITE_GAP_AX = 18;

export function PeopleSearchBody({
  view,
  large = false,
}: {
  view: PeopleSearchView;
  large?: boolean;
}) {
  const resting = showsInviteRows(view.query);
  const asked = isSearching(view.query);

  return (
    /**
     * ── THE THIRD OVERLAP, AND IT WAS NOT IN THIS FILE'S LAYOUT AT ALL ──────
     *
     * Founder defect, 2026-08-24: the oxblood row over the title again, and the
     * field nowhere — while every onLayout and measureInWindow in this tree
     * reported the geometry written here. The disagreement was native:
     * react-native-screens gives a `formSheet` special treatment when it finds
     * a ScrollView among its container's subviews, and RN's view flattening had
     * dissolved these wrappers so the sheet saw NINE subviews where it tolerates
     * two — its own warning says "apply `collapsable: false` on your header",
     * and without it the ScrollView was seated over the masthead. Both wrappers
     * below are therefore pinned as real native views: the outer one so the
     * sheet sees a single subview, the masthead so it survives as the "header"
     * if the outer one is ever unwrapped. Fast refresh does not rebuild the
     * native subview structure, so judge any edit here from a cold open of the
     * sheet, not a hot reload.
     */
    <View className="flex-1 bg-canvas" collapsable={false}>
      {/* The masthead does not scroll. The field is the page's subject and
          stays put while its answers move underneath it. */}
      <View className="px-gutter pt-1.5" collapsable={false}>
        <Masthead onCancel={view.onCancel} large={large} />
        {/* 20/24, up from 8/12 — founder call, 2026-08-24: with the title a
            step smaller the field crowded it, so it drops to clear air. The
            large-type value is now 20 as well: the 24 bought clear air under a
            43 pt title that no longer exists, and #37's complaint is about
            viewport, so the four points go back to the list. */}
        <View style={{ marginTop: 20 }}>
          <SearchField
            size="page"
            inputRef={view.inputRef}
            value={view.query}
            onChangeText={view.onChangeQuery}
            placeholder={COPY.searchPlaceholder}
            accessibilityLabel={COPY.searchPlaceholder}
            autoFocus={view.autoFocus}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* `flex-1` is load-bearing, not decoration. A ScrollView declares no
          flex of its own, so inside this column it would size to its CONTENT
          — and a scroll view whose frame equals its content scrolls nowhere.
          At the accessibility sizes, where the page is twice its own height,
          that is the difference between a usable screen and a truncated one.
          The auth screens set it for the same reason. */}
      {/* One declaration of the content inset, not two — see `LIST_TOP`. */}
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: LIST_TOP, paddingBottom: LIST_BOTTOM }}>
        {resting ? (
          <RestingState view={view} large={large} />
        ) : !asked ? (
          // One character: the invite rows have gone, and nothing has been
          // asked yet. Drawing a skeleton here would claim a request that
          // `useProfileSearch` has not made.
          null
        ) : view.error ? (
          <ErrorState view={view} large={large} />
        ) : view.loading ? (
          <LoadingState large={large} />
        ) : view.results.length === 0 ? (
          <EmptyState view={view} large={large} />
        ) : (
          <PeopleList rows={view.results} view={view} large={large} />
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

/**
 * Title and Cancel, on one row at every size.
 *
 * ── WHY CANCEL CAME BACK UP ───────────────────────────────────────────────
 *
 * This used to drop Cancel onto its own line above the accessibility
 * threshold, on the argument that "two things that cannot both fit are not
 * laid out side by side". The premise was the part that was wrong: they cannot
 * both fit only if the title insists on being 43 points tall. Directive #37
 * names the result — "People Search puts Cancel below the enlarged title" —
 * under the heading of pages that scroll at large text but lose hierarchy, and
 * the loss is real: the way out of a sheet stopped being where the way out of
 * every other sheet in the app is, and a page whose whole job is one field
 * spent two lines on its own name.
 *
 * So the title goes compact instead (`TITLE_SIZE_COMPACT`) and the row holds.
 * The measure still gives; the title still shortens rather than pushing Cancel
 * off its edge, because `minWidth: 0` is still what does that.
 */
function Masthead({ onCancel, large }: { onCancel: () => void; large: boolean }) {
  const theme = useTheme();

  const titleSize = large ? TITLE_SIZE_COMPACT : TITLE_SIZE;
  const titleLeading = large ? TITLE_LEADING_COMPACT : TITLE_LEADING;

  const title = (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
      variant="display"
      // `trim` reads the VARIANT's table, which is set for 40 — so the cap
      // trim for the size actually drawn is computed here instead.
      style={{
        fontSize: titleSize,
        lineHeight: titleLeading,
        ...capTrim('instrument', titleSize, titleLeading),
      }}>
      {COPY.title}
    </Text>
  );

  const cancel = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close search"
      onPress={onCancel}
      hitSlop={12}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
      className="active:opacity-60">
      <Text variant="body" style={{ color: theme.accent }}>
        {COPY.cancel}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-row items-end justify-between gap-3">
      {/* minWidth 0 so a grown title shortens itself rather than pushing
          Cancel off its own edge — the defect, in its other habitat. */}
      <View style={{ flex: 1, minWidth: 0 }}>{title}</View>
      <View style={{ flexShrink: 0 }}>{cancel}</View>
    </View>
  );
}

/** The page at rest: who you looked for last, then two ways out. */
function RestingState({ view, large }: { view: PeopleSearchView; large: boolean }) {
  return (
    <View>
      {/* RECENT first — see the 2026-08-21 note on `INVITE_TOP`. With the
          keyboard up the visible viewport is short, and the list is what the
          founder opens this page to see. */}
      {view.recent.length > 0 ? (
        <View>
          <RecentHeader large={large} />
          <PeopleList rows={view.recent} view={view} large={large} />
        </View>
      ) : null}

      {/* Both rows sit clear of whatever is above them — the list, or the
          field itself when nothing is recent — and clear of each other. The
          AX path takes the same treatment at its own sizes: the rows grow
          there, so the space between them has to as well. */}
      <View
        className="px-gutter"
        style={{
          paddingTop: large ? INVITE_TOP_AX : INVITE_TOP,
          gap: large ? INVITE_GAP_AX : INVITE_GAP,
        }}>
        <InviteRow
          tone="primary"
          heading={COPY.shareHeading}
          subtitle={shareSubtitle(view.shareHandle)}
          glyph="square.and.arrow.up"
          onPress={view.onShare}
          large={large}
        />
        <InviteRow
          tone="secondary"
          heading={COPY.inviteHeading}
          subtitle={COPY.inviteSubtitle}
          glyph="person.badge.plus"
          onPress={view.onShare}
          large={large}
        />
      </View>
    </View>
  );
}

/** The RECENT mark: a tracked cap on sand, and a rule running out from it. */
function RecentHeader({ large }: { large: boolean }) {
  const theme = useTheme();
  return (
    <View
      className="px-gutter"
      style={{
        flexDirection: large ? 'column' : 'row',
        alignItems: large ? 'flex-start' : 'center',
        gap: 12,
      }}>
      <View className="rounded-lg bg-sand" style={{ paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text variant="eyebrow" style={{ color: theme.accent }}>
          {COPY.recent}
        </Text>
      </View>
      {large ? null : <View className="h-hair flex-1 bg-sand" />}
    </View>
  );
}

/**
 * One of the two ways off this page when a username is not the answer.
 *
 * Both go to Share. The oxblood one spends the page's single accent — it is
 * the growth loop's own door — and the blush one sits under it as the second
 * reading of the same offer.
 */
function InviteRow({
  tone,
  heading,
  subtitle,
  glyph,
  onPress,
  large,
}: {
  tone: 'primary' | 'secondary';
  heading: string;
  subtitle: string;
  glyph: SymbolViewProps['name'];
  onPress: () => void;
  large: boolean;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={`${heading}. ${subtitle}`}
      onPress={onPress}
      className="rounded-lg"
      style={{ backgroundColor: primary ? theme.accent : theme.blush }}
      contentStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 18,
        paddingVertical: 18,
      }}>
      {/* At large type the tile and the chevron go: the two lines of words
          are the row, and furniture that costs them their measure is not
          worth its own 44 points. */}
      {large ? null : (
        <View
          className="items-center justify-center rounded-lg"
          style={{ width: 44, height: 44, backgroundColor: theme.canvas, flexShrink: 0 }}>
          <SymbolView
            name={glyph}
            size={20}
            tintColor={primary ? theme.accent : theme.accentWarm}
            resizeMode="scaleAspectFit"
          />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="body" style={{ color: primary ? theme.canvas : theme.ink }}>
          {heading}
        </Text>
        <Text
          variant="label"
          numberOfLines={large ? undefined : 1}
          style={{ fontSize: 13, lineHeight: 18, color: primary ? theme.blush : theme.muted }}>
          {subtitle}
        </Text>
      </View>

      {large ? null : (
        <SymbolView
          name="chevron.right"
          size={13}
          tintColor={primary ? theme.blush : theme.accent}
          resizeMode="scaleAspectFit"
        />
      )}
    </PressableSurface>
  );
}

/** Results and recents draw the same row — they are the same kind of thing. */
function PeopleList({
  rows,
  view,
  large,
}: {
  rows: PeopleRow[];
  view: PeopleSearchView;
  large: boolean;
}) {
  return (
    <View className="px-gutter">
      {rows.map((row) => (
        <PersonRow key={row.userId} row={row} view={view} large={large} />
      ))}
    </View>
  );
}

function PersonRow({
  row,
  view,
  large,
}: {
  row: PeopleRow;
  view: PeopleSearchView;
  large: boolean;
}) {
  const theme = useTheme();
  const name = profileName(row);
  const handle = row.username ? `@${row.username}` : null;

  const identity = (
    <>
      <Avatar
        name={name}
        size={DISC}
        tone={row.state === 'add' ? 'sand' : 'accent'}
        imageUri={row.avatarUrl}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="body" numberOfLines={large ? undefined : 1}>
          {name}
        </Text>
        {handle ? (
          <Text
            variant="label"
            numberOfLines={large ? undefined : 1}
            style={{ fontSize: 14, lineHeight: 19, color: theme.muted }}>
            {handle}
          </Text>
        ) : null}
      </View>
    </>
  );

  const control = <RowControl row={row} view={view} large={large} />;

  /**
   * Whether this row is a door.
   *
   * The brief says a result card opens that person's profile, and it does —
   * for everyone there is a profile to open. `/friends/[userId]` is the
   * friend CLOSET, and its contents come through the privacy layer: pushing a
   * stranger onto it produces a page titled "A friend" with nothing in it,
   * because RLS is doing exactly what it should. So a person you are not
   * friends with is not a link, and their row's action is the Add beside it —
   * which is the action the accepted results frame draws anyway.
   *
   * This preserves the gate the screen already shipped rather than inventing
   * a public profile surface, which would be a new page with new privacy
   * questions and is nowhere in this brief.
   */
  const openable = row.state === 'friends';

  return (
    <Pressable
      accessibilityRole={openable ? 'button' : 'text'}
      accessibilityLabel={[name, handle].filter(Boolean).join(', ')}
      onPress={openable ? () => view.onOpenProfile(row) : undefined}
      disabled={!openable}
      className={`border-b border-hairline ${openable ? 'active:opacity-60' : ''}`}
      style={{ minHeight: MIN_TAP_TARGET, paddingVertical: 13 }}>
      {large ? (
        // Stacked, and the control goes full width: at this size a row of
        // three things across a 393pt measure is what produced the overlap
        // in the first place.
        <View style={{ gap: 10 }}>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            {identity}
          </View>
          {control}
        </View>
      ) : (
        <View className="flex-row items-center" style={{ gap: 14 }}>
          {identity}
          {/* flexShrink 0 — the trailing control keeps its points, and the
              name column above is the one that gives. */}
          <View style={{ flexShrink: 0 }}>{control}</View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * What the right edge of a row says about where things stand.
 *
 * Only `add` is a control. Friends, Requested and You are statements — a
 * pressable that cannot do anything is worse than a word that explains why.
 */
function RowControl({
  row,
  view,
  large,
}: {
  row: PeopleRow;
  view: PeopleSearchView;
  large: boolean;
}) {
  const theme = useTheme();

  if (row.state === 'add') {
    return (
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={`${COPY.add} ${profileName(row)}`}
        disabled={view.adding}
        busy={view.adding}
        onPress={() => view.onAdd(row)}
        className="rounded-md"
        style={{ backgroundColor: theme.blush, alignSelf: large ? 'stretch' : 'auto' }}
        contentStyle={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: MIN_TAP_TARGET,
          paddingHorizontal: 18,
        }}>
        <Text variant="body" style={{ fontSize: 15, lineHeight: 20, color: theme.accent }}>
          {COPY.add}
        </Text>
      </PressableSurface>
    );
  }

  const label =
    row.state === 'friends'
      ? COPY.friends
      : row.state === 'requested'
        ? STATE_COPY.requested
        : STATE_COPY.you;

  return (
    <View
      className="rounded-md bg-tray"
      style={{
        paddingHorizontal: 13,
        paddingVertical: 9,
        alignItems: 'center',
        alignSelf: large ? 'stretch' : 'auto',
      }}>
      <Text variant="label" style={{ fontSize: 13, lineHeight: 18, color: theme.muted }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Waiting. The result row with its content withheld, at the same heights and
 * the same disc — so nothing moves when the names land.
 *
 * No spinner, by rule: a spinning thing cannot reproduce itself in a
 * screenshot, and `Skeleton` already parks its sweep under Reduce Motion.
 */
function LoadingState({ large }: { large: boolean }) {
  const widths: [`${number}%`, `${number}%`][] = [
    ['62%', '34%'],
    ['48%', '26%'],
    ['70%', '40%'],
  ];

  return (
    <View className="px-gutter" accessibilityRole="progressbar" accessibilityLabel="Searching">
      {widths.map(([wide, narrow], i) => (
        <View
          key={wide + narrow}
          className="border-b border-hairline"
          style={{ paddingVertical: 15 }}>
          <View
            style={{
              flexDirection: large ? 'column' : 'row',
              alignItems: large ? 'stretch' : 'center',
              gap: large ? 10 : 14,
            }}>
            {/* `flex: 1` + `minWidth: 0` on the identity half, exactly as the
                real row has them — without it the bars size to their own
                content and shove the trailing block off the measure, which is
                the very defect these skeletons stand in for. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                flex: large ? undefined : 1,
                minWidth: 0,
              }}>
              <Skeleton
                delay={i * 120}
                style={{ width: DISC, height: DISC, borderRadius: DISC / 2, flexShrink: 0 }}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <Skeleton delay={i * 120} style={{ height: 13, width: wide, borderRadius: 7 }} />
                <Skeleton delay={i * 120} style={{ height: 11, width: narrow, borderRadius: 6 }} />
              </View>
            </View>
            <Skeleton
              delay={i * 120}
              style={{
                width: large ? undefined : 66,
                height: MIN_TAP_TARGET,
                borderRadius: 12,
                flexShrink: 0,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A restrained mark, a sentence about what Cinch can and cannot look up. */
function EmptyState({ view, large }: { view: PeopleSearchView; large: boolean }) {
  const theme = useTheme();
  const term = searchTerm(view.query);

  return (
    <View>
      <View className="px-bare" style={{ paddingTop: 20, gap: 14 }}>
        <View
          className="items-center justify-center rounded-full bg-blush"
          style={{ width: 104, height: 104 }}>
          <View
            className="rounded-full"
            style={{ width: 34, height: 34, borderWidth: 3, borderColor: theme.accentWarm }}
          />
        </View>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          variant="display"
          style={{ fontSize: HEADLINE_SIZE, lineHeight: HEADLINE_LEADING }}>
          {COPY.emptyHeadline}
        </Text>
        <Text variant="body" style={{ fontSize: 15, lineHeight: 22, color: theme.muted }}>
          {COPY.emptyBody}
        </Text>
      </View>

      <View className="px-gutter" style={{ paddingTop: 26 }}>
        <InviteRow
          tone="primary"
          heading={inviteHeadingFor(term)}
          subtitle={COPY.emptySubtitle}
          glyph="square.and.arrow.up"
          onPress={view.onShare}
          large={large}
        />
      </View>
    </View>
  );
}

/**
 * The search that did not go out.
 *
 * The copy says the same thing whatever went wrong — the request either did
 * not complete or its answer did not arrive, and either way nothing was
 * written. Only the OFFLINE mark is gated on the failure's shape, because it
 * is the only part of this page making a claim about the network.
 */
function ErrorState({ view, large }: { view: PeopleSearchView; large: boolean }) {
  const theme = useTheme();

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite">
      {isOfflineLike(view.error) ? (
        <View className="px-gutter">
          <View
            className="flex-row items-center self-start rounded-lg"
            style={{
              gap: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: warningAlpha(0.22),
            }}>
            <View
              className="rounded-full"
              style={{ width: 8, height: 8, backgroundColor: theme.warning }}
            />
            <Text variant="eyebrow" style={{ color: theme.ink }}>
              {COPY.offline}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="px-bare" style={{ paddingTop: 20, gap: 12 }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          variant="display"
          style={{ fontSize: HEADLINE_SIZE, lineHeight: HEADLINE_LEADING }}>
          {COPY.errorHeadline}
        </Text>
        <Text variant="body" style={{ fontSize: 15, lineHeight: 22, color: theme.muted }}>
          {COPY.errorBody}
        </Text>
      </View>

      <View className="px-gutter" style={{ paddingTop: 26, gap: 12 }}>
        <ErrorAction tone="primary" label={COPY.tryAgain} onPress={view.onRetry} />
        <ErrorAction tone="secondary" label={COPY.shareInstead} onPress={view.onShare} />
      </View>
    </View>
  );
}

function ErrorAction({
  tone,
  label,
  onPress,
}: {
  tone: 'primary' | 'secondary';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const primary = tone === 'primary';

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="rounded-lg"
      style={{ backgroundColor: primary ? theme.accent : theme.blush }}
      contentStyle={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}>
      <Text variant="body" style={{ color: primary ? theme.canvas : theme.accent }}>
        {label}
      </Text>
    </PressableSurface>
  );
}
