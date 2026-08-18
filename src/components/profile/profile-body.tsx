import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { QuadrantPlate } from '@/components/boards/quadrant-plate';
import { GarmentImage } from '@/components/media/garment-image';
import { Avatar } from '@/components/ui/avatar';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  AVATAR_SIZE,
  AVATAR_SIZE_AX,
  BAND_DOT,
  BAND_RADIUS,
  CLOSET_COLUMNS,
  CLOSET_COLUMNS_AX,
  CLOSET_GAP,
  CHEVRON_SIZE,
  CHEVRON_SIZE_AX,
  CLOSET_TILE_HEIGHT,
  CLOSET_TILE_HEIGHT_AX,
  CTA_MIN_HEIGHT,
  CTA_RADIUS,
  FAVORITE_DOT,
  FAVORITE_DOT_INNER,
  FRIENDS_RADIUS,
  FRIENDS_ROW_MIN_HEIGHT_AX,
  FRIENDS_ROW_RADIUS_AX,
  GHOST_COLUMNS,
  GHOST_SHAPES,
  GHOST_TILE_HEIGHT,
  GHOST_TILE_HEIGHT_FAVORITES,
  IDENTITY_GAP,
  MARK_RADIUS,
  MARK_SKELETON_HEIGHT,
  MENU_RADIUS,
  MENU_WIDTH,
  MORE_DOT,
  MORE_RADIUS,
  MORE_SIZE,
  PLAN_ROW_MIN_HEIGHT,
  PLAN_ROW_MIN_HEIGHT_AX,
  PLAN_ROW_RADIUS,
  PLAN_TRACK_HEIGHT,
  PLAN_TRACK_WIDTH,
  PROFILE_COPY,
  RAIL_GAP,
  RAIL_GAP_AX,
  RAIL_TILE_HEIGHT,
  RAIL_TILE_HEIGHT_AX,
  RAIL_TILE_RADIUS,
  RAIL_TILE_WIDTH,
  RAIL_TILE_WIDTH_AX,
  favoritesPrivacyLine,
  friendsLabel,
  friendsTone,
  type PlanDoor,
  type ProfileBodyState,
  type StatMark,
} from '@/features/profile/profile-spec';
import { GUTTER, MIN_TAP_TARGET, motion, shadow, useTheme, warningAlpha } from '@/theme/tokens';

/**
 * Profile — your own room. Redesign 07, drawn.
 *
 * A pure function of `view`, the split every page in this wave makes: the route
 * holds seven queries and hands one plain object down, so the six accepted
 * frames can be posed and photographed without a session. Nothing in this file
 * fetches, and nothing in it decides — every string and every branch comes from
 * `features/profile/profile-spec.ts`.
 *
 * ── THE ORDER ────────────────────────────────────────────────────────────────
 *
 * Identity, Most worn, Favorite outfits, the marks, the plan door, the closet
 * grid. That is the founder's spec in directive §7 and it is not negotiable, so
 * it is drawn top to bottom in this file in exactly that sequence and pinned by
 * `PROFILE_SECTIONS` in the spec.
 *
 * ── WHAT THE ARTIFACT DREW THAT iOS WOULD NOT LET US KEEP ────────────────────
 *
 * The frames sit a tab bar under the page and mark a "You" tab. Profile is not
 * a tab in this app and is not becoming one — it is the form sheet off Today's
 * masthead avatar, presented with a grabber — so the tab bar is absent and the
 * closet grid bleeds into the sheet's own bottom safe area instead of under
 * four tab labels. The sheet also needs a visible way out, which the frames had
 * no reason to draw: a single "Done" rides the grabber line above the identity
 * block. Both are recorded in the build report.
 */

// ---------------------------------------------------------------------------
// The view — what the route hands down
// ---------------------------------------------------------------------------

/** One garment on the Most worn rail. */
export type RailTile = {
  id: string;
  name: string;
  uri?: string;
};

/** One look on the Favorite outfits rail — the collage, never a single piece. */
export type FavoriteTile = {
  id: string;
  name: string;
  uris: readonly (string | null | undefined)[];
  pieceCount: number;
};

/** One photograph in the tight grid at the foot. */
export type ClosetTile = {
  id: string;
  name: string;
  uri?: string;
};

