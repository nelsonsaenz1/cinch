import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileBody, type ProfileView } from '@/components/profile/profile-body';
import { ProfileCoachingCard } from '@/components/profile/profile-coaching-card';
import { Placement } from '@/features/billing/placements';
import { UPGRADE_UNAVAILABLE_LINE } from '@/features/billing/upgrade-delta';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { pieceName } from '@/features/closet/item-name';
import { closetStats, mostWornItems, useOutfitCount } from '@/features/closet/profile';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { coachingDestination } from '@/features/examples/example-copy';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import {
  CLOSET_TILES,
  FAVORITE_TILES,
  MOST_WORN_TILES,
  PROFILE_STACK_SCALE,
  learnedLine,
  planDoorFor,
  profileBodyState,
  statMarks,
} from '@/features/profile/profile-spec';
import { useMyProfile } from '@/features/profile/queries';
import { SETTINGS_TITLE } from '@/features/profile/settings-copy';
import { useProfileCoaching } from '@/features/profile/use-profile-coaching';
import { useFriends } from '@/features/social-graph/queries';
import { useFavoriteOutfits } from '@/features/styling/use-favorite-outfits';
import { useStyleProfile } from '@/features/styling/queries';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * Profile — your own room. Redesign 07.
 *
 * This file holds the queries and the state and hands one plain object to
 * `ProfileBody`. Nothing here draws — the split the trips shelf, the packing
 * plate, the Plan week and the event poster all make, and the reason is the
 * same one every time: a screen that reaches for the closet, the outfit count,
 * the favourites, the friends, the plan, the capacity and a batch of signed
 * URLs at the top cannot be posed, and the six accepted frames have to be
 * openable without a session.
 *
 * ── WHAT IT READS, AND WHAT IT DOES NOT ADD ──────────────────────────────────
 *
 * Seven existing hooks and not one new query, column, table or endpoint. Most
 * worn is `mostWornItems` over the closet this page already draws; the marks
 * are `closetStats` plus `useOutfitCount`; the favourites rail is the
 * owner-private `useFavoriteOutfits` the closet tab already mounts; the friends
 * count is the length of the mutual list `/friends` itself reads. The plan door
 * is `useCapacity` against `usePlan`, whose ceilings come from `plans.ts`.
 *
 * ── THE ORDER, AND WHERE THE ADMINISTRATION WENT ─────────────────────────────
 *
 * Directive §7 sets the order and `profile-spec.ts` holds it. What the gear
 * used to reach is untouched: UX-05's split still stands, `/settings` still
 * owns membership, privacy, people, notifications, restore, help, sign out and
 * deletion, and this page still opens exactly one door to it — now from the
 * overflow control the artifact draws at the end of the identity row, beside
 * Edit profile and the wear diary. `features/profile/settings-copy.ts` holds
 * the reconciliation and `tests/profile-settings-split.test.ts` checks it in
 * both directions.
 */

/**
 * Name, face and account age for the identity row. Account age lives nowhere
 * else in the app, so this reads `profiles` directly rather than growing a new
 * feature module for three columns.
 *
 * The fallback chain survives every redesign: setting a display name is
 * possible but still optional, so an account that has never opened the edit
 * sheet falls back through the Apple Sign In name captured at first login, then
 * the email's local part, before giving up.
 */
