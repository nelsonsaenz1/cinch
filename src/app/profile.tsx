import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { signOut } from '@/features/auth/actions';
import { useAiConsent } from '@/features/auth/use-consent';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { usePlan } from '@/features/billing/use-plan';
import { useCloset } from '@/features/closet/queries';
import { DeleteAccountCard } from '@/features/profile/delete-account-card';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import { membershipCopyFor } from '@/features/profile/membership-copy';
import { useMyProfile } from '@/features/profile/queries';
import { useRestorePurchases } from '@/features/profile/use-restore-purchases';
import { useBorrowRequests } from '@/features/social-graph/queries';
import { useStyleProfile } from '@/features/styling/queries';
import { getUserId, supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

// Live on Vercel. These exact URLs also go into App Store Connect, and Apple's
// reviewers must be able to open them without signing in — Vercel's deployment
// protection was on by default and had to be turned off for that reason.
// Swap both if a custom domain is ever pointed at the project.
const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const SUPPORT_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/support';

/**
 * Apple's own manage-subscriptions page. There is no StoreKit module installed
 * to present the native sheet in-app, and adding a dependency for one settings
 * row is the wrong trade — this URL opens the App Store's subscription list,
 * which is where cancellation genuinely lives anyway.
 */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

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
 * Profile, membership, settings — a form sheet off Today's masthead avatar,
 * not a tab. Settings do not deserve one of three permanent slots on the glass
 * bar, and the sheet stopping short of the top keeps the app visible behind
 * it: this is a detour, not a destination.
 *
 * In-app account deletion lives here. It is a hard App Store requirement
 * (Guideline 5.1.1(v)): an app that can create an account must let you delete
 * one from inside the app, and a support email or web form does not satisfy it.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const closet = useCloset();
  const style = useStyleProfile();
  const deleteAccount = useDeleteAccount();
  const plan = usePlan();
  const restore = useRestorePurchases();
  const profileHeader = useQuery({ queryKey: ['profile-header'], queryFn: fetchProfileHeader });
  // Only for the @handle under the display name — the header query above owns
  // the name's fallback chain, and `useMyProfile` is the one place the claimed
  // handle already lives client-side.
  const myProfile = useMyProfile();

  // Only for the "waiting" count on the Borrow requests row — the row itself
  // is the screen for everything else. No tab badges anywhere.
  const borrow = useBorrowRequests();
  const pendingAsks = (borrow.data ?? []).filter(
    (t) => t.direction === 'incoming' && t.request.status === 'pending',
  ).length;

  // Only for the On/Off fact on the AI tagging row — the switch itself, the
  // consent sheet and the revoke confirmation all live on /privacy now.
  const consent = useAiConsent();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Only used for the exact count named in the delete-account card — the
  // Profile screen has no wardrobe stats card, so nothing else here reads from
  // the closet. Null when the closet has not loaded (or failed to): the card
  // then names "every piece" rather than claiming "your 0 pieces" to someone
  // whose closet simply could not be read.
  const pieceCount = closet.data?.length ?? null;

  const name = profileHeader.data?.name ?? '';
  const memberSince = profileHeader.data?.memberSince;
  const weeksLabel = useMemo(() => {
    if (!memberSince) return '';
    const weeks = weeksSince(memberSince);
    return weeks <= 0 ? 'New to Cinch' : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} with Cinch`;
  }, [memberSince]);

  // The @handle, when one is claimed. Falling back to the account-age line
  // keeps the row honest for the (many) accounts that never opened the edit
  // sheet — a literal "@" with nothing after it would read as a broken load.
  const username = myProfile.data?.username ?? '';
  const identityByline = username ? `@${username}` : weeksLabel;

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

  // What the Membership card can honestly say (contract §4.1) — see
  // `membership-copy.ts`. Free has no membership row at all; a paid tier
  // names itself and its price, with the renewal date only once
  // `current_period_end` is known. `dev-account.tsx` drives the identical
  // function against fixture plans so this can never drift from its fixture.
  const membership = membershipCopyFor({
    plan: plan.plan,
    copy: plan.copy,
    trialing: plan.trialing,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEnd: plan.currentPeriodEnd,
  });
  const paidPlan = membership.paidPlan;

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in anytime — your closet stays put.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  /**
   * Never promise a rollback. Deleting an account spans Storage and Auth,
   * which cannot share a transaction, so a failure part-way through means
   * photographs really are gone while the account really does remain. The
   * server reports exactly how far it got; saying "nothing has been deleted"
   * here would be a comforting lie about irreversible data loss. Pressing
   * Delete everything again resumes — the copy says so, inside the card,
   * where the button that resumes it lives.
   */
  const deleteError = deleteAccount.error
    ? deleteAccount.error instanceof Error
      ? `${deleteAccount.error.message}\n\nAnything already removed is permanently gone. Tap Delete everything again to finish the job.`
      : 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete everything again to finish the job.'
    : null;

  // "Cinch 1.0.0 (218)" — expo-constants carries the config version in every
  // build. The iOS build number only exists once EAS stamps one in; until
  // then the parenthesis is dropped rather than printing "(undefined)".
  const version = Constants.expoConfig?.version ?? null;
  const build = Constants.expoConfig?.ios?.buildNumber ?? null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The way out. This sheet drew no close affordance of any kind before
          this row existed — the only dismissal was the system swipe, which is
          undiscoverable, and a modal with no visible exit is the one
          interaction failure users report as being stuck. Serif page title
          left, oxblood "Done" right, per the atlas — always "Done": there is
          no work left to assert anything untrue about, the settings on this
          page save themselves. `pt-5` clears the native sheet grabber, the
          same clearance stylist.tsx uses. */}
      <View className="flex-row items-center justify-between px-gutter pb-1 pt-5">
        <Text variant="title" trim accessibilityRole="header">
          Profile
        </Text>
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

      <ScrollView contentContainerClassName="pb-24">
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
          {/* What the engine has learned, in the user's own terms — the tray
              card, recessed rather than lifted. Showing this is what makes
              the personalisation feel like a relationship rather than a black
              box, and the bar is honest about the threshold, not decorative.

              A failed style query gets its own branch: without one, the card
              fell through to feedbackCount = 0 and told a user with months of
              reactions "Nothing yet" — an error asserting something false
              about their taste. */}
          <Card fill="none" border="none" padding="md" className="bg-tray">
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

          {/* Membership. No such row exists at all for a free account
              (contract §4.1) — there is nothing to summarise, and this app
              sells Standard and Pro, never the atlas's invented "Unlimited"
              tier. A trial names its clock; a paid tier names itself and its
              price from `plans.ts`, with the renewal date only once
              `current_period_end` is known — see `planSubtitle` above.
              "Manage" hands a paying user to the App Store, which owns the
              subscription. A mid-trial user gets no action here: the App
              Store has nothing of theirs to manage yet. */}
          {plan.loading ? (
            <>
              <SectionHeader title="Membership" className="mb-2.5 mt-6" />
              <Card>
                <View
                  className="flex-row items-center justify-between gap-3 px-4 py-3.5"
                  style={{ minHeight: MIN_TAP_TARGET }}>
                  <View accessibilityLabel="Loading your membership" className="flex-1 gap-2 py-0.5">
                    <Skeleton className="h-4 w-28 rounded-chip" />
                    <Skeleton className="h-3 w-44 rounded-chip" />
                  </View>
                </View>
              </Card>
            </>
          ) : !membership.visible ? null : (
            <>
              <SectionHeader title="Membership" className="mb-2.5 mt-6" />
              <Card>
                <View
                  className="flex-row items-center justify-between gap-3 px-4 py-3.5"
                  style={{ minHeight: MIN_TAP_TARGET }}>
                  <View className="flex-1 pr-2">
                    <Text variant="body">{membership.title}</Text>
                    {membership.subtitle ? (
                      <Text variant="caption" className="mt-1 text-muted">
                        {membership.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {membership.paidPlan ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Manage subscription"
                      accessibilityHint="Opens your App Store subscriptions"
                      onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
                      hitSlop={8}
                      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                      className="active:opacity-60">
                      <Text variant="label" className="text-accent">
                        Manage
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            </>
          )}

          <SectionHeader title="Styling" className="mb-2.5 mt-6" />
          <Card>
            {/* Decorative, not a preference: the beam search over the closet
                (src/lib/styling) has no off switch — it needs neither the
                network nor the AI provider, so there is nothing to grant or
                revoke here. This row just says so. */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text variant="body">Daily outfit styling</Text>
                <Text variant="caption" className="mt-1 text-muted">
                  Built from your closet, on this phone.
                </Text>
              </View>
              <Switch
                value
                onValueChange={() => {}}
                disabled
                trackColor={{ false: theme.rule, true: theme.ink }}
                accessibilityLabel="Daily outfit styling"
                accessibilityHint="Always on — outfits are generated on this phone, not by AI"
              />
            </View>
            <Rule tone="hairline" />
            {/* The doorway to Privacy (consent atlas A-06), where the
                Guideline 5.1.2(i) switch, its honest state line, the
                back-fill and the consent record now live. A row, not a
                switch: the control moved to a screen with room to say what
                actually leaves the phone, and this row only reports the
                state and leads there. */}
            <SettingsRow
              label="AI tagging"
              detail={consent.data ? (consent.data.granted ? 'On' : 'Off') : undefined}
              onPress={() => router.push('/privacy')}
            />
          </Card>

          {/* "People", not the mock's "People & notifications" — no
              notification settings exist in the app, and a kicker promising
              them over rows that don't deliver is a small lie. */}
          <SectionHeader title="People" className="mb-2.5 mt-6" />
          <Card>
            <SettingsRow label="Friends" onPress={() => router.push('/friends')} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Borrow requests"
              detail={pendingAsks > 0 ? `${pendingAsks} waiting` : undefined}
              onPress={() => router.push('/borrow')}
            />
            <Rule tone="hairline" />
            <SettingsRow
              label="Blocked people"
              onPress={() => router.push('/friends/blocked')}
            />
          </Card>

          {/* The utility card — no kicker, per the atlas: these rows serve
              the app rather than any one topic. Restore purchases only
              renders in builds where Superwall is configured; a restore row
              that cannot reach StoreKit is a dead end wearing a chevron. */}
          <Card className="mt-6">
            {restore.available ? (
              <>
                <SettingsRow
                  label="Restore purchases"
                  onPress={restore.restore}
                  loading={restore.restoring}
                />
                <Rule tone="hairline" />
              </>
            ) : null}
            <SettingsRow
              label="Privacy Policy"
              external
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            />
            <Rule tone="hairline" />
            <SettingsRow
              label="Support"
              external
              onPress={() => void Linking.openURL(SUPPORT_URL)}
            />
          </Card>

          {/* The way out, in both weights. Delete account is the only
              critical-coloured thing in the app; its confirmation is the
              in-sheet card below, which enumerates exactly what disappears
              and takes a typed DELETE — see delete-account-card.tsx for why
              that replaced the two-Alert chain. */}
          <Card className="mt-6">
            <SettingsRow label="Sign out" onPress={confirmSignOut} />
            <Rule tone="hairline" />
            <SettingsRow
              label="Delete account"
              tone="accent"
              onPress={() => {
                // A fresh opening should not lead with last time's failure.
                deleteAccount.reset();
                setDeleting(true);
              }}
              loading={deleteAccount.isPending}
            />
          </Card>

          {/* Centred, unlike every other line on the page — deliberately. The
              Plate grammar has no centred body copy, but this is not body
              copy: it is the edition mark on the last page of the lookbook,
              set in the attribution voice. */}
          {version ? (
            <Text variant="caption" className="mt-4 text-center text-byline">
              {`Cinch ${version}${build ? ` (${build})` : ''}`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Mounted only while open — a page sheet over this modal, the same
          sheet the closet's identity block opens. */}
      {editing ? <EditProfileSheet visible onClose={() => setEditing(false)} /> : null}

      {/* Mounted only while open, so the typed confirmation starts empty on
          every fresh opening. Stays up through a failure — the error and the
          button that resumes the deletion belong on the same surface. */}
      {deleting ? (
        <DeleteAccountCard
          pieceCount={pieceCount}
          paidPlan={paidPlan}
          pending={deleteAccount.isPending}
          errorText={deleteError}
          onDelete={() => deleteAccount.mutate()}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