export type ProfileView = {
  state: ProfileBodyState;

  // ── Identity, drawn on every frame ─────────────────────────────────────
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  /** The header read failed. The row keeps its shape and offers the retry. */
  identityFailed: boolean;
  onRetryIdentity: () => void;
  /** `undefined` until the friends read lands — never rendered as a zero. */
  friends: number | undefined;
  onOpenFriends: () => void;

  // ── The overflow menu, which is where the administration went ──────────
  menuOpen: boolean;
  onOpenMenu: () => void;
  onDismissMenu: () => void;
  onEditProfile: () => void;
  onOpenDiary: () => void;
  onOpenSettings: () => void;
  /**
   * The gear's own name, passed in rather than typed here.
   *
   * `SETTINGS_TITLE` is the pushed route's serif title and the label the
   * capability reconciliation looks for on the surface that owns the door, so
   * it stays at the call site in `app/profile.tsx` where that check reads.
   */
  settingsLabel: string;
  onDone: () => void;

  // ── The content, in order ──────────────────────────────────────────────
  mostWorn: RailTile[];
  favorites: FavoriteTile[];
  marks: StatMark[];
  /** The one surviving line of the "What Cinch has learned" card, or nothing. */
  learned: string | null;
  planDoor: PlanDoor | null;
  /** A paywall was asked for and never arrived, so the row is never dead. */
  planUnavailable: boolean;
  planUnavailableLine: string;
  onPlanDoor: () => void;
  closet: ClosetTile[];
  onOpenCloset: () => void;
  onOpenItem: (id: string) => void;
  onOpenFavorite: (id: string) => void;

  // ── Recovery ───────────────────────────────────────────────────────────
  onRetry: () => void;
  onAddClothes: () => void;

  /**
   * The first-visit coaching card, mounted by the route when it is still owed.
   *
   * A slot rather than a flag: PR-C1's card is a component with its own
   * dismissal state, and the frames are the steady state that comes after it.
   */
  coaching?: React.ReactNode;
};

// ---------------------------------------------------------------------------
// Chrome — the sheet's way out, and the overflow control
// ---------------------------------------------------------------------------

/**
 * The way out of a form sheet.
 *
 * The artifact drew Profile as a tab and had no need for one; this app presents
 * it over Today, where the only other dismissal is the system swipe. A modal
 * with no visible exit is the interaction failure users report as being stuck,
 * so the control the pre-redesign screen added survives — alone now, without
 * the serif page title and the gear that used to flank it.
 */
function DoneRow({ onDone }: { onDone: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: GUTTER,
        paddingTop: 18,
        flexShrink: 0,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={PROFILE_COPY.done}
        onPress={onDone}
        hitSlop={12}
        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
        <Text variant="label" className="text-accent">
          {PROFILE_COPY.done}
        </Text>
      </Pressable>
    </View>
  );
}

/** The three-dot square at the end of the identity row. */
function MoreButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={PROFILE_COPY.more}
      accessibilityHint={PROFILE_COPY.moreHint}
      onPress={onPress}
      fill
      style={{
        width: MORE_SIZE,
        minHeight: MORE_SIZE,
        borderRadius: MORE_RADIUS,
        backgroundColor: theme.tray,
        flexShrink: 0,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}>
      {[0, 1, 2].map((dot) => (
        <View
          key={dot}
          style={{
            width: MORE_DOT,
            height: MORE_DOT,
            borderRadius: MORE_DOT / 2,
            backgroundColor: theme.ink,
          }}
        />
      ))}
    </PressableSurface>
  );
}

/**
 * The overflow menu — an anchored card, in the shape the closet's own menu set.
 *
 * Everything administrative left Profile for `/settings` in UX-05 and stays
 * there; what this menu holds is the three doors OFF this page — the fields
 * other people see, the record of what was worn, and the gear. A positioned
 * card rather than `ActionSheetIOS`, because the app already draws exactly one
 * of these and two grammars for one gesture is worse than either.
 */