async function fetchProfileHeader(): Promise<{
  name: string;
  memberSince: string | null;
  avatarUrl: string | null;
}> {
  const userId = await getUserId();
  if (!userId) return { name: 'You', memberSince: null, avatarUrl: null };

  const [{ data: claimsData }, { data: profileRow }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from('profiles')
      .select('display_name, avatar_url, created_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const claims = claimsData?.claims;
  const meta = (claims?.user_metadata ?? {}) as { full_name?: string };
  const email = (claims?.email as string | undefined) ?? null;

  const name =
    profileRow?.display_name || meta.full_name || (email ? email.split('@')[0] : null) || 'You';

  return {
    name,
    memberSince: profileRow?.created_at ?? null,
    avatarUrl: profileRow?.avatar_url ?? null,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();

  const profileHeader = useQuery({ queryKey: ['profile-header'], queryFn: fetchProfileHeader });
  // Only for the @handle under the display name — the header query above owns
  // the name's fallback chain, and `useMyProfile` is the one place the claimed
  // handle already lives client-side.
  const myProfile = useMyProfile();

  const closet = useCloset();
  const outfitCount = useOutfitCount();
  const favorites = useFavoriteOutfits();
  const friends = useFriends();
  const style = useStyleProfile();
  const capacity = useCapacity();
  const plan = usePlan();
  const gate = useGate();

  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [planUnavailable, setPlanUnavailable] = useState(false);
  // PR-C1 / PR-C2 — shown on the first Profile visit, dismissed for good.
  const coaching = useProfileCoaching();

  const items = useMemo(() => closet.data ?? [], [closet.data]);
  const numbers = useMemo(() => closetStats(items), [items]);
  const worn = useMemo(() => mostWornItems(items, MOST_WORN_TILES), [items]);
  const grid = useMemo(() => items.slice(0, CLOSET_TILES), [items]);
  const kept = useMemo(
    () => (favorites.data ?? []).slice(0, FAVORITE_TILES),
    [favorites.data],
  );

  /**
   * Every path any well on this page might draw, signed in ONE batch.
   *
   * The rails, the grid and the favourite collages together, rather than a
   * request per section: the signer takes a list, and three batches would be
   * three round trips for one screen. The preference order is the app's own —
   * the confirmed listing photo first, then the plate, the cutout and the
   * thumb.
   */
  const paths = useMemo(() => {
    const out: (string | null | undefined)[] = [];
    for (const item of [...worn, ...grid]) {
      out.push(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath);
    }
    for (const outfit of kept) out.push(...outfit.imagePaths);
    return out;
  }, [worn, grid, kept]);

  const { resolve } = useSignedUrls(paths);

  const openPlans = useCallback(() => {
    setPlanUnavailable(false);
    // A Standard member has a page of their own to read; a free member has no
    // membership to manage, so they get the file's own generic "See plans"
    // door — the same placement and the same paywall as every other one. This
    // is the routing exactly as it shipped; the redesign moved the row, not the
    // door behind it.
    if (plan.plan === 'standard') {
      router.push('/membership-upgrade' as Href);
      return;
    }
    void gate.present(Placement.RepeatUpsell).then((outcome) => {
      // `declined` is somebody closing a paywall they read. Only a paywall that
      // never arrived leaves the row looking like a dead control.
      if (outcome === 'unavailable') setPlanUnavailable(true);
    });
  }, [gate, plan.plan, router]);

  const username = myProfile.data?.username ?? '';

  const view: ProfileView = useMemo(() => {
    const state = profileBodyState({
      closetLoading: closet.isLoading,
      closetError: closet.isError,
      pieces: numbers.pieces,
    });

    return {
      state,

      name: profileHeader.data?.name ?? 'You',
      handle: username ? `@${username}` : null,
      avatarUrl: profileHeader.data?.avatarUrl ?? null,
      identityFailed: profileHeader.isError,
      onRetryIdentity: () => void profileHeader.refetch(),
      // `undefined` while the read is in flight, so the pill draws nothing
      // rather than claiming an empty circle somebody may not have.
      friends: friends.isSuccess ? (friends.data?.length ?? 0) : undefined,
      onOpenFriends: () => router.push('/friends'),

      menuOpen,
      onOpenMenu: () => setMenuOpen(true),
      onDismissMenu: () => setMenuOpen(false),
      onEditProfile: () => {
        setMenuOpen(false);
        setEditing(true);
      },
      onOpenDiary: () => {
        setMenuOpen(false);
        router.push('/diary');
      },
      onOpenSettings: () => {
        setMenuOpen(false);
        router.push('/settings' as Href);
      },
      settingsLabel: SETTINGS_TITLE,
      onDone: () => router.back(),

      mostWorn: worn.map((item) => ({
        id: item.id,
        name: pieceName(item),
        uri: resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath),
      })),
      favorites: kept.map((outfit) => ({
        id: outfit.id,
        name: outfit.name,
        pieceCount: outfit.itemIds.length,
        uris: outfit.imagePaths.map((path) => resolve(path ?? undefined)),
      })),
      marks: statMarks({
        pieces: numbers.pieces,
        outfits: outfitCount.data,
        avgCostPerWear: numbers.avgCostPerWear,
      }),
      learned: learnedLine({
        failed: style.isError,
        loading: style.isLoading,
        feedbackCount: style.data?.feedbackCount ?? 0,
        summary: style.data?.summary ?? [],
      }),
      planDoor: planDoorFor({
        plan: plan.plan,
        planName: plan.copy.name,
        planLoading: plan.loading,
        planUnconfirmed: plan.unconfirmed,
        capacityLoading: capacity.loading,
        // The numerator is the closet this page is drawing, so the row and the
        // PIECES mark above it can never print two different counts of one
        // wardrobe. The ceiling is the plan's, from `plans.ts`.
        used: numbers.pieces,
        limit: capacity.limit,
      }),
      planUnavailable,
      planUnavailableLine: UPGRADE_UNAVAILABLE_LINE,
      onPlanDoor: openPlans,
      closet: grid.map((item) => ({
        id: item.id,
        name: pieceName(item),
        uri: resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath),
      })),
      onOpenCloset: () => router.push('/(tabs)/closet'),
      onOpenItem: (id: string) => router.push({ pathname: '/item/[id]', params: { id } }),
      onOpenFavorite: (id: string) => router.push(`/diary/${id}` as Href),

      onRetry: () => {
        void closet.refetch();
        void outfitCount.refetch();
        void favorites.refetch();
      },
      onAddClothes: () => router.push('/add-clothes'),

      /**
       * PR-C1 — the coaching card, on the first visit only.
       *
       * Held back until the header query settles, so the destination is decided
       * on the real handle and photograph rather than on the empty strings a
       * loading query returns. PR-C2 is this screen with the card absent, and
       * nothing replaces it: no banner, no dot, no second invitation.
       */
      coaching:
        coaching.show && !profileHeader.isLoading && !profileHeader.isError ? (
          <ProfileCoachingCard
            destination={coachingDestination({
              handle: username,
              avatarUrl: profileHeader.data?.avatarUrl,
            })}
            onDismiss={coaching.dismiss}
            onStart={() => {
              // Dismissed either way: acting on the invitation is the strongest
              // possible signal that it has been read.
              coaching.dismiss();
              if (
                coachingDestination({
                  handle: username,
                  avatarUrl: profileHeader.data?.avatarUrl,
                }) === 'edit-profile'
              ) {
                setEditing(true);
              } else {
                router.push('/add-clothes');
              }
            }}
          />
        ) : null,
    };
  }, [
    capacity.limit,
    capacity.loading,
    closet,
    coaching,
    favorites,
    friends.data,
    friends.isSuccess,
    grid,
    kept,
    menuOpen,
    numbers,
    openPlans,
    outfitCount,
    plan.copy.name,
    plan.loading,
    plan.plan,
    plan.unconfirmed,
    planUnavailable,
    profileHeader,
    resolve,
    router,
    style.data,
    style.isError,
    style.isLoading,
    username,
    worn,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ProfileBody view={view} large={fontScale >= PROFILE_STACK_SCALE} />
      {/* Mounted only while open — a page sheet over this modal, the same sheet
          the closet's identity block opens. */}
      {editing ? <EditProfileSheet visible onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}
