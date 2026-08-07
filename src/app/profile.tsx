import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressTrack } from '@/components/ui/progress-track';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { signOut } from '@/features/auth/actions';
import { useAiConsent, useGrantAiConsent, useRevokeAiConsent } from '@/features/auth/use-consent';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { useCloset } from '@/features/closet/queries';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
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
 * Name, face and account age for the masthead. Account age lives nowhere else
 * in the app, so this reads `profiles` directly rather than growing a new
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
 * One "Account" row: label, chevron, tap target. `tone="accent"` is spent on
 * exactly one row (Delete account) — the same one-accent-per-screen rule the
 * rest of the app follows, just applied inside a list instead of to a button.
 */
function AccountRow({
  label,
  onPress,
  tone = 'ink',
  loading = false,
  detail,
  /**
   * `chevron.right` means "further in". A row that hands you to Safari is not
   * further in — it is out of the app entirely, and iOS's own settings mark
   * that with the up-right arrow. Two glyphs for two different promises.
   */
  external = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'accent';
  loading?: boolean;
  /** Quiet fact before the chevron — "2 waiting". Data, not decoration. */
  detail?: string;
  external?: boolean;
}) {
  const theme = useTheme();
  const iconColor = tone === 'accent' ? theme.accent : theme.faint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      accessibilityHint={external ? 'Opens in your browser' : undefined}
      onPress={onPress}
      disabled={loading}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60">
      <Text variant="body" className={tone === 'accent' ? 'text-accent' : 'text-ink'}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {detail ? (
          <Text variant="caption" className="text-accent">
            {detail}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <SymbolView
            name={external ? 'arrow.up.right' : 'chevron.right'}
            size={13}
            tintColor={iconColor}
            resizeMode="scaleAspectFit"
          />
        )}
      </View>
    </Pressable>
  );
}