function MenuRow({
  label,
  separated,
  onPress,
}: {
  label: string;
  separated?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { style, onPressIn, onPressOut } = usePressFeedback();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View
        style={[
          style,
          {
            minHeight: MIN_TAP_TARGET,
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingVertical: 13,
          },
          separated ? { borderBottomWidth: 1, borderBottomColor: theme.hairline } : null,
        ]}>
        <Text variant="label" style={{ color: theme.ink }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function ProfileMenu({
  onDismiss,
  onEditProfile,
  onOpenDiary,
  onOpenSettings,
  settingsLabel,
}: {
  onDismiss: () => void;
  onEditProfile: () => void;
  onOpenDiary: () => void;
  onOpenSettings: () => void;
  settingsLabel: string;
}) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.fast)}
      exiting={FadeOut.duration(motion.duration.fast)}
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      pointerEvents="auto">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss menu"
      />
      {/* The shadow rides the wrapper; the clipping happens one layer down. A
          view that clips its children also clips its own shadow away. */}
      <View
        style={{
          position: 'absolute',
          top: 8,
          right: GUTTER,
          width: MENU_WIDTH,
          borderRadius: MENU_RADIUS,
          shadowColor: theme.ink,
          shadowOpacity: 0.18,
          shadowRadius: shadow.contact.blur * 2.9,
          shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy * 2.9 },
        }}>
        <View className="overflow-hidden rounded-lg border border-rule bg-surface">
          <MenuRow label={PROFILE_COPY.editProfile} separated onPress={onEditProfile} />
          <MenuRow label={PROFILE_COPY.diary} separated onPress={onOpenDiary} />
          <MenuRow label={settingsLabel} onPress={onOpenSettings} />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Identity — avatar, name, handle, and the friends count that is a door
// ---------------------------------------------------------------------------

function FriendsPill({
  count,
  large,
  onPress,
}: {
  count: number | undefined;
  large: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label = friendsLabel(count);
  const tone = friendsTone(count);

  // Nothing yet is nothing drawn. A pill that says "No friends yet" while the
  // read is still in flight is the app inventing an absence.
  if (label === null) return null;

  const ground = tone === 'accent' ? theme.blush : theme.tray;
  const ink = tone === 'accent' ? theme.accent : theme.muted;

  if (large) {
    return (
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={PROFILE_COPY.friendsHint}
        onPress={onPress}
        style={{
          borderRadius: FRIENDS_ROW_RADIUS_AX,
          backgroundColor: ground,
          minHeight: FRIENDS_ROW_MIN_HEIGHT_AX,
        }}
        contentStyle={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}>
        <Text variant="heading" style={{ color: ink, flexShrink: 1 }}>
          {label}
        </Text>
        <Chevron tone={tone} large />
      </PressableSurface>
    );
  }

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={PROFILE_COPY.friendsHint}
      onPress={onPress}
      style={{ borderRadius: FRIENDS_RADIUS, backgroundColor: ground, flexShrink: 1 }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
      }}>
      <Text variant="label" numberOfLines={1} style={{ color: ink }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/** The pointer on a row that leads somewhere. Two hairlines, rotated. */
function Chevron({ tone = 'accent', large = false }: { tone?: 'accent' | 'quiet'; large?: boolean }) {
  const theme = useTheme();
  const size = large ? CHEVRON_SIZE_AX : CHEVRON_SIZE;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRightWidth: 2,
        borderTopWidth: 2,
        borderColor: tone === 'accent' ? theme.accent : theme.muted,
        transform: [{ rotate: '45deg' }],
        flexShrink: 0,
      }}
    />
  );
}

