import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { GhostSlotGrid } from '@/components/closet/ghost-slot-grid';
import { PlateThumb } from '@/components/closet/plate-thumb';
import { Avatar, Chip, ClosetGridSkeleton, EmptyState, ErrorState, Text } from '@/components/ui';
import {
  closetStats,
  mostWornItems,
  pieceName,
  useClosetIdentity,
  useOutfitCount,
  wearsLabel,
} from '@/features/closet/profile';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import { useFollowerCount } from '@/features/profile/queries';
import { useStyleProfile } from '@/features/styling/queries';
import type { Item } from '@/schemas/item';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The field guide's sticky browsing row — Tops / Bottoms / Outerwear / Shoes /
 * Accessories — lifted from `dev-closet.tsx` and wired to the real category
 * column. Rendered above the full grid both on the identity view (03a lists
 * the category chips and the full grid as part of the same page, not a mode
 * behind search) and inside search mode, where it narrows the same grid
 * further by the typed query. One `category` state, shared by both.
 */
type CategoryFilter = 'All' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | 'Accessories';
const CATEGORIES: CategoryFilter[] = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];

/** Which of the five browsing chips a stored `ItemCategory` falls under. Total: every value maps somewhere. */
function chipFor(category: Item['category']): CategoryFilter {
  switch (category) {
    case 'top':
    case 'dress':
      return 'Tops';
    case 'bottom':
      return 'Bottoms';
    case 'outerwear':
      return 'Outerwear';
    case 'footwear':
      return 'Shoes';
    default:
      return 'Accessories';
  }
}

/**
 * The closet as the founder's mock draws it: the user's own profile page.
 *
 * Not a grid with a masthead any more — the page IS the person: monogram
 * avatar, the three wardrobe numbers, name and handle, the cost-per-wear
 * sentence spoken as prose, style tags, a highlights rail, the category chips,
 * then the full two-column grid — one continuous scroll, per 03a. Every
 * number on screen derives from rows the user owns; nothing is invented (see
 * features/closet/profile.ts for each derivation).
 *
 * The highlights rail is FAVOURITE PIECES + MOST WORN when the closet has any
 * wear data, and LATEST PIECES (newest first) when it does not — a fresh
 * closet full of just-photographed pieces has zero wears on every item, and
 * a rail whose only entry condition is `wearCount > 0` would show nothing at
 * all for exactly the user at her most delighted. The grid below it never
 * shares that condition: it is the whole closet, unconditionally, filtered
 * only by the category chip and (in search mode) the typed query.
 *
 * The search icon does not gate the grid into existing — it adds a text
 * field above the SAME grid, for narrowing by more than a category chip can.
 * The field sits OUTSIDE the FlashList (see the `searching` branch) because a
 * controlled `TextInput` inside a virtualised `ListHeaderComponent` remounts,
 * and loses focus, on every keystroke; the rest of the identity content has
 * no such input and lives in `ListHeaderComponent` instead, so it scrolls
 * away with the grid exactly as 03a draws it.
 */

/** Top-N cutoffs. Small enough to stay highlights, not an inventory. */
const MOST_WORN_LIMIT = 5;
const FAVOURITE_LIMIT = 8;

/** Rail plate side, in points — three-and-a-bit visible on a 390pt screen. */
const RAIL_PLATE = 124;

/**
 * How many reactions the style engine wants before it will say anything about
 * taste. Mirrors the constant of the same name in app/profile.tsx — the chips
 * below fall back to the learned style summary, and showing a "taste" the
 * engine itself would disown breaks the app's honesty rule.
 */
const TASTE_THRESHOLD = 8;

/** Chips and captions open with a capital; tags arrive lowercase from the DB. */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 Piece", not "1 Pieces". The stats row is the app's most-read line of
 *  type and it was ungrammatical at n=1 on three of its four numbers. */
function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

