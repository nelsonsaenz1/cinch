import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Placement } from '@/features/billing/placements';
import { UPGRADE_UNAVAILABLE_LINE } from '@/features/billing/upgrade-delta';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { ValueRow } from '@/components/ui/settled-row';
import { ProfileCoachingCard } from '@/components/profile/profile-coaching-card';
import { coachingDestination, PR_C2_IDENTITY_GAP } from '@/features/examples/example-copy';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import { SETTINGS_TITLE } from '@/features/profile/settings-copy';
import { useProfileCoaching } from '@/features/profile/use-profile-coaching';
import { useMyProfile } from '@/features/profile/queries';
import { useStyleProfile } from '@/features/styling/queries';
import { getUserId, supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** How many reactions the style engine wants before it will say anything about taste. */
const TASTE_THRESHOLD = 8;

function weeksSince(iso: string): number {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / (7 * 24 * 60 * 60 * 1000)));
}

/** "a, b, and c" — never an Oxford-less run-on, never a trailing "and" for one item. */
function joinNaturally(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Name, face and account age for the identity row. Account age lives nowhere
 * else in the app, so this reads `profiles` directly rather than growing a new
 * feature module for three columns.
 *
 * The fallback chain survives the arrival of the edit-profile sheet: setting
 * a display name is now possible but still optional, so an account that has
 * never opened the sheet falls back through the Apple Sign In name captured
 * at first login, then the email's local part, before giving up.
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

/**
 * Profile — a form sheet off Today's masthead avatar, not a tab. It does not
 * deserve one of four permanent slots on the glass bar, and the sheet keeping
 * the app visible behind it says the right thing: this is a detour, not a
 * destination.
 *
 * ── UX-05: what this screen is now ────────────────────────────────────────
 *
 * Identity, the closet signals derived from it, and the fields other people can
 * see. Who you are here, how much of your allowance you are using, what Cinch
 * has learned from you, and what you have actually worn.
 *
 * Everything that administers the account — membership, preferences, people
 * controls, notifications, help, diagnostics, sign out and deletion, including
 * the App Store's required in-app deletion (Guideline 5.1.1(v)) — is one gear
 * away at `/settings`. It was all on this screen, below the identity block, and
 * the mix meant a user who came to check their handle scrolled past eleven
 * cards of administration to leave. Two errands, two surfaces, one push
 * between them.
 *
 * `features/profile/settings-copy.ts` holds the row-by-row reconciliation of
 * the split; nothing was dropped in it.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const style = useStyleProfile();
  // PR-01's capacity band. Two counters, both with a real read behind them —
  // correction 30 removed the weekly outfit-usage row because no such counter
  // exists anywhere in the app or the schema.
  const capacity = useCapacity();
  const profileHeader = useQuery({ queryKey: ['profile-header'], queryFn: fetchProfileHeader });
  // Only for the @handle under the display name — the header query above owns
  // the name's fallback chain, and `useMyProfile` is the one place the claimed
  // handle already lives client-side.
  const myProfile = useMyProfile();

  const [editing, setEditing] = useState(false);
  // PR-C1 / PR-C2 — shown on the first Profile visit, dismissed for good.
  const coaching = useProfileCoaching();

  // The door in the capacity band. Settings deliberately draws no membership
  // row for a free account, so this card is the ONLY surface where a free
  // member ever meets their ceiling — and until now it was a wall with nothing
  // in it. The row appears at four fifths of the active limit, which is where
  // the number stops being trivia and starts being a decision.
  //
  // `unconfirmed` is excluded as well as `loading`: `usePlan` answers `free` on
  // an unreadable read, which is the right answer for a gate and a false claim
  // for a label reading "Cinch Free".
  const plan = usePlan();
  const gate = useGate();
  const [planUnavailable, setPlanUnavailable] = useState(false);
  const nearCeiling =
    !plan.loading &&
    !plan.unconfirmed &&
    plan.plan !== 'pro' &&
    !capacity.loading &&
    capacity.limit > 0 &&
    capacity.used / capacity.limit >= 0.8;

  const openPlans = useCallback(() => {
    setPlanUnavailable(false);
    // A Standard member has a page of their own to read; a free member has no
    // membership to manage, so they get the file's own generic "See plans"
    // door — the same placement and the same paywall as every other one.
    if (plan.plan === 'standard') {
      router.push('/membership-upgrade' as Href);
      return;
    }
    void gate.present(Placement.RepeatUpsell).then((outcome) => {
      // `declined` is somebody closing a paywall they read. Only a paywall
      // that never arrived leaves the row looking like a dead control.
      if (outcome === 'unavailable') setPlanUnavailable(true);
    });
  }, [gate, plan.plan, router]);

  const name = profileHeader.data?.name ?? '';
  const memberSince = profileHeader.data?.memberSince;
  const weeksLabel = useMemo(() => {
    if (!memberSince) return '';
    const weeks = weeksSince(memberSince);
    return weeks <= 0 ? 'New to Cinch' : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} with Cinch`;
  }, [memberSince]);

  // The @handle, when one is claimed.
  //
  // PR-C2 changes what stands in when there is none. It used to be the
  // account-age line, which was honest but said nothing worth acting on; the
  // frame puts the identity gap here instead — "the identity gap is stated
  // once, quietly, on the row that fixes it", and this row carries the Edit
  // profile control. Never a bare "@", which reads as a broken load.
  //
  // The gap only appears once the query has actually answered. An empty
  // username during the read is not a missing handle, and telling somebody who
  // has one to go and add one is worse than a beat of nothing.
  const username = myProfile.data?.username ?? '';
  const identityByline = username
    ? `@${username}`
    : myProfile.isSuccess
      ? PR_C2_IDENTITY_GAP
      : weeksLabel;

  const feedbackCount = style.data?.feedbackCount ?? 0;

  // The honest sentence the "What Cinch has learned" card promises: say
  // plainly how little there is to go on before pretending to know a taste.
  const learnedSentence = useMemo(() => {
    if (feedbackCount === 0) {
      return 'Nothing yet — react to a few outfits and Cinch will start learning what you actually wear.';
    }
    if (feedbackCount < TASTE_THRESHOLD) {
      const remaining = TASTE_THRESHOLD - feedbackCount;
      return `Still early. ${remaining} more ${remaining === 1 ? 'reaction' : 'reactions'} and Cinch will start recognising your taste.`;
    }
    const summary = style.data?.summary ?? [];
    return summary.length > 0
      ? `Still learning. So far you ${joinNaturally(summary)}. Learned from ${feedbackCount} reactions.`
      : `Learned from ${feedbackCount} reactions, but no clear pattern yet.`;
  }, [feedbackCount, style.data?.summary]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The way out, and — UX-05 — the way further in. This sheet drew no
          close affordance of any kind before this row existed: the only
          dismissal was the system swipe, which is undiscoverable, and a modal
          with no visible exit is the one interaction failure users report as
          being stuck. Serif page title left, the gear and oxblood "Done" right,
          in that order — Done is the rightmost thing on the row because it is
          the one every visit ends with. `pt-5` clears the native sheet grabber,
          the same clearance stylist.tsx uses. */}
      <View className="flex-row items-center justify-between px-gutter pb-1 pt-5">
        {/* `flex-1` + one line on the title, `flex-none` on the pair. At AX5
            the serif grows past the space it has, and something has to give:
            a truncated page title is recoverable, a "Done" pushed off the
            right edge is not. The two controls keep their full width at every
            Dynamic Type size. */}
        <Text variant="title" trim accessibilityRole="header" numberOfLines={1} className="flex-1 pr-3">
          Profile
        </Text>
        <View className="flex-none flex-row items-center gap-4">
          {/* The gear. Labelled for VoiceOver rather than left as an unnamed
              glyph, and given the standard hint because "Settings" alone does
              not say that this one leaves the page.

              `gearshape` at 19 rather than the 13 the settings-row chevron
              uses: that glyph is a trailing punctuation mark inside a row, this
              one is a control in its own right and has to hold its own beside
              a 28pt serif. `hitSlop` takes the visual glyph out to the 44pt
              floor without drawing a 44pt button next to "Done". */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SETTINGS_TITLE}
            accessibilityHint="Membership, privacy, people, help and your account"
            onPress={() => router.push('/settings' as Href)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            <SymbolView
              name="gearshape"
              size={19}
              tintColor={theme.ink}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={() => router.back()}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            {/* `label`, matching the edit sheet's own header actions — and no
                second font-* class: text.tsx documents that two family classes
                on one element resolve by coin toss. */}
            <Text variant="label" className="text-accent">
              Done
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-24">
        {/*
          PR-C1 — the coaching card, on the first visit only.

          It sits ABOVE the identity row it is talking about, because the thing
          it teaches ("this is what your friends see") is what the row below
          controls. PR-C2 is this screen with the card absent, and nothing
          replaces it: no banner, no dot, no second invitation. The identity gap
          is still stated, once and quietly, on the row that fixes it.

          Held back until the header query settles, so the destination is
          decided on the real handle and photograph rather than on the empty
          strings a loading query returns — a card that offered "Start mine" to
          Edit profile for somebody who had already filled both in would be
          sending them to correct nothing.
        */}
        {coaching.show && !profileHeader.isLoading && !profileHeader.isError ? (
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
        ) : null}

        {/* The identity row — avatar, name, handle, and the way in to editing
            them. Three branches: skeletal while the header query is in flight
            (a blank row on first paint read as the app not knowing who you
            are), an honest retry line if it failed, the real thing otherwise. */}
        {profileHeader.isLoading ? (
          <View
            accessibilityLabel="Loading your profile"
            className="flex-row items-center gap-3.5 px-gutter pb-5 pt-4">
            <Skeleton className="h-[60px] w-[60px] rounded-full" />
            <View className="gap-2">
              <Skeleton className="h-5 w-36 rounded-chip" />
              <Skeleton className="h-3 w-24 rounded-chip" />
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-3.5 px-gutter pb-5 pt-4">
            {/* The shared Avatar, which carries both the photo and the
                light-on-ink monogram this screen used to hand-build (including
                the className-vs-inline-colour gotcha it used to restate). */}
            <Avatar name={name} size={60} tone="ink" imageUri={profileHeader.data?.avatarUrl} />
            <View className="flex-1">
              {/* Serif, at the same size as the page title — the atlas sets
                  both at 26 and the `title` token (28) is the nearest cut. */}
              <Text variant="title" trim numberOfLines={1}>
                {profileHeader.isError ? 'Your profile' : name}
              </Text>
              {profileHeader.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void profileHeader.refetch()}
                  hitSlop={8}
                  className="active:opacity-60">
                  <Text variant="caption" className="mt-1.5 text-muted underline">
                    Your details didn&rsquo;t load — try again
                  </Text>
                </Pressable>
              ) : (
                <Text variant="caption" className="mt-1.5 text-muted">
                  {identityByline}
                </Text>
              )}
            </View>
            {/* The way in to name, handle, bio and photograph — the one thing
                on this screen that changes what other people see, so it sits
                on the identity it edits. A 32pt bordered pill per the atlas —
                but `rounded-md`, not the mock's half-height radius: a labelled
                capsule is the one shape the type system forbids
                (tailwind.config.js, borderRadius). The hitSlop stretches the
                32pt visual to the 44pt floor. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => setEditing(true)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              className="h-8 flex-none items-center justify-center rounded-md border border-rule px-3.5 active:opacity-60">
              <Text variant="label" className="text-ink">
                Edit profile
              </Text>
            </Pressable>
          </View>
        )}

        <View className="px-gutter">
          {/* PR-01's capacity band. ONLY the two counters that can be counted:
              `useCapacity` reads both off `items` against the plan's ceilings,
              which mirror the two database triggers. Correction 30 deleted the
              weekly outfit-usage read because there is no such counter, and the
              rows simply do not draw while the count is in flight — "0 of 10"
              is a claim about somebody's closet, and a pending count is not a
              zero. */}
          {capacity.loading ? null : (
            <Card padding="none">
              <ValueRow
                label="Active pieces"
                value={`${capacity.used} of ${capacity.limit}`}
              />
              <Rule tone="hairline" />
              <ValueRow
                label="Stored pieces"
                value={`${capacity.stored} of ${capacity.storedLimit}`}
              />
              {/* Not a button, and deliberately not an accent one: this
                  screen's single oxblood is already spent on Done in the
                  header. A plain chevron row inside the card the numbers are
                  in, so the ceiling has a door beside it rather than a banner
                  over it. */}
              {nearCeiling ? (
                <>
                  <Rule tone="hairline" />
                  <SettingsRow
                    label={`Cinch ${plan.copy.name}`}
                    detail="See plans"
                    onPress={openPlans}
                  />
                </>
              ) : null}
            </Card>
          )}

          {/* Drawn only when a paywall was asked for and never arrived, so the
              row above is never a control that appears to do nothing. */}
          {planUnavailable ? (
            <Text variant="note" className="mt-2.5">
              {UPGRADE_UNAVAILABLE_LINE}
            </Text>
          ) : null}

          {/* What the engine has learned, in the user's own terms — the tray
              card, recessed rather than lifted. Showing this is what makes
              the personalisation feel like a relationship rather than a black
              box, and the bar is honest about the threshold, not decorative.

              A failed style query gets its own branch: without one, the card
              fell through to feedbackCount = 0 and told a user with months of
              reactions "Nothing yet" — an error asserting something false
              about their taste. */}
          <Card fill="none" border="none" padding="md" className="mt-6 bg-tray">
            <SectionHeader title="What Cinch has learned" />
            {style.isLoading ? (
              <View accessibilityLabel="Loading your style profile">
                <View className="mt-2.5 gap-2">
                  <Skeleton className="h-3.5 w-full rounded-chip" />
                  <Skeleton className="h-3.5 w-3/5 rounded-chip" />
                </View>
                <Skeleton className="mt-3.5 h-[5px] w-full rounded-full" />
              </View>
            ) : style.isError ? (
              <>
                <Text variant="body" className="mt-2.5 text-muted">
                  This didn&rsquo;t load — everything Cinch has learned is still saved.
                </Text>
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={() => void style.refetch()}
                  loading={style.isRefetching}
                  className="mt-3.5 self-start px-6"
                />
              </>
            ) : (
              // The sentence is the real learned-style summary. No percentage
              // beside it (contract §4.3): there is no confidence, coverage or
              // completeness metric anywhere in the style profile, and a bar
              // or a number here would invent one to fill the slot the same
              // way a guessed temperature would.
              <Text variant="body" className="mt-2.5 text-ink">
                {learnedSentence}
              </Text>
            )}
          </Card>

          {/* The record of what was actually worn — a wear is an `outfits` row
              with `worn_at`. It stays on Profile rather than following the
              administration behind the gear, because it is the same kind of
              fact as the two cards above it: something derived from this
              person's own closet, not a control over the account. */}
          <SectionHeader title="Your record" className="mb-2.5 mt-6" />
          <Card>
            <SettingsRow label="Wear diary" onPress={() => router.push('/diary')} />
          </Card>
        </View>
      </ScrollView>

      {/* Mounted only while open — a page sheet over this modal, the same
          sheet the closet's identity block opens. */}
      {editing ? <EditProfileSheet visible onClose={() => setEditing(false)} /> : null}
    </SafeAreaView>
  );
}