function Identity({ view, large }: { view: ProfileView; large: boolean }) {
  const name = view.identityFailed ? 'Your profile' : view.name;

  const face = (
    <Avatar
      name={name}
      size={large ? AVATAR_SIZE_AX : AVATAR_SIZE}
      // The artifact sets the monogram in oxblood on a warm ground, not in
      // canvas on ink — `accent` is that tone, and it is the shared Avatar's
      // own, so nothing about the component moves to get it.
      tone="accent"
      imageUri={view.avatarUrl}
    />
  );

  const handle = view.identityFailed ? (
    <Pressable
      accessibilityRole="button"
      onPress={view.onRetryIdentity}
      hitSlop={12}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}>
      <Text variant="note" className="underline">
        Your details didn’t load — try again
      </Text>
    </Pressable>
  ) : view.handle ? (
    <Text variant="note" numberOfLines={large ? undefined : 1}>
      {view.handle}
    </Text>
  ) : null;

  // At the largest sizes the row stacks: the serif takes the width it needs,
  // and the friends count leaves the line entirely for a full-width row of its
  // own. Composition changes; nothing is capped or ellipsised to make it fit.
  if (large) {
    return (
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: IDENTITY_GAP }}>
          {face}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 3 }}>
              {name}
            </Text>
            {handle}
          </View>
          <MoreButton onPress={view.onOpenMenu} />
        </View>
        <FriendsPill count={view.friends} large onPress={view.onOpenFriends} />
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 2,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: IDENTITY_GAP,
      }}>
      {face}
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text variant="title" trim accessibilityRole="header" numberOfLines={1}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {handle}
          <FriendsPill count={view.friends} large={false} onPress={view.onOpenFriends} />
        </View>
      </View>
      <MoreButton onPress={view.onOpenMenu} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The rails
// ---------------------------------------------------------------------------

/** A section signature, set in its own area accent rather than in grey. */
function RailHeader({ title, tone }: { title: string; tone: 'accent' | 'warm' }) {
  const theme = useTheme();
  return (
    <View style={{ paddingLeft: GUTTER, paddingRight: GUTTER, paddingBottom: 6, flexShrink: 0 }}>
      <Text
        variant="eyebrow"
        accessibilityRole="header"
        style={{ color: tone === 'accent' ? theme.accent : theme.accentWarm }}>
        {title}
      </Text>
    </View>
  );
}

/** The ground a garment sits on when it has no photograph of its own. */
function TileFallback() {
  return <View className="flex-1 bg-sand" style={{ minWidth: 0 }} />;
}

function MostWornRail({
  tiles,
  large,
  onOpenItem,
}: {
  tiles: RailTile[];
  large: boolean;
  onOpenItem: (id: string) => void;
}) {
  const theme = useTheme();
  if (tiles.length === 0) return null;

  const width = large ? RAIL_TILE_WIDTH_AX : RAIL_TILE_WIDTH;
  const height = large ? RAIL_TILE_HEIGHT_AX : RAIL_TILE_HEIGHT;

  return (
    <View style={{ flexShrink: 0 }}>
      <RailHeader title={PROFILE_COPY.mostWorn} tone="accent" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: large ? RAIL_GAP_AX : RAIL_GAP,
          paddingHorizontal: GUTTER,
        }}>
        {tiles.map((tile) => (
          <PressableSurface
            key={tile.id}
            accessibilityRole="button"
            accessibilityLabel={tile.name}
            onPress={() => onOpenItem(tile.id)}
            fill
            style={{ width, flexShrink: 0 }}
            contentStyle={{ flex: 1, minWidth: 0, gap: large ? 8 : 6 }}>
            <View
              style={{
                height,
                borderRadius: RAIL_TILE_RADIUS,
                overflow: 'hidden',
                backgroundColor: theme.sand,
              }}>
              <GarmentImage
                uri={tile.uri}
                contentFit="cover"
                style={{ flex: 1, minWidth: 0 }}
                fallback={<TileFallback />}
              />
            </View>
            <Text
              variant={large ? 'body' : 'caption'}
              numberOfLines={large ? undefined : 1}
              style={large ? { color: theme.ink } : undefined}>
              {tile.name}
            </Text>
          </PressableSurface>
        ))}
      </ScrollView>
    </View>
  );
}

/** The mark that says a look was kept. Private, and drawn rather than written. */
function FavoriteMark() {
  const theme = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 7,
        right: 7,
        width: FAVORITE_DOT,
        height: FAVORITE_DOT,
        borderRadius: FAVORITE_DOT / 2,
        backgroundColor: theme.blush,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: FAVORITE_DOT_INNER,
          height: FAVORITE_DOT_INNER,
          borderRadius: 2,
          backgroundColor: theme.accent,
        }}
      />
    </View>
  );
}