/**
 * Profile, analytics, settings — a modal off Today's masthead avatar, not a
 * tab. Settings do not deserve one of three permanent slots on the glass bar.
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
  const profileHeader = useQuery({ queryKey: ['profile-header'], queryFn: fetchProfileHeader });

  // Only for the "waiting" count on the Borrow requests row — the row itself
  // is the screen for everything else. No tab badges anywhere: a single quiet
  // number here is the Plate's whole tolerance for unread-count anxiety.
  const borrow = useBorrowRequests();
  const pendingAsks = (borrow.data ?? []).filter(
    (t) => t.direction === 'incoming' && t.request.status === 'pending',
  ).length;

  const consent = useAiConsent();
  const revokeConsent = useRevokeAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  const [editing, setEditing] = useState(false);

  // Only used for the exact count named in the delete-account warning below —
  // the zip's Profile screen has no wardrobe stats card, so nothing else here
  // reads from the closet. Null when the closet has not loaded (or failed to):
  // the warning then names "every piece" rather than claiming "your 0 pieces"
  // to someone whose closet simply could not be read.
  const pieceCount = closet.data?.length ?? null;

  const name = profileHeader.data?.name ?? '';
  const memberSince = profileHeader.data?.memberSince;
  const weeksLabel = useMemo(() => {
    if (!memberSince) return '';
    const weeks = weeksSince(memberSince);
    return weeks <= 0 ? 'New to Cinch' : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} with Cinch`;
  }, [memberSince]);

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

  const learnedProgress = Math.max(4, Math.min(100, Math.round((feedbackCount / TASTE_THRESHOLD) * 100)));

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in anytime — your closet stays put.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  /**
   * Two steps, and the first one enumerates exactly what disappears.
   *
   * Deletion is irreversible and takes the user's photographs with it, so a
   * single tap is too little friction — but burying it would fail the guideline
   * it exists to satisfy. Naming the consequences is what makes one extra
   * confirmation honest rather than a dark pattern in reverse.
   */
  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      `This permanently deletes ${
        pieceCount != null
          ? `your ${pieceCount} ${pieceCount === 1 ? 'piece' : 'pieces'}`
          : 'every piece in your closet'
      }, every photo you uploaded, your outfit history, and everything Cinch has learned about your style.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'There is no way to recover this.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete everything',
                style: 'destructive',
                onPress: () =>
                  deleteAccount.mutate(undefined, {
                    // Never promise a rollback. Deleting an account spans
                    // Storage and Auth, which cannot share a transaction, so a
                    // failure part-way through means photographs really are
                    // gone while the account really does remain. The server
                    // reports exactly how far it got; saying "nothing has been
                    // deleted" here would be a comforting lie about
                    // irreversible data loss. Pressing delete again resumes.
                    onError: (err) =>
                      Alert.alert(
                        'Could not finish deleting your account',
                        err instanceof Error
                          ? `${err.message}\n\nAnything already removed is permanently gone. Tap Delete again to finish the job.`
                          : 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete again to finish the job.',
                      ),
                  }),
              },
            ]),
        },
      ],
    );
  };

  /**
   * The withdrawal the consent sheet promises.
   *
   * One confirmation, not two — unlike deletion this is fully reversible, and
   * friction on the *un-sharing* direction is a dark pattern. What the dialog
   * has to do instead is be accurate about the blast radius, because the fear
   * that stops people withdrawing consent is not knowing what breaks.
   *
   * Both lists below are true as written. Outfit generation is a local beam
   * search over the closet (`src/lib/styling`) and needs neither the network
   * nor the model; only the outfit's name and its written reasoning come from
   * the AI, and without it the engine writes its own from the scoring notes.
   */
  const confirmRevoke = () => {
    Alert.alert(
      'Turn off AI features',
      'Nothing more will be sent to our AI provider.\n\nWhat stops: tagging new pieces automatically, the stylist chat, and the AI rewriting your outfit suggestions.\n\nWhat keeps working: your whole closet, everything already tagged, and outfit suggestions — those are built on your phone and never needed the AI.\n\nYou can turn it back on here whenever you like.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () =>
            revokeConsent.mutate(undefined, {
              onError: (err) =>
                Alert.alert(
                  'Could not turn off AI features',
                  err instanceof Error
                    ? err.message
                    : 'Something went wrong. Your settings have not changed.',
                ),
            }),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The way out.
          This screen is presented as a modal with no header, and it drew no
          close affordance of any kind — the only dismissal was the system
          swipe, which is undiscoverable, and a modal with no visible exit is
          the one interaction failure users report as being stuck. A ghost
          "Done" in a right-aligned header row, the grammar `review.tsx` uses.
          Always "Done" here, unlike review's: there is no work left to assert
          anything untrue about — the settings on this page save themselves. */}
      <View className="flex-row items-center justify-end px-gutter pt-2">
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerClassName="pb-24">
        {/* The masthead — avatar, name, and account age stand in for a page
            title, matching the design; VoiceOver still gets a heading. Three
            branches: skeletal while the header query is in flight (a blank
            masthead on first paint read as the app not knowing who you are),
            an honest retry line if it failed, the real thing otherwise. */}
        {profileHeader.isLoading ? (
          <View
            accessibilityLabel="Loading your profile"
            className="flex-row items-center gap-3.5 px-gutter pb-6 pt-6">
            <Skeleton className="h-14 w-14 rounded-full" />
            <View className="gap-2">
              <Skeleton className="h-5 w-36 rounded-chip" />
              <Skeleton className="h-3 w-24 rounded-chip" />
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-3.5 px-gutter pb-6 pt-6">
            {/* The shared Avatar, which carries both the photo and the
                light-on-ink monogram this screen used to hand-build (including
                the className-vs-inline-colour gotcha it used to restate). */}
            <Avatar name={name} size={56} tone="ink" imageUri={profileHeader.data?.avatarUrl} />
            <View className="flex-1">
              {/* `title` (28), matching the Closet identity block. The same
                  fact — a person's own name — was set at two sizes on two
                  screens one tap apart. */}
              <Text variant="title" trim accessibilityRole="header" numberOfLines={1}>
                {profileHeader.isError ? 'Your profile' : name}
              </Text>
              {profileHeader.isError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void profileHeader.refetch()}
                  hitSlop={8}
                  className="active:opacity-60">
                  <Text variant="caption" className="mt-1 text-muted underline">
                    Your details didn&rsquo;t load — try again
                  </Text>
                </Pressable>
              ) : (
                <Text variant="caption" className="mt-1 text-muted">
                  {weeksLabel}
                </Text>
              )}
            </View>
          </View>
        )}

        <View className="px-gutter">
          {/* The way in to name, handle, bio and photograph — the columns that
              have existed on `profiles` since the first migration with nothing
              anywhere in the app able to write them. Directly under the
              masthead it edits, above everything about the engine: this is the
              one row on the screen that changes what other people see. */}
          <Card className="mb-7">
            <AccountRow label="Edit profile" onPress={() => setEditing(true)} />
          </Card>

          {/* What the engine has learned, in the user's own terms. Showing this
              is what makes the personalisation feel like a relationship rather
              than a black box — and gives them somewhere to push back. The
              progress bar is honest about the threshold, not decorative.

              A failed style query gets its own branch: without one, the card
              fell through to feedbackCount = 0 and told a user with months of
              reactions "Nothing yet" — an error asserting something false
              about their taste. */}
          <Card padding="lg">
            <SectionHeader title="What Cinch has learned" />
            {style.isLoading ? (
              <View accessibilityLabel="Loading your style profile">
                <View className="mt-3 gap-2">
                  <Skeleton className="h-3.5 w-full rounded-chip" />
                  <Skeleton className="h-3.5 w-3/5 rounded-chip" />
                </View>
                <Skeleton className="mt-4 h-[5px] w-full rounded-full" />
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
              <>
                <Text variant="body" className="mt-2.5 text-ink">
                  {learnedSentence}
                </Text>
                {/* The bar stays `accent`: this is a task in flight (a
                    threshold being reached), not a ratio of data, which is
                    what the Closet's `accentWarm` wear bars are. */}
                <View className="mt-3.5 flex-row items-center gap-2.5">
                  <ProgressTrack value={learnedProgress / 100} className="flex-1" />
                  {/* Serif, per the zip — the one caption on this screen set in
                      Instrument Serif rather than Helvetica. Same gotcha as the
                      avatar initials above: a className font override is not
                      guaranteed to beat the variant's own family, so this goes
                      through inline style instead. */}
                  <Text
                    variant="caption"
                    className="text-muted"
                    style={{ fontFamily: 'InstrumentSerif_400Regular' }}>
                    Getting to know you
                  </Text>
                </View>
              </>
            )}
          </Card>

          <SectionHeader title="AI styling" className="mb-2.5 mt-7" />
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
            {/* Guideline 5.1.2(i) consent, and its withdrawal. The sheet shown
                before the first upload tells the user this control is here, so
                it has to be findable rather than buried under a submenu.

                While `consent` is still loading the switch itself is withheld
                (a spinner sits in its place) rather than defaulting to off: a
                control that says "off" for a beat and then flips to "on" reads
                as the app having lost the setting. */}
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text variant="body">AI features</Text>
                <Text variant="caption" className="mt-1 text-muted">
                  {consent.data
                    ? consent.data.granted
                      ? 'Tagging, stylist chat, and outfit write-ups use OpenRouter.'
                      : 'Off — nothing is sent to our AI provider.'
                    : 'Checking your setting…'}
                </Text>
              </View>
              {consent.data ? (
                <Switch
                  value={consent.data.granted}
                  onValueChange={(next) => {
                    if (next) {
                      // Re-granting opens the same full disclosure sheet a new
                      // user sees, which is what records a fresh version and
                      // timestamp. A bare toggle-to-on here would be
                      // re-consenting to text the user last read weeks ago.
                      setConsentVisible(true);
                    } else {
                      confirmRevoke();
                    }
                  }}
                  disabled={revokeConsent.isPending || grantConsent.isPending}
                  trackColor={{ false: theme.rule, true: theme.ink }}
                  accessibilityLabel="AI features"
                  accessibilityHint={
                    consent.data.granted
                      ? 'Turns off AI tagging and the stylist chat'
                      : 'Opens the AI consent details'
                  }
                />
              ) : (
                <ActivityIndicator size="small" color={theme.faint} />
              )}
            </View>
          </Card>

          <SectionHeader title="Friends &amp; borrowing" className="mb-2.5 mt-7" />
          <Card>
            <AccountRow label="Friends" onPress={() => router.push('/friends')} />
            <Rule tone="hairline" />
            <AccountRow
              label="Borrow requests"
              detail={pendingAsks > 0 ? `${pendingAsks} waiting` : undefined}
              onPress={() => router.push('/borrow')}
            />
            <Rule tone="hairline" />
            <AccountRow
              label="Blocked users"
              onPress={() => router.push({ pathname: '/friends', params: { blocked: '1' } })}
            />
          </Card>

          <SectionHeader title="Account" className="mb-2.5 mt-7" />
          <Card>
            <AccountRow
              label="Privacy"
              external
              onPress={() => void Linking.openURL(PRIVACY_URL)}
            />
            <Rule tone="hairline" />
            <AccountRow
              label="Support"
              external
              onPress={() => void Linking.openURL(SUPPORT_URL)}
            />
            <Rule tone="hairline" />
            <AccountRow label="Sign out" onPress={confirmSignOut} />
            <Rule tone="hairline" />
            <AccountRow
              label="Delete account"
              tone="accent"
              onPress={confirmDelete}
              loading={deleteAccount.isPending}
            />
          </Card>
          {/* Hard-left on the gutter like every other line on the page. The
              Plate grammar has no centred body copy, and the last line of the
              screen was the only place breaking the screen's own alignment. */}
          <Text variant="caption" className="mt-3 text-muted">
            Deleting your account permanently removes your closet, photos, and style profile.
          </Text>
        </View>
      </ScrollView>

      {/* Mounted only while open — a page sheet over this modal, the same
          sheet the closet's identity block opens. */}
      {editing ? <EditProfileSheet visible onClose={() => setEditing(false)} /> : null}

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => {
          grantConsent.mutate(undefined, {
            onSuccess: () => setConsentVisible(false),
            onError: (err) =>
              Alert.alert(
                'Could not turn AI features back on',
                err instanceof Error
                  ? err.message
                  : 'Something went wrong. Your settings have not changed.',
              ),
          });
        }}
        onDecline={() => setConsentVisible(false)}
      />
    </SafeAreaView>
  );
}
