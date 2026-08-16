import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useRemoveItems, useVerifyItem } from '@/features/closet/mutations';
import { closetStats, mostWornItems, useClosetIdentity, useOutfitCount } from '@/features/closet/profile';
import { useCloset, useReviewCount } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useFollowerCount } from '@/features/profile/queries';
import { useStyleProfile } from '@/features/styling/queries';
import type { Item } from '@/schemas/item';

/**
 * Everything the Closet screen knows, minus how it looks.
 *
 * Extracted from the old 993-line `app/(tabs)/closet.tsx` for the atlas
 * redesign (docs/design/closet-redesign-spec.md): the rewritten screen is a
 * thin render tree over this hook, and every derivation the old screen made
 * inline — the category chips, the search matcher, the highlights fallback,
 * the selection set — survives here verbatim per the spec's preserve-list.
 * The pure pieces are exported individually so tests can reach them without
 * mounting a query client.
 */

/**
 * The field guide's browsing row — Tops / Bottoms / Outerwear / Shoes /
 * Accessories — wired to the real category column. One `category` state,
 * shared by the identity view and search mode, so the two can never disagree
 * about which chip is selected.
 */
export type CategoryFilter = 'All' | 'Tops' | 'Bottoms' | 'Outerwear' | 'Shoes' | 'Accessories';
export const CATEGORIES: CategoryFilter[] = [
  'All',
  'Tops',
  'Bottoms',
  'Outerwear',
  'Shoes',
  'Accessories',
];