/**
 * Favorite outfits — owner-private, and at the largest type a sentence.
 *
 * The privacy is a property of the data (`outfits.favorited_at` is never in the
 * public view), and on the standard frame the rail carries it by being a rail
 * of the reader's own looks with no share affordance anywhere on it. At
 * accessibility sizes the tiles would take the whole screen for four squares,
 * so the section says the fact in words instead — which is the one place on
 * this page where large type gets MORE information rather than less.
 */
function FavoritesRail({
  tiles,
  large,
  onOpenFavorite,
}: {
  tiles: FavoriteTile[];
  large: boolean;
  onOpenFavorite: (id: string) => void;
}) {
  const theme = useTheme();
  if (tiles.length === 0) return null;

  if (large) {
    const line = favoritesPrivacyLine(tiles.length);
    return (
      <View style={{ paddingTop: 20, flexShrink: 0 }}>
        <RailHeader title={PROFILE_COPY.favorites} tone="warm" />
        <View style={{ paddingHorizontal: GUTTER }}>
          <Text variant="body" className="text-muted">
            {line}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 16, flexShrink: 0 }}>
      <RailHeader title={PROFILE_COPY.favorites} tone="warm" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: RAIL_GAP, paddingHorizontal: GUTTER }}>
        {tiles.map((tile) => (
          <PressableSurface
            key={tile.id}
            accessibilityRole="button"
            accessibilityLabel={tile.name}
            onPress={() => onOpenFavorite(tile.id)}
            fill
            style={{ width: RAIL_TILE_WIDTH, flexShrink: 0 }}
            contentStyle={{ flex: 1, minWidth: 0, gap: 6 }}>
            <View
              style={{
                height: RAIL_TILE_HEIGHT,
                borderRadius: RAIL_TILE_RADIUS,
                overflow: 'hidden',
                backgroundColor: theme.tray,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {/* Sized to the tile's WIDTH, not its height: the collage is
                  square and the tile is six points taller, so sizing it to the
                  height would clip three points off each side of every look. */}
              <QuadrantPlate
                size={RAIL_TILE_WIDTH}
                pieceCount={tile.pieceCount}
                imageUris={tile.uris}
              />
              <FavoriteMark />
            </View>
            <Text variant="caption" numberOfLines={1}>
              {tile.name}
            </Text>
          </PressableSurface>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The marks, and the one line that survived the card above them
// ---------------------------------------------------------------------------

function Marks({ marks, large }: { marks: StatMark[]; large: boolean }) {
  const theme = useTheme();
  if (marks.length === 0) return null;

  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 12,
        flexDirection: large ? 'column' : 'row',
        gap: 8,
        flexShrink: 0,
      }}>
      {marks.map((mark) => (
        <View
          key={mark.id}
          // One sentence per mark for VoiceOver — "84, pieces" reads as a fact
          // where a bare figure followed later by a bare word reads as noise.
          accessible
          accessibilityLabel={`${mark.figure}, ${mark.label}`}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: mark.accent ? theme.blush : theme.tray,
            borderRadius: MARK_RADIUS,
            paddingHorizontal: 13,
            paddingTop: 12,
            paddingBottom: 14,
            gap: 3,
          }}>
          <Text
            variant="statFigure"
            style={{ color: mark.accent ? theme.accent : theme.ink, paddingBottom: 2 }}>
            {mark.figure}
          </Text>
          {/* Clay never carries type — `theme.accentWarm` is 2.98:1 and
              `theme/contrast.ts` declares it `text: false`. The artifact's clay
              mark label becomes `muted`, which is one step darker and passes. */}
          <Text variant="colophon">{mark.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The sentence the "What Cinch has learned" card was carrying. */
function LearnedLine({ line }: { line: string }) {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, flexShrink: 0 }}>
      <Text variant="note">{line}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The plan door — one quiet row
// ---------------------------------------------------------------------------

function PlanRow({
  door,
  large,
  onPress,
}: {
  door: PlanDoor;
  large: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const ground = door.tone === 'blush' ? theme.blush : theme.tray;

  const inner = (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          minWidth: 0,
        }}>
        {door.tone === 'blush' ? (
          <View
            style={{
              width: PLAN_TRACK_WIDTH,
              height: PLAN_TRACK_HEIGHT,
              borderRadius: PLAN_TRACK_HEIGHT / 2,
              overflow: 'hidden',
              backgroundColor: theme.sand,
              flexShrink: 0,
            }}>
            <View
              style={{
                width: `${Math.round(door.fill * 100)}%`,
                height: PLAN_TRACK_HEIGHT,
                backgroundColor: theme.accent,
              }}
            />
          </View>
        ) : null}
        <Text variant="callout" numberOfLines={large ? undefined : 1} style={{ flexShrink: 1 }}>
          {door.line}
        </Text>
      </View>
      {door.action ? (
        <Text variant="label" style={{ color: theme.accent, flexShrink: 0 }}>
          {door.action}
        </Text>
      ) : door.route === 'none' ? null : (
        <Chevron large={large} />
      )}
    </>
  );

  const shape = {
    borderRadius: PLAN_ROW_RADIUS,
    backgroundColor: ground,
    minHeight: large ? PLAN_ROW_MIN_HEIGHT_AX : PLAN_ROW_MIN_HEIGHT,
  };
  const content = {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: large ? 14 : 8,
  };

  // A Pro member's row is a fact, not a control: the screen this replaces never
  // offered a membership door to somebody already on the top plan, and drawing
  // one now would be selling nothing to somebody who bought everything.
  if (door.route === 'none') {
    return (
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, flexShrink: 0 }}>
        <View accessible accessibilityLabel={door.line} style={[shape, content]}>
          {inner}
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, flexShrink: 0 }}>
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={door.line}
        accessibilityHint={
          door.route === 'manage' ? 'Opens your membership' : 'Opens the membership options'
        }
        onPress={onPress}
        style={shape}
        contentStyle={content}>
        {inner}
      </PressableSurface>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The closet, at the bottom, bled to both edges
// ---------------------------------------------------------------------------

function ClosetHeader({ onSeeAll }: { onSeeAll: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: GUTTER,
        paddingTop: 12,
        paddingBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}>
      <Text variant="eyebrow" accessibilityRole="header" style={{ color: theme.accent }}>
        {PROFILE_COPY.closet}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={PROFILE_COPY.seeAll}
        accessibilityHint="Opens your closet"
        onPress={onSeeAll}
        hitSlop={12}
        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', flexShrink: 0 }}>
        <Text variant="label">{PROFILE_COPY.seeAll}</Text>
      </Pressable>
    </View>
  );
}

function ClosetGrid({
  tiles,
  large,
  onOpenItem,
}: {
  tiles: ClosetTile[];
  large: boolean;
  onOpenItem: (id: string) => void;
}) {
  const theme = useTheme();
  if (tiles.length === 0) return null;

  const columns = large ? CLOSET_COLUMNS_AX : CLOSET_COLUMNS;
  const height = large ? CLOSET_TILE_HEIGHT_AX : CLOSET_TILE_HEIGHT;

  const rows: ClosetTile[][] = [];
  for (let i = 0; i < tiles.length; i += columns) rows.push(tiles.slice(i, i + columns));

  return (
    <View style={{ gap: CLOSET_GAP, flexShrink: 0 }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: CLOSET_GAP }}>
          {row.map((tile) => (
            <PressableSurface
              key={tile.id}
              accessibilityRole="button"
              accessibilityLabel={tile.name}
              onPress={() => onOpenItem(tile.id)}
              fill
              style={{ flex: 1, minWidth: 0, height, backgroundColor: theme.sand }}
              contentStyle={{ flex: 1, minWidth: 0 }}>
              <GarmentImage
                uri={tile.uri}
                contentFit="cover"
                style={{ flex: 1, minWidth: 0 }}
                fallback={<TileFallback />}
              />
            </PressableSurface>
          ))}
          {/* The last row keeps the grid's rhythm rather than stretching its
              survivors across the width. */}
          {row.length < columns
            ? Array.from({ length: columns - row.length }, (_, gap) => (
                <View key={`gap-${gap}`} style={{ flex: 1, minWidth: 0 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The states the page can be in
// ---------------------------------------------------------------------------

/** The one filled oxblood a state is allowed to spend. */
function PrimaryCta({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ borderRadius: CTA_RADIUS, backgroundColor: theme.accent }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: CTA_MIN_HEIGHT,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      <Text variant="body" style={{ color: theme.canvas, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * A rail drawn as the shape it is going to hold.
 *
 * `garments` draws the artifact's three outlines inside the Most worn ghosts —
 * the direction's "empty states draw the object, not explain it". They are
 * decoration and are hidden from VoiceOver, which reads the headline and the
 * one filled action beneath instead.
 */
function GhostRail({
  title,
  tone,
  height,
  garments = false,
}: {
  title: string;
  tone: 'accent' | 'warm';
  height: number;
  garments?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        variant="eyebrow"
        accessibilityRole="header"
        style={{ color: tone === 'accent' ? theme.accent : theme.accentWarm }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', gap: RAIL_GAP }}>
        {Array.from({ length: GHOST_COLUMNS }, (_, index) => (
          <View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flex: 1,
              minWidth: 0,
              height,
              borderRadius: RAIL_TILE_RADIUS,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: theme.rule,
              backgroundColor: theme.tray,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {garments ? (
              <View
                style={{
                  width: GHOST_SHAPES[index]!.width,
                  height: GHOST_SHAPES[index]!.height,
                  borderRadius: GHOST_SHAPES[index]!.radius,
                  borderWidth: 1.5,
                  borderColor: theme.rule,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function EmptyBody({ view }: { view: ProfileView }) {
  return (
    <>
      <View style={{ paddingHorizontal: GUTTER, gap: 16, flexShrink: 0 }}>
        <GhostRail title={PROFILE_COPY.mostWorn} tone="accent" height={GHOST_TILE_HEIGHT} garments />
        <GhostRail
          title={PROFILE_COPY.favorites}
          tone="warm"
          height={GHOST_TILE_HEIGHT_FAVORITES}
        />
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 22, gap: 10, flexShrink: 0 }}>
        <Text variant="greeting" accessibilityRole="header" style={{ paddingBottom: 2 }}>
          {PROFILE_COPY.emptyTitle}
        </Text>
        <Text variant="callout" className="text-muted" style={{ maxWidth: 290 }}>
          {PROFILE_COPY.emptyBody}
        </Text>
      </View>
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 24, flexShrink: 0 }}>
        <PrimaryCta label={PROFILE_COPY.emptyAction} onPress={view.onAddClothes} />
      </View>
    </>
  );
}

/**
 * The read that did not land.
 *
 * `warning` is a FILL and the contrast record says INK goes on it, so the band
 * is the token at an alpha and every word on it is ink. The artifact's #7A5312
 * and #4A3208 are neither palette tokens nor legal as type under
 * `theme/contrast.ts`; ink is darker and passes. The same band the trips shelf
 * draws, so the two failures read as one object.
 */
function OfflineBand({ cached }: { cached: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: warningAlpha(0.22),
        paddingHorizontal: 22,
        paddingTop: 18,
        paddingBottom: 22,
        gap: 11,
        flexShrink: 0,
      }}>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: warningAlpha(0.35),
          borderRadius: BAND_RADIUS,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}>
        <View
          style={{
            width: BAND_DOT,
            height: BAND_DOT,
            borderRadius: BAND_DOT / 2,
            backgroundColor: theme.warning,
            flexShrink: 0,
          }}
        />
        <Text variant="eyebrow" style={{ color: theme.ink }}>
          {PROFILE_COPY.offlineKicker}
        </Text>
      </View>
      <Text variant="title" accessibilityRole="header" style={{ paddingBottom: 2 }}>
        {PROFILE_COPY.offlineTitle}
      </Text>
      <Text variant="callout" className="text-muted" style={{ maxWidth: 290 }}>
        {cached ? PROFILE_COPY.offlineBody : PROFILE_COPY.offlineBodyEmpty}
      </Text>
    </View>
  );
}

function ErrorBody({ view, large }: { view: ProfileView; large: boolean }) {
  return (
    <>
      <OfflineBand cached={view.closet.length > 0} />
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, flexShrink: 0 }}>
        <PrimaryCta label={PROFILE_COPY.tryAgain} onPress={view.onRetry} />
      </View>
      {view.closet.length > 0 ? (
        <>
          <ClosetHeader onSeeAll={view.onOpenCloset} />
          <ClosetGrid tiles={view.closet} large={large} onOpenItem={view.onOpenItem} />
        </>
      ) : null}
    </>
  );
}

/**
 * Waiting, with the page's geometry held.
 *
 * Skeletons rather than a spinner, and the identity block is NOT one: the name
 * and the face are read from a query that answers from cache on every visit
 * after the first, so blanking them would be the app forgetting who you are for
 * a beat it did not need to.
 */
function LoadingBody() {
  return (
    <>
      <View style={{ paddingLeft: GUTTER, paddingBottom: 6, flexShrink: 0 }}>
        <Skeleton className="h-3 w-24 rounded-chip" />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: RAIL_GAP, paddingHorizontal: GUTTER }}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={{ width: RAIL_TILE_WIDTH, gap: 6, flexShrink: 0 }}>
            <Skeleton style={{ height: RAIL_TILE_HEIGHT, borderRadius: RAIL_TILE_RADIUS }} />
            <Skeleton className="h-3 w-3/4 rounded-chip" />
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingLeft: GUTTER, paddingTop: 16, paddingBottom: 6, flexShrink: 0 }}>
        <Skeleton className="h-3 w-32 rounded-chip" />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: RAIL_GAP, paddingHorizontal: GUTTER }}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={{ width: RAIL_TILE_WIDTH, gap: 6, flexShrink: 0 }}>
            <Skeleton style={{ height: RAIL_TILE_HEIGHT, borderRadius: RAIL_TILE_RADIUS }} />
            <Skeleton className="h-3 w-1/2 rounded-chip" />
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: GUTTER,
          paddingTop: 12,
          flexShrink: 0,
        }}>
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            style={{ flex: 1, minWidth: 0, height: MARK_SKELETON_HEIGHT, borderRadius: MARK_RADIUS }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: GUTTER, paddingTop: 14, flexShrink: 0 }}>
        <Skeleton style={{ height: PLAN_ROW_MIN_HEIGHT, borderRadius: PLAN_ROW_RADIUS }} />
      </View>

      <View style={{ paddingLeft: GUTTER, paddingTop: 16, paddingBottom: 6, flexShrink: 0 }}>
        <Skeleton className="h-3 w-16 rounded-chip" />
      </View>
      <View style={{ flexDirection: 'row', gap: CLOSET_GAP, flexShrink: 0 }}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} style={{ flex: 1, minWidth: 0, height: CLOSET_TILE_HEIGHT }} />
        ))}
      </View>
    </>
  );
}