export default function ClosetScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [editing, setEditing] = useState(false);

  // The same query Profile's delete-account warning reads, so the two screens
  // can never disagree about what the user owns.
  const closet = useCloset();
  const identity = useClosetIdentity();
  const outfitCount = useOutfitCount();
  const followerCount = useFollowerCount();
  const style = useStyleProfile();
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  // One signing batch covers both regimes: plates and cutouts for the profile
  // sections, thumbs for the search grid. Paths are private — sign or nothing.
  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.platePath, i.cutoutPath, i.thumbPath]),
  );

  // The headline numbers, computed over the WHOLE closet — they are facts
  // about the wardrobe, never about a search in progress.
  const stats = useMemo(() => closetStats(items), [items]);
  const mostWorn = useMemo(() => mostWornItems(items, MOST_WORN_LIMIT), [items]);

  // SEAM — favourites. No favourite flag exists in the schema yet and the DB
  // agent owns migrations, so the rail is driven by wear data (the pieces the
  // user demonstrably reaches for) and the Edit affordance below renders
  // disabled. When an `items.is_favourite` lands, swap this derivation for the
  // flagged set and enable Edit; nothing else on the page changes.
  const favourites = useMemo(() => mostWornItems(items, FAVOURITE_LIMIT), [items]);

  // FAVOURITE PIECES and MOST WORN both derive from `wearCount > 0`
  // (`mostWornItems` above) — so a closet nobody has worn yet, most notably a
  // brand-new user's just-photographed wardrobe, empties BOTH rails at once.
  // That is peak delight rendered as a blank page. When there is no wear data
  // to show, the highlight rail falls back to recency instead of vanishing —
  // `items` already arrives newest-first from `useCloset`'s own ORDER BY, so
  // no re-sort is needed.
  const hasWearData = favourites.length > 0;
  const latestPieces = useMemo(
    () => (hasWearData ? [] : items.slice(0, FAVOURITE_LIMIT)),
    [items, hasWearData],
  );

  // Live search over the words a person would actually type: what it is, its
  // colour, the brand — narrowed first by the category chip, same as the
  // guide's browsing row. Empty query and "All" = the whole closet, newest
  // first.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (i: Item) => {
      if (category !== 'All' && chipFor(i.category) !== category) return false;
      if (!q) return true;
      return [i.subcategory, i.category, i.brand, ...i.colors.map((c) => c.name)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    };
    return items.filter(matches).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query, category]);

  const name = identity.data?.name ?? '';

  // "@handle · City". The handle is claimed in the edit-profile sheet and the
  // city is not editable anywhere yet, so this often renders one half or
  // neither — the join collapses around whatever is missing.
  const handleLine = [
    identity.data?.username ? `@${identity.data.username}` : null,
    identity.data?.homeCity,
  ]
    .filter(Boolean)
    .join(' · ');

  // The bio, ending in the computed average cost-per-wear as prose. The
  // sentence is only spoken when at least one piece has both a price and a
  // wear — an average over nothing is not a fact, so it goes unsaid.
  const bioLine = [
    identity.data?.bio,
    stats.avgCostPerWear !== null ? `Averages $${stats.avgCostPerWear.toFixed(2)} a wear.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Style-tag chips: the profile's own tags when the user has set them, else
  // the engine's learned summary — but only past the honesty threshold, the
  // same line Profile's "What Cinch has learned" card draws.
  const chips = useMemo(() => {
    const tags = identity.data?.styleTags ?? [];
    if (tags.length > 0) return tags.map(sentenceCase);
    if ((style.data?.feedbackCount ?? 0) >= TASTE_THRESHOLD) {
      return (style.data?.summary ?? []).map(sentenceCase);
    }
    return [];
  }, [identity.data?.styleTags, style.data]);

  const openItem = (item: Item) =>
    router.push({ pathname: '/item/[id]', params: { id: item.id } });

  const refresh = () => {
    void closet.refetch();
    void identity.refetch();
    void outfitCount.refetch();
    // Nobody tells this device that someone followed you, so the pull is the
    // only thing that ever makes the FOLLOWERS numeral current.
    void followerCount.refetch();
  };

  const header = (
    <View className="flex-row items-center justify-between pl-gutter pr-2 pt-2">
      <Text variant="display" trim accessibilityRole="header">
        Closet
      </Text>
      <View className="flex-row items-center">
        <HeaderIcon
          name="magnifyingglass"
          label={searching ? 'Close search' : 'Search your wardrobe'}
          onPress={() => {
            setSearching((s) => !s);
            setQuery('');
            setCategory('All');
          }}
        />
        <HeaderIcon
          name="ellipsis"
          label="Account and settings"
          onPress={() => router.navigate('/profile')}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {closet.isLoading ? (
        // Just the title standing above the skeleton — the page has nothing to
        // say about a wardrobe it has not read yet, and keeping the title put
        // stops the screen jumping when the data lands.
        <>
          <View className="px-gutter pt-2">
            <Text variant="display" trim accessibilityRole="header">
              Closet
            </Text>
          </View>
          <ClosetGridSkeleton />
        </>
      ) : closet.isError ? (
        // A failed fetch is not an empty wardrobe. Falling through to
        // EmptyCloset here used to tell someone with 200 garments "An empty
        // rail" over a network error that has nothing to do with what she owns.
        <>
          <View className="px-gutter pt-2">
            <Text variant="display" trim accessibilityRole="header">
              Closet
            </Text>
          </View>
          <ErrorState
            title="Couldn't read your closet"
            body="Check your connection and try again."
            onRetry={refresh}
          />
        </>
      ) : searching ? (
        // The browse-everything mode: search over the full grid. The input sits
        // OUTSIDE the list for the same reason the old masthead did — a
        // controlled TextInput in a virtualised header remounts, and loses
        // focus, on every keystroke.
        <>
          {header}
          <View className="mx-gutter mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5">
            <SymbolView
              name="magnifyingglass"
              size={15}
              tintColor={theme.faint}
              resizeMode="scaleAspectFit"
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search your wardrobe"
              placeholderTextColor={theme.faint}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search your wardrobe"
              style={{
                flex: 1,
                paddingVertical: 11,
                fontFamily: 'HelveticaNeue',
                // 17 = the `body` size on the type scale (tailwind.config.js)
                // — the same value the friends-search field uses for the
                // identical row (src/app/friends/index.tsx). 15 sat off the
                // scale entirely.
                fontSize: 17,
                color: theme.ink,
              }}
            />
          </View>

          {/* The field guide's browsing row. Narrows the same full-wardrobe
              grid the identity view shows below it — see CategoryChipsRow. */}
          <CategoryChipsRow category={category} onSelect={setCategory} />

          <ClosetGrid
            items={visible}
            onItemPress={openItem}
            resolveImage={resolve}
            refreshControl={
              <RefreshControl refreshing={closet.isRefetching} onRefresh={refresh} />
            }
            ListEmptyComponent={<EmptySearch query={query} category={category} />}
          />
        </>
      ) : (
        // The identity view — 03a's whole page as one continuous scroll. The
        // grid is the FlashList itself; everything above it (masthead,
        // profile row, identity, highlights rail, category chips) rides in
        // `ListHeaderComponent` so it scrolls away with the grid rather than
        // sitting pinned above it. No `TextInput` lives here, so the focus
        // hazard that keeps the search field outside the list doesn't apply.
        <ClosetGrid
          items={visible}
          onItemPress={openItem}
          resolveImage={resolve}
          refreshControl={<RefreshControl refreshing={closet.isRefetching} onRefresh={refresh} />}
          ListHeaderComponent={
            <View>
              {header}

              {/* Identity — the face, the name, and the way in to changing
                  both. The stats row used to sit here beside the monogram,
                  three cells wide; a fourth number does not fit next to a
                  76pt disc (FOLLOWERS alone is wider than the cell), so the
                  numbers moved down to their own full-width line and the name
                  came up to stand beside the face where it reads better. */}
              <View className="mt-6 flex-row items-center gap-4 px-gutter">
                {/* The shared Avatar, not a hand-built disc: it carries the
                    photo-then-initials fallback and the oxblood-on-sand
                    monogram this screen used to draw itself. */}
                <Avatar
                  name={name}
                  size={76}
                  tone="accent"
                  imageUri={identity.data?.avatarUrl}
                  fallback="?"
                />
                <View className="flex-1">
                  {name ? (
                    // One line: `trim` collapses the line box to the cap
                    // height, which a wrapped second line would clip.
                    <Text variant="title" trim numberOfLines={1} accessibilityRole="header">
                      {name}
                    </Text>
                  ) : null}
                  {handleLine ? (
                    <Text variant="label" className="mt-2.5 text-muted">
                      {handleLine}
                    </Text>
                  ) : null}
                  {/* Quiet, in ink rather than the accent: this page already
                      spends its accent on the unworn numeral, and a second
                      one turns a spend into a spray. */}
                  <Pressable
                    onPress={() => setEditing(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Edit your profile"
                    accessibilityHint="Change your name, handle, bio and photo"
                    hitSlop={10}
                    className="mt-2 flex-row items-center gap-1.5 self-start active:opacity-60">
                    <SymbolView
                      name="pencil"
                      size={11}
                      tintColor={theme.muted}
                      resizeMode="scaleAspectFit"
                    />
                    <Text variant="colophon">Edit profile</Text>
                  </Pressable>
                </View>
              </View>

              {/* The spec line — the wardrobe in four numbers, full width.
                  FOLLOWERS is a real count of `follows` rows pointing at this
                  user (friends plus anyone whose follow she has not returned),
                  which is exactly the two lists /friends shows. */}
              <View className="mt-7 flex-row px-gutter">
                <Stat value={`${stats.pieces}`} label={plural(stats.pieces, 'Piece')} />
                <Stat
                  value={outfitCount.data !== undefined ? `${outfitCount.data}` : '—'}
                  label={plural(outfitCount.data ?? 0, 'Outfit')}
                />
                {/* The mock sets the unworn numeral in oxblood — the "get more
                    from what you own" pitch as a colour. Zero stays ink: an
                    accent celebrating the absence of a problem reads as an alarm
                    that failed to clear. */}
                <Stat value={`${stats.unworn}`} label="Unworn" accent={stats.unworn > 0} />
                <Stat
                  value={followerCount.data !== undefined ? `${followerCount.data}` : '—'}
                  label={plural(followerCount.data ?? 0, 'Follower')}
                  onPress={() => router.push('/friends')}
                  hint="Opens your friends and requests"
                />
              </View>

              <View className="px-gutter">
                {bioLine ? (
                  <Text variant="callout" className="mt-6 text-ink">
                    {bioLine}
                  </Text>
                ) : null}
                {chips.length > 0 ? (
                  // Closer to the prose it qualifies than to the spec line it
                  // would otherwise be crowding when there is no bio.
                  <View className={`${bioLine ? 'mt-4' : 'mt-6'} flex-row flex-wrap gap-2`}>
                    {/* The ui kit's own `Chip`, not a hand-rolled capsule — a
                        labelled control is `rounded-md` square-cornered per
                        the "capsules only on glass chrome" rule
                        (tailwind.config.js borderRadius). No `onPress`: these
                        describe the wardrobe, they don't filter it, so the
                        chip renders `accessibilityRole="text"`. */}
                    {chips.map((chip) => (
                      <Chip key={chip} label={chip} />
                    ))}
                  </View>
                ) : null}
              </View>

              {items.length > 0 ? (
                <>
                  {hasWearData ? (
                    <>
                      <View className="mt-8">
                        <View className="flex-row items-baseline justify-between px-gutter">
                          <Text variant="eyebrow">Favourite pieces</Text>
                          {/* Disabled until a favourite flag exists — see the SEAM
                              note on `favourites` above. Kept visible because the
                              mock draws it and the affordance ships with the flag. */}
                          <Pressable
                            disabled
                            accessibilityRole="button"
                            accessibilityState={{ disabled: true }}
                            accessibilityLabel="Edit favourite pieces"
                            accessibilityHint="Coming soon">
                            <Text variant="label" className="text-accent opacity-40">
                              Edit
                            </Text>
                          </Pressable>
                        </View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingTop: 12 }}>
                          {favourites.map((item) => (
                            <Pressable
                              key={item.id}
                              onPress={() => openItem(item)}
                              accessibilityRole="button"
                              accessibilityLabel={`${pieceName(item)}, ${wearsLabel(item.wearCount)}`}
                              className="active:opacity-80"
                              style={{ width: RAIL_PLATE }}>
                              {/* Plate → cutout only; the raw photo never stands in
                                  for a plate (see PlateThumb). */}
                              <PlateThumb
                                item={item}
                                uri={resolve(item.platePath, item.cutoutPath)}
                                size={RAIL_PLATE}
                              />
                              <Text variant="label" numberOfLines={1} className="mt-2 text-ink">
                                {pieceName(item)}
                              </Text>
                              <Text variant="caption" className="mt-0.5 text-muted">
                                {wearsLabel(item.wearCount)}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>

                      <View className="mt-8 px-gutter">
                        <Text variant="eyebrow">Most worn</Text>
                        <View className="mt-1.5">
                          {mostWorn.map((item) => (
                            <MostWornRow
                              key={item.id}
                              item={item}
                              max={mostWorn[0]?.wearCount ?? 1}
                              uri={resolve(item.platePath, item.cutoutPath)}
                              onPress={() => openItem(item)}
                            />
                          ))}
                        </View>
                      </View>
                    </>
                  ) : (
                    <LatestPiecesRail items={latestPieces} resolve={resolve} onPress={openItem} />
                  )}

                  {/* 03a's category chips, above the full grid — the SAME
                      full closet the search field narrows further, not a
                      separate mode reached only through it (see F5). */}
                  <CategoryChipsRow category={category} onSelect={setCategory} />
                </>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            items.length === 0 ? (
              <EmptyCloset onAdd={() => router.push('/capture')} />
            ) : (
              // The closet has pieces, but none in the chosen category —
              // the same honest "nothing filed under X yet" the search grid
              // uses, not the ghost-slot "you own nothing" composition.
              <EmptySearch query="" category={category} />
            )
          }
        />
      )}

      {/* Mounted only while open, so its read of `profiles` costs nothing on
          a screen the user is only scrolling. */}
      {editing ? <EditProfileSheet visible onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}

/**
 * The field guide's category row, shared by the identity view (over the full
 * grid) and search mode (narrowing it further) — one row, one `category`
 * state, so the two can never disagree about which chip is selected.
 */
function CategoryChipsRow({
  category,
  onSelect,
}: {
  category: CategoryFilter;
  onSelect: (c: CategoryFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingHorizontal: 20, paddingVertical: 10 }}>
      {CATEGORIES.map((c) => (
        <Chip key={c} label={c} selected={category === c} onPress={() => onSelect(c)} />
      ))}
    </ScrollView>
  );
}

/** One header icon at the accessibility floor — the title row's quiet chrome. */
function HeaderIcon({
  name,
  label,
  onPress,
}: {
  name: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
      className="items-center justify-center active:opacity-60">
      <SymbolView name={name} size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

/**
 * One profile stat: a serif numeral over a small-caps label.
 *
 * Three of the four are facts about the wardrobe and do nothing when tapped;
 * FOLLOWERS is a fact about people, and people are somewhere you can go. It
 * gets the button role only when it is given an `onPress`, so VoiceOver never
 * announces a control that isn't one.
 */
function Stat({
  value,
  label,
  accent = false,
  onPress,
  hint,
}: {
  value: string;
  label: string;
  accent?: boolean;
  onPress?: () => void;
  hint?: string;
}) {
  const theme = useTheme();

  const body = (
    <>
      <Text variant="title" style={accent ? { color: theme.accent } : undefined}>
        {value}
      </Text>
      {/* One line, always: "Followers" is the widest label on the row and a
          wrapped second line would push its numeral out of alignment with the
          other three. */}
      <Text variant="colophon" numberOfLines={1} className="mt-1">
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View className="flex-1 items-center" accessibilityLabel={`${value} ${label}`}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      accessibilityHint={hint}
      className="flex-1 items-center active:opacity-60">
      {body}
    </Pressable>
  );
}

/**
 * One most-worn row: plate thumb, name, the wear bar, the count in the serif.
 *
 * The bar is scaled to the section's own maximum so the top piece always fills
 * the track and the rest read as ratios of it — the mock's "dusty rose" maps
 * to the accent-warm token, the palette's designated data highlight, rather
 * than a new colour.
 */
function MostWornRow({
  item,
  max,
  uri,
  onPress,
}: {
  item: Item;
  max: number;
  uri?: string;
  onPress: () => void;
}) {
  // Floor at 5% so the fifth-place bar is still a bar, not a rounding error.
  const fraction = Math.max(item.wearCount / Math.max(max, 1), 0.05);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pieceName(item)}, ${wearsLabel(item.wearCount)}`}
      className="flex-row items-center gap-3 py-2.5 active:opacity-70">
      <PlateThumb item={item} uri={uri} size={48} showFallbackLabel={false} />
      <View className="flex-1">
        <Text variant="label" numberOfLines={1} className="text-ink">
          {pieceName(item)}
        </Text>
        <View className="mt-2 h-[5px] overflow-hidden rounded-full bg-sand">
          <View
            className="h-full rounded-full bg-accent-warm"
            style={{ width: `${fraction * 100}%` }}
          />
        </View>
      </View>
      {/* Same serif-at-label-size idiom as the item card's cost-per-wear. Size
          is set inline, not via a second `text-*` class stacked on the `stat`
          variant's own — NativeWind gives no guaranteed precedence between
          two size utilities on one element (see button.tsx L18-25). */}
      <Text
        variant="stat"
        className="text-ink"
        style={{ fontSize: 13, lineHeight: leading('helvetica', 13, 1.4) }}>
        {wearsLabel(item.wearCount)}
      </Text>
    </Pressable>
  );
}

