import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { PlateThumb } from '@/components/closet/plate-thumb';
import { Chip } from '@/components/ui/chip';
import { ErrorState } from '@/components/ui/empty-state';
import { GhostedRail } from '@/components/ui/ghosted-rail';
import { ClosetGridSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
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
import { useStyleProfile } from '@/features/styling/queries';
import type { Item } from '@/schemas/item';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The field guide's sticky browsing row — Tops / Bottoms / Outerwear / Shoes /
 * Accessories — lifted from `dev-closet.tsx` and wired to the real category
 * column. It lives inside search mode (see `ClosetScreen`) because that is
 * the screen's only full-wardrobe grid; the identity view above it stays a
 * curated set of highlights, not a place to filter.
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
 * sentence spoken as prose, style tags, then a favourites rail and the
 * most-worn chart. Every number on screen derives from rows the user owns;
 * nothing is invented (see features/closet/profile.ts for each derivation).
 *
 * Browsing the whole wardrobe moved behind the header's search icon: the mock
 * gives the default state to identity and highlights, so the exhaustive grid
 * appears when asked for — the search field over the full two-column grid,
 * which with an empty query is simply the entire closet, newest first.
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

/**
 * "ME" from "Mara Ellis", "MA" from "Mara" alone — same rules as the Profile
 * modal's avatar (app/profile.tsx), so the two monograms can never disagree.
 * Falls back to a bare "?" rather than throwing while the name loads.
 */
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2);
  return (letters || '?').toUpperCase();
}