/** Which of the five browsing chips a stored `ItemCategory` falls under. Total: every value maps somewhere. */
export function chipFor(category: Item['category']): CategoryFilter {
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

/** Top-N cutoffs. Small enough to stay highlights, not an inventory. */
export const MOST_WORN_LIMIT = 5;
/**
 * How many pieces the closet's wear rail carries, and how many the Latest rail
 * matches it at. Named `FAVOURITE_LIMIT` until UX-02 — see `mostWornRail`.
 */
export const MOST_WORN_RAIL_LIMIT = 8;

/**
 * How many reactions the style engine wants before it will say anything about
 * taste. Mirrors the constant of the same name in app/profile.tsx — the chips
 * below fall back to the learned style summary, and showing a "taste" the
 * engine itself would disown breaks the app's honesty rule.
 */
export const TASTE_THRESHOLD = 8;

/** Chips and captions open with a capital; tags arrive lowercase from the DB. */
export function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 Piece", not "1 Pieces". The stats row is the app's most-read line of
 *  type and it was ungrammatical at n=1 on three of its four numbers. */
export function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

/**
 * Live search over the words a person would actually type: what it is, its
 * colour, the brand — and now the fabric, because the search footer promises
 * "name, colour and fabric" and a matcher that skipped `material` made that
 * sentence a lie. `q` must arrive trimmed and lowercased; the hook does that
 * once per keystroke rather than once per item.
 */
export function matchesSearch(item: Item, q: string): boolean {
  if (!q) return true;
  return [item.subcategory, item.category, item.brand, item.material, ...item.colors.map((c) => c.name)]
    .filter(Boolean)
    .some((s) => s!.toLowerCase().includes(q));
}

/** One chip's label and its live count, for the browsing row. */
export type CategoryCount = { category: CategoryFilter; count: number };

/**
 * Counts for the category chips — `All 148`, `Tops 41`, … — computed over the
 * query-matched set so the numbers stay honest inside search, where chip and
 * typed query compose. Categories with nothing filed under them are dropped
 * (a chip promising an empty grid teaches people to stop reading the row);
 * `All` always survives, because zero pieces is a fact the row must still
 * be able to state.
 */
export function categoryCounts(items: Item[], q: string): CategoryCount[] {
  const matched = items.filter((i) => matchesSearch(i, q));
  const byChip = new Map<CategoryFilter, number>();
  for (const item of matched) {
    const chip = chipFor(item.category);
    byChip.set(chip, (byChip.get(chip) ?? 0) + 1);
  }
  return CATEGORIES.flatMap((category) => {
    const count = category === 'All' ? matched.length : (byChip.get(category) ?? 0);
    if (count === 0 && category !== 'All') return [];
    return [{ category, count }];
  });
}

/** The insight card's numbers — see `wornThisYear` for what each one claims. */
export type WornThisYear = {
  /** Pieces worn AND worn recently enough to count for this calendar year. */
  worn: number;
  /** The whole closet — the denominator the card's sentence names. */
  total: number;
  /** `worn / total`, rounded to a whole percent; 0 for an empty closet. */
  pct: number;
  /** Pieces never worn at all (`wearCount === 0`) — the footer's number. */
  unworn: number;
};

/**
 * The "worn this year" insight card's arithmetic.
 *
 * The data layer keeps no per-year wear history — `wear_count` is a lifetime
 * total — so "worn this year" is approximated as `wearCount > 0` with a
 * `lastWornAt` inside the current calendar year (spec §7). A piece worn hard
 * in previous years but untouched since falls out naturally, which is the
 * honest reading: the card is about this year, not about ever. `now` is a
 * parameter so a test can pin the year instead of racing the calendar.
 */
export function wornThisYear(items: Item[], now: Date = new Date()): WornThisYear {
  // Year by string prefix, not `new Date(...).getFullYear()`: a date-only
  // `lastWornAt` parses as UTC midnight, so in any negative-offset timezone
  // (Denver included) a piece worn on Jan 1 would count toward LAST year.
  const year = String(now.getFullYear());
  const worn = items.filter(
    (i) => i.wearCount > 0 && i.lastWornAt !== null && i.lastWornAt.startsWith(year),
  ).length;
  const total = items.length;
  return {
    worn,
    total,
    pct: total > 0 ? Math.round((worn / total) * 100) : 0,
    unworn: items.filter((i) => i.wearCount === 0).length,
  };
}

/**
 * The Closet screen's whole brain: queries, derivations, search, selection.
 *
 * The screen component renders what this returns and nothing else — every
 * number and every mode transition lives here, where it can be exercised
 * without a render tree. Query wiring is unchanged from the pre-redesign
 * screen: `useCloset` is the same query Profile's delete-account warning
 * reads, so the two screens can never disagree about what the user owns, and
 * `useReviewCount` shares the `review-queue` key prefix so every existing
 * invalidation keeps the menu badge current.
 */
export function useClosetScreen() {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [editing, setEditing] = useState(false);
  /** The picked pieces, or `null` when the grid is not in selection mode. */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const remove = useRemoveItems();
  const verify = useVerifyItem();

  const closet = useCloset();
  const identity = useClosetIdentity();
  const outfitCount = useOutfitCount();
  const followerCount = useFollowerCount();
  // The number only — the masthead menu needs an integer, not the rows.
  const reviewWaiting = useReviewCount();
  const style = useStyleProfile();
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  // One signing batch covers both regimes: plates and cutouts for the profile
  // sections, thumbs for the search grid. Paths are private — sign or nothing.
  // A confirmed listing photo is signed alongside them and offered first at
  // every card site, because it is the picture the user chose for the piece.
  const { resolve } = useSignedUrls(
    items.flatMap((i) => [i.listingPath, i.platePath, i.cutoutPath, i.thumbPath]),
  );

  // The headline numbers, computed over the WHOLE closet — they are facts
  // about the wardrobe, never about a search in progress.
  const closetNumbers = useMemo(() => closetStats(items), [items]);
  const mostWorn = useMemo(() => mostWornItems(items, MOST_WORN_LIMIT), [items]);

  /**
   * THE WEAR RAIL — and the name it goes by, which is UX-02's one truth
   * correction on this screen.
   *
   * This was called `favourites`, and the rail above it said "Favourites". It
   * was never a favourite: no favourite flag exists in the schema, nothing in
   * the app lets a person nominate one, and the derivation has always been
   * `mostWornItems` — a ranking by wear count. A label claiming a nomination
   * the reader never made is the kind of small lie that teaches people to stop
   * believing the other labels, so the rail says what the derivation does.
   *
   * The SEAM the old comment recorded is gone with the name. UX-02's brief is
   * explicit that this pass creates no fake favourite state and no backend
   * contract for one; if an `items.is_favourite` ever lands it deserves its own
   * rail beside this one, not a quiet swap underneath a label that would then
   * be right for the first time.
   *
   * VISIBILITY IS UNCHANGED. It derives from `wearCount > 0` exactly as before,
   * and the screen hides it rather than rendering it empty. No piece-count
   * threshold gates it — see the implementation plan's refusal of the atlas's
   * unbriefed 5/15 rules.
   */
  const mostWornRail = useMemo(() => mostWornItems(items, MOST_WORN_RAIL_LIMIT), [items]);

  // Atlas C-01 draws BOTH rails for a worn-in closet — Latest is recency, Most
  // worn is wear data, and they answer different questions. `items` already
  // arrives newest-first from `useCloset`'s own ORDER BY, so Latest is a plain
  // prefix. A closet with no wear data yet renders Latest alone.
  const hasWearData = mostWornRail.length > 0;
  const latestPieces = useMemo(() => items.slice(0, MOST_WORN_RAIL_LIMIT), [items]);

  // The grid's contents: narrowed first by the category chip, then by the
  // typed query. Empty query and "All" = the whole closet, newest first.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => (category === 'All' || chipFor(i.category) === category) && matchesSearch(i, q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [items, query, category]);

  // The chips' live counts, query-aware for the same reason `visible` is.
  const categories = useMemo(
    () => categoryCounts(items, query.trim().toLowerCase()),
    [items, query],
  );

  const insight = useMemo(() => wornThisYear(items), [items]);

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
    closetNumbers.avgCostPerWear !== null
      ? `Averages $${closetNumbers.avgCostPerWear.toFixed(2)} a wear.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Style-tag chips: the profile's own tags when the user has set them, else
  // the engine's learned summary — but only past the honesty threshold, the
  // same line Profile's "What Cinch has learned" card draws. The atlas omits
  // these from the closet's identity block, but the derivation stays for
  // profile-screen parity (spec preserve-list).
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

  // Tapping a tile opens it; holding one starts picking them. `null` is "not
  // selecting" — one piece of state rather than a boolean and a set that can
  // disagree about whether the mode is on.
  const togglePicked = (item: Item) =>
    setPicked((current) => {
      const next = new Set(current ?? []);
      if (!next.delete(item.id)) next.add(item.id);
      return next;
    });

  const beginSelection = (item: Item) => {
    // Long press has no visual until the mode arrives, so the tick alone is
    // late feedback; the same `selectionAsync` the rest of the app uses.
    void Haptics.selectionAsync().catch(() => {});
    togglePicked(item);
  };

  // The menu's way in. An empty `picked` set IS selection mode with nothing
  // picked, which the selection chrome already draws (actions dimmed at 0).
  const enterSelection = () => setPicked(new Set());
  const cancelSelection = () => setPicked(null);

  const allSelected = picked !== null && items.length > 0 && picked.size === items.length;

  // `Select all` toggles: a full selection collapses back to none rather than
  // to exiting the mode — the header's label flips to `Deselect all` with it.
  const selectAll = () => setPicked(new Set(items.map((i) => i.id)));
  const deselectAll = () => setPicked(new Set());

  /**
   * Bulk removal. One confirmation, naming the count and both consequences —
   * same sentence as item detail's, because it is the same promise: the pieces
   * leave the closet and their photographs are deleted from storage.
   */
  const confirmRemovePicked = () => {
    const ids = [...(picked ?? [])];
    if (ids.length === 0) return;

    Alert.alert(
      ids.length === 1 ? 'Remove this piece?' : `Remove ${ids.length} pieces?`,
      ids.length === 1
        ? 'It leaves your closet and its photos are deleted. This can’t be undone.'
        : 'They leave your closet and their photos are deleted. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate(
              { ids },
              {
                onSuccess: () => setPicked(null),
                onError: (err) =>
                  Alert.alert(
                    ids.length === 1 ? 'Could not remove this piece' : 'Could not remove these pieces',
                    err instanceof Error
                      ? err.message
                      : 'Something went wrong. Nothing has been removed.',
                  ),
              },
            ),
        },
      ],
    );
  };

  /**
   * Move every selected piece to a category the user chose, then leave
   * selection mode.
   *
   * `useVerifyItem` with `verify: false`, NOT `useRetagItem`, despite the
   * spec naming the latter: `useRetagItem` takes no category — it re-runs the
   * billed AI tagger and puts the piece back in the review deck, so routing a
   * category choice through it would discard the choice AND spend the user's
   * tagging allowance once per selected item. The verify mutation's patch
   * path is the one existing write that sets `category`; `verify: false`
   * because filing a piece under Shoes says nothing about whether the
   * tagger's other guesses were right, and claiming otherwise would quietly
   * promote unreviewed items out of the deck.
   */
  const recategorise = async (category: Item['category']) => {
    const ids = [...(picked ?? [])];
    if (ids.length === 0) return;

    try {
      await Promise.all(
        ids.map((id) => verify.mutateAsync({ id, patch: { category }, verify: false })),
      );
      setPicked(null);
    } catch (err) {
      // Some writes may have landed — the invalidations in `useVerifyItem`
      // keep the grid honest about which — so the mode stays open with the
      // selection intact for a retry rather than pretending it finished.
      Alert.alert(
        'Could not move those pieces',
        err instanceof Error ? err.message : 'Something went wrong. Try again.',
      );
    }
  };

  const refresh = () => {
    void closet.refetch();
    void identity.refetch();
    void outfitCount.refetch();
    // Nobody tells this device that someone followed you, so the pull is the
    // only thing that ever makes the FOLLOWERS numeral current.
    void followerCount.refetch();
    void reviewWaiting.refetch();
  };

  // The typed query belongs to the field and goes with it. The CATEGORY does
  // not: the same browsing row is drawn above the grid in BOTH modes, so
  // resetting it here would silently throw away a filter the user can still
  // see selected on the other side of the tap.
  const toggleSearch = () => {
    setSearching((s) => !s);
    setQuery('');
  };

  return {
    // ── Data & lifecycle ────────────────────────────────────────────────
    /** The whole closet, newest first. `[]` while loading or on error. */
    items,
    loading: closet.isLoading,
    error: closet.isError,
    refreshing: closet.isRefetching,
    /** Refetches all five queries — the pull-to-refresh contract. */
    refresh,

    // ── Search & filtering ──────────────────────────────────────────────
    searching,
    /** Enter/leave search. Clears the query, keeps the category chip. */
    toggleSearch,
    query,
    setQuery,
    category,
    setCategory,
    /** Chips with live counts; zero-count categories hidden (except All). */
    categories,
    /** The grid's contents: chip + query composed, newest first. */
    visible,

    // ── Rails ───────────────────────────────────────────────────────────
    latestPieces,
    /** The wear rail: top pieces by wear count, `[]` when nothing is worn. */
    mostWornRail,
    /** The shorter top-5, computed and preserved for parity; no rail renders it. */
    mostWorn,
    hasWearData,

    // ── Identity ────────────────────────────────────────────────────────
    name,
    avatarUrl: identity.data?.avatarUrl ?? null,
    handleLine,
    bioLine,
    /** Style-tag chips — unrendered on this screen per the atlas. */
    chips,
    editing,
    setEditing,

    // ── Numbers ─────────────────────────────────────────────────────────
    /** The stat row. `outfits`/`followers` are `undefined` until their
     *  queries land — render an em dash, not a zero the data never said. */
    stats: {
      pieces: closetNumbers.pieces,
      outfits: outfitCount.data,
      unworn: closetNumbers.unworn,
      followers: followerCount.data,
    },
    avgCostPerWear: closetNumbers.avgCostPerWear,
    /** The "worn this year" insight card's numbers. */
    insight,
    /** Pending review count, for the menu badge. Row hidden at 0. */
    reviewCount: reviewWaiting.data ?? 0,
    outfitCount: outfitCount.data,
    followerCount: followerCount.data,

    // ── Selection mode ──────────────────────────────────────────────────
    /** The picked ids, or `null` when the grid is not in selection mode. */
    picked,
    beginSelection,
    enterSelection,
    togglePicked,
    selectAll,
    deselectAll,
    allSelected,
    cancelSelection,
    confirmRemovePicked,
    removePending: remove.isPending,
    recategorise,
    recategorisePending: verify.isPending,

    // ── Images & navigation ─────────────────────────────────────────────
    /** Path → signed URL, preferring the first candidate that resolved. */
    resolve,
    openItem,
  };
}

/** What the screen component receives — one name for the whole contract. */
export type ClosetScreenModel = ReturnType<typeof useClosetScreen>;