/**
 * The highlights rail's recency fallback — a closet with pieces but no wear
 * data yet (see `hasWearData` in `ClosetScreen`). Same plate-then-caption
 * shape as FAVOURITE PIECES, but with nothing under the name: there is no
 * wear count to report, and inventing one ("0 wears" on every single piece)
 * would be noise the field guide's honesty rule doesn't allow. `LATEST
 * PIECES` renders in the guide's caps-kicker grammar via the `eyebrow`
 * variant's own `uppercase` class, same as `FAVOURITE PIECES`/`MOST WORN`.
 */
function LatestPiecesRail({
  items,
  resolve,
  onPress,
}: {
  items: Item[];
  resolve: (...paths: (string | null | undefined)[]) => string | undefined;
  onPress: (item: Item) => void;
}) {
  if (items.length === 0) return null;

  return (
    <View className="mt-8">
      <View className="px-gutter">
        <Text variant="eyebrow">Latest pieces</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingTop: 12 }}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={pieceName(item)}
            className="active:opacity-80"
            style={{ width: RAIL_PLATE }}>
            <PlateThumb item={item} uri={resolve(item.platePath, item.cutoutPath)} size={RAIL_PLATE} />
            <Text variant="label" numberOfLines={1} className="mt-2 text-ink">
              {pieceName(item)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The empty closet, per the founder's own wording: "the blank boxes with
 * example ghosted garments and on top of them say 'add your closet'".
 *
 * The page above this is already the profile top the founder asked for —
 * monogram avatar, the three wardrobe numbers at zero, the name. What this
 * section adds is the closet grid itself, rendered as blank slots: the real
 * two-column geometry (`GhostSlotGrid` tracks `item-card.tsx` cell for cell)
 * with licensed garment photography ghosted through each slot, and the
 * invitation set over them. When the first pieces land, the real cards land in
 * exactly these frames — the page fills in rather than being replaced.
 *
 * Composition rules, all inherited rather than invented:
 * - Hard-left on the gutter, serif title, ink CTA — the Plate's empty-state
 *   grammar (frame 03c carried the copy; the centred hero frame it carried is
 *   superseded by the founder's grid-of-slots direction).
 * - Only ink type and the opaque ink button sit over the ghost cells; ink
 *   holds 10.9:1 over the worst-case composite. The `muted` body line drops to
 *   ~3.6:1 there, so it sits BELOW the grid on plain canvas — the contrast
 *   contract documented in `ui/ghosted-rail.tsx`, which `GhostSlotGrid`
 *   restates.
 * - Nothing ghosted is tappable or audible; VoiceOver hears title, button,
 *   body, in that order.
 */
function EmptyCloset({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="mt-6">
      {/* Rendered first so RN paints it first — the type stands on the slots. */}
      <View>
        <GhostSlotGrid />
        <View className="absolute inset-0 justify-center px-gutter">
          <Text variant="title" accessibilityRole="header">
            Add your closet
          </Text>
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add clothes"
            className="mt-5 h-12 items-center justify-center self-start rounded-md bg-ink px-7 active:opacity-90">
            <Text variant="callout" className="font-semibold" style={{ color: '#FBFAF6' }}>
              Add clothes
            </Text>
          </Pressable>
        </View>
      </View>

      {/* The 03c line, spoken as the grid's caption — on canvas, never over a
          ghost cell (see the contrast note above). */}
      <Text variant="body" className="mt-2 px-gutter text-muted">
        Add a few pieces and this fills with your real wardrobe — worn counts, cost-per-wear,
        the lot.
      </Text>
    </View>
  );
}

/**
 * The grid's nothing-found state — honest about which filter emptied it.
 * Both the search field and a category chip with nothing filed under it land
 * here, and (with an empty query and "All") so does the true empty closet
 * reached by opening search before ever adding a piece.
 *
 * `EmptyState`, not a hand-rolled centred composition: the sibling
 * `EmptyCloset` is hard-left on the gutter per the field guide's caps-kicker
 * empty-state grammar, and this one was centred against it — the one empty
 * state on the page that didn't match the other. `compact` drops the
 * `flex-1` centring `EmptyState` otherwise applies, which needs a flex
 * parent and collapses to nothing inside a FlashList's `ListEmptyComponent`.
 */
function EmptySearch({ query, category }: { query: string; category: CategoryFilter }) {
  const filtered = category !== 'All';
  const title = query || filtered ? 'Nothing matches' : 'An empty rail';
  const body = query
    ? 'No pieces match that search. Try a colour, a brand, or the kind of garment.'
    : filtered
      ? `Nothing filed under ${category.toLowerCase()} yet.`
      : 'Add a few pieces and your whole wardrobe becomes searchable here.';

  return <EmptyState compact symbol="magnifyingglass" title={title} body={body} />;
}