/** Chips and captions open with a capital; tags arrive lowercase from the DB. */
function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ClosetScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');

  // The same query Profile's delete-account warning reads, so the two screens
  // can never disagree about what the user owns.
  const closet = useCloset();
  const identity = useClosetIdentity();
  const outfitCount = useOutfitCount();
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

  // "@handle · City". Both columns exist on `profiles` today; the username
  // CLAIMING flow ships with the social wave, so for most users this renders
  // just the city until then — the join collapses around whatever is missing.
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
                fontSize: 15,
                color: theme.ink,
              }}
            />
          </View>

          {/* The field guide's browsing row, restored. Full wardrobe browsing
              lives here — inside search mode — rather than on the identity
              view above, which stays curated highlights. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingHorizontal: 20, paddingVertical: 10 }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>

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
        <ScrollView
          contentContainerClassName="pb-24"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={closet.isRefetching} onRefresh={refresh} />
          }>
          {header}

          {/* Profile row — the monogram beside the three wardrobe numbers. */}
          <View className="mt-6 flex-row items-center gap-5 px-gutter">
            <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-sand">
              {/* Oxblood serif initials on sand, per the mock. Inline colour,
                  not a className: a text-accent class has no guaranteed
                  precedence over the variant's own text-ink. */}
              <Text variant="title" style={{ color: theme.accent }}>
                {initialsFor(name)}
              </Text>
            </View>
            <View className="flex-1 flex-row">
              <Stat value={`${stats.pieces}`} label="Pieces" />
              <Stat
                value={outfitCount.data !== undefined ? `${outfitCount.data}` : '—'}
                label="Outfits"
              />
              {/* The mock sets the unworn numeral in oxblood — the "get more
                  from what you own" pitch as a colour. Zero stays ink: an
                  accent celebrating the absence of a problem reads as an alarm
                  that failed to clear. */}
              <Stat value={`${stats.unworn}`} label="Unworn" accent={stats.unworn > 0} />
            </View>
          </View>

          <View className="mt-6 px-gutter">
            {name ? (
              <Text variant="title" trim accessibilityRole="header">
                {name}
              </Text>
            ) : null}
            {handleLine ? (
              <Text variant="label" className="mt-2.5 text-muted">
                {handleLine}
              </Text>
            ) : null}
            {bioLine ? (
              <Text variant="callout" className="mt-2.5 text-ink">
                {bioLine}
              </Text>
            ) : null}
            {chips.length > 0 ? (
              <View className="mt-4 flex-row flex-wrap gap-2">
                {chips.map((chip) => (
                  <View key={chip} className="rounded-full bg-sand px-3.5 py-1.5">
                    <Text variant="label" className="text-ink">
                      {chip}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {items.length === 0 ? (
            <EmptyCloset onAdd={() => router.push('/capture')} />
          ) : (
            <>
              {favourites.length > 0 ? (
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
              ) : null}

              {mostWorn.length > 0 ? (
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
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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

/** One profile stat: a serif numeral over a small-caps label. */
function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View className="flex-1 items-center" accessibilityLabel={`${value} ${label}`}>
      <Text variant="title" style={accent ? { color: theme.accent } : undefined}>
        {value}
      </Text>
      <Text variant="colophon" className="mt-1">
        {label}
      </Text>
    </View>
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
 * The empty rail — carried over from the previous closet in spirit and in
 * grammar: three dashed garment rails say "hang something here" better than a
 * t-shirt glyph, and match the empty Today so the two read as one app.
 *
 * Behind them, a `GhostedRail`: the same fixture continuing past both screen
 * edges, hung with real garment photography pushed so far back it is texture
 * rather than inventory. The point is that a first-run closet should show the
 * *shape* of a full one instead of a blank page — but the three dashed rails
 * stay the subject. They are opaque `tray` over the ghosts' `sand`, they are
 * the only thing the title and the button are about, and nothing behind them
 * is tappable or audible to VoiceOver. See `ui/ghosted-rail.tsx` for why it is
 * ghosted this hard and what the height contract means.
 *
 * Note on the shared primitive: this is deliberately NOT `ui/EmptyState`. That
 * component's own docblock rules out exactly this composition — "the symbol
 * stays, but as a small glyph above the title, not an illustration pretending
 * to be content" — and it sets hard-left on the gutter. It is the app's
 * *section* empty. The closet's zero state is the field guide's centred hero
 * frame (03c, verbatim), which the audit records as matching the spec; folding
 * one into the other would break both. What is shared is the ghosting itself,
 * which lives in `@/components/ui` so the next hero empty that wants a backdrop
 * does not hand-roll a second one.
 */
function EmptyCloset({ onAdd }: { onAdd: () => void }) {
  return (
    <View>
      {/* Rendered first so RN paints it first — behind everything below. */}
      <GhostedRail />

      {/* pt-14 (56pt) puts the dashed trio's 74pt over the middle of the
          148pt band, and lands the title 10pt clear of the lowest ghost.
          `muted` body copy must never composite over a ghost cell — it drops
          to ~3.6:1 there against 5.4:1 on canvas. */}
      <View className="items-center px-8 pt-14">
        <View className="flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{ width: 52, height: 74 }}
              className="rounded-md border border-dashed border-rule bg-tray"
            />
          ))}
        </View>

        <Text variant="title" className="mt-7 text-center">
          An empty rail
        </Text>
        <Text variant="body" className="mt-3 max-w-[260px] text-center text-muted">
          Add a few pieces and this fills with your real wardrobe — worn counts, cost-per-wear,
          the lot.
        </Text>

        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add clothes"
          className="mt-6 h-12 items-center justify-center rounded-md bg-ink px-7 active:opacity-90">
          <Text variant="callout" className="font-semibold" style={{ color: '#FBFAF6' }}>
            Add clothes
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The search grid's nothing-found state — honest about which filter emptied it. */
function EmptySearch({ query, category }: { query: string; category: CategoryFilter }) {
  const filtered = category !== 'All';
  return (
    <View className="items-center px-8 pt-16">
      <Text variant="title" className="text-center">
        {query || filtered ? 'Nothing matches' : 'An empty rail'}
      </Text>
      <Text variant="body" className="mt-3 max-w-[260px] text-center text-muted">
        {query
          ? 'No pieces match that search. Try a colour, a brand, or the kind of garment.'
          : filtered
            ? `Nothing filed under ${category.toLowerCase()} yet.`
            : 'Add a few pieces and your whole wardrobe becomes searchable here.'}
      </Text>
    </View>
  );
}