function ReadyBody({ view, large }: { view: ProfileView; large: boolean }) {
  return (
    <>
      <MostWornRail tiles={view.mostWorn} large={large} onOpenItem={view.onOpenItem} />
      <FavoritesRail
        tiles={view.favorites}
        large={large}
        onOpenFavorite={view.onOpenFavorite}
      />
      <Marks marks={view.marks} large={large} />
      {view.learned ? <LearnedLine line={view.learned} /> : null}
      {view.planDoor ? (
        <PlanRow door={view.planDoor} large={large} onPress={view.onPlanDoor} />
      ) : null}
      {view.planUnavailable ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, flexShrink: 0 }}>
          <Text variant="note">{view.planUnavailableLine}</Text>
        </View>
      ) : null}
      <ClosetHeader onSeeAll={view.onOpenCloset} />
      <ClosetGrid tiles={view.closet} large={large} onOpenItem={view.onOpenItem} />
    </>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function ProfileBody({ view, large }: { view: ProfileView; large: boolean }) {
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <DoneRow onDone={view.onDone} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        {view.coaching ?? null}
        <Identity view={view} large={large} />
        {view.state === 'loading' ? <LoadingBody /> : null}
        {view.state === 'error' ? <ErrorBody view={view} large={large} /> : null}
        {view.state === 'empty' ? <EmptyBody view={view} /> : null}
        {view.state === 'ready' ? <ReadyBody view={view} large={large} /> : null}
      </ScrollView>
      {view.menuOpen ? (
        <ProfileMenu
          onDismiss={view.onDismissMenu}
          onEditProfile={view.onEditProfile}
          onOpenDiary={view.onOpenDiary}
          onOpenSettings={view.onOpenSettings}
          settingsLabel={view.settingsLabel}
        />
      ) : null}
    </View>
  );
}
