import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityCenterEmptyGlyph } from '@/components/activity-center';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { ListSkeleton } from '@/components/ui/skeleton';
import { BOUNDED_TIMEOUT_COPY } from '@/lib/bounded-load';
import { useBoundedLoad } from '@/lib/use-bounded-load';
import { Text } from '@/components/ui/text';
import { activityActionProps, ACTIVITY_EVENTS } from '@/features/activity-center/analytics';
import {
  DISMISS_SCOPE,
  NAV_TITLE,
  NEUTRAL_NAME,
  REACTION_LOOK_HEADING,
  REACTION_PRIVACY,
  REACTION_RELATION,
  REACTION_TITLE,
  REACTION_VIEW,
  reactedWith,
  reactionMute,
  REVOKED_DISMISS,
  REVOKED_REACTION_BODY,
  REVOKED_TITLE,
} from '@/features/activity-center/copy';
import { useDismissActivityEvent } from '@/features/activity-center/mutations';
import { useActivityActors, useActivityEvent } from '@/features/activity-center/queries';
import { reactionLabel, spokenElapsed } from '@/features/activity-center/sentence';
import { useMutedIds } from '@/features/social-graph/muted';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/tokens';

/**
 * AC-04 — one reaction to one of your looks — and AC-05 when it has been taken
 * back.
 *
 * `cinch://activity/reaction/:id`, on the EVENT's id. Same reasoning as the
 * invitation route, and it matters more here: `daily_social_reactions` is
 * keyed on `(outfit_id, reactor_id)`, so there is no single id a URL could
 * carry, and the event row is the only stable handle this fact has.
 *
 * ── WHAT THIS SCREEN DOES NOT SHOW ────────────────────────────────────────
 *
 * The look itself is drawn as its NAME and the day it was worn, not as a
 * photograph. AC-04's frame draws a 260pt image well, and it is deliberately
 * not built here: the look is the reader's OWN outfit, its pieces live in
 * `items` behind the owner's RLS, and assembling a collage means a second
 * query, an image pipeline, and a cutout composition that
 * `components/daily-social/look-collage.tsx` already owns for a different
 * shape of data. Rendering a grey placeholder in the meantime would be worse
 * than the honest line — a reader shown an empty frame assumes the photograph
 * failed. This is recorded as a deviation rather than papered over; the well is
 * a straightforward addition once the collage is generalised, and nothing else
 * on the screen changes when it lands.
 *
 * ── THE MUTE IS THE ONE THAT ALREADY EXISTS ───────────────────────────────
 *
 * `useMutedIds` — a local-only quiet switch, stored on the device, never
 * written to the server and never told to anybody. §13 says this action
 * "reuses existing Circles mute; no new data recipient or setting store", and
 * that is exactly what this is: no new table, no new key, no new recipient.
 */
export default function ReactionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const event = useActivityEvent(id ?? null);
  const actors = useActivityActors(event.data ? [event.data] : []);
  const dismiss = useDismissActivityEvent();
  const { isMuted, setMuted } = useMutedIds();

  const actor = event.data?.actorId ? actors.data?.get(event.data.actorId) : undefined;
  const actorName = actor?.name?.trim() || NEUTRAL_NAME;

  /**
   * The look, from the reader's own `outfits`.
   *
   * Two columns and no join. It is their outfit — the fan-out addressed this
   * event to `owner_id` — so this reads under their own RLS and needs no
   * projection view. A look that has since been deleted resolves to `null` and
   * the heading simply says less, which is correct: the reaction still happened
   * and the reader is still entitled to know about it.
   */
  const look = useQuery({
    queryKey: ['activity-look', event.data?.subjectId ?? null],
    enabled: Boolean(event.data?.subjectId),
    queryFn: async (): Promise<{ name: string | null; wornAt: string | null } | null> => {
      const outfitId = event.data?.subjectId;
      if (!outfitId) return null;
      const { data, error } = await supabase
        .from('outfits')
        .select('name, worn_at')
        .eq('id', outfitId)
        .maybeSingle();
      if (error) throw error;
      return data ? { name: data.name ?? null, wornAt: data.worn_at ?? null } : null;
    },
  });

  const loading = event.isLoading;

  /**
   * UX #59 — the activity detail's skeleton is bounded now.
   *
   * The header and the retry were already here; the wait was not. A read that
   * never settles left three placeholder rows shimmering under "Loading your
   * activity…" with nothing to press, which is the finding's "no progress or
   * timeout signal" exactly.
   */
  const load = useBoundedLoad({
    loading,
    error: event.isError,
    retrying: event.isRefetching,
    onRetry: () => void event.refetch(),
  });
  const revoked = !loading && (!event.data || Boolean(event.data.revokedAt));
  const word = reactionLabel(event.data?.payload.reaction);

  const back = () => router.back();

  const remove = () => {
    if (event.data) dismiss.mutate({ id: event.data.id, eventType: event.data.type });
    back();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={REACTION_TITLE} align="center" onBack={back} backLabel={NAV_TITLE} />

      {load.state === 'skeleton' ? (
        <ListSkeleton count={3} label="Loading your activity…" />
      ) : load.failed ? (
        // A failed READ is not a revoked event. Rendering the revoked state
        // here asserted "no longer available" over a connection problem
        // (2026-09-02 audit); this says only that the read failed, and offers it
        // again. UX #59 adds the second half: a read that never returns now ends
        // here too, in the timeout's own words, rather than shimmering forever.
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <ErrorState
            {...(load.timedOut ? BOUNDED_TIMEOUT_COPY : {})}
            onRetry={load.retry}
            retrying={load.retrying}
          />
        </View>
      ) : revoked ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}>
          <View className="flex-1 items-center pt-2">
            <ActivityCenterEmptyGlyph size={34} color={theme.muted} />
            <View style={{ marginTop: 16 }}>
              <Text variant="title" trim className="text-center text-muted">
                {REVOKED_TITLE}
              </Text>
            </View>
            <Text
              className="mt-2.5 text-center text-muted"
              style={{ fontSize: 15, lineHeight: 23, maxWidth: 300 }}>
              {REVOKED_REACTION_BODY}
            </Text>

            <View className="flex-1" />

            <View className="w-full pb-2">
              <Button title={REVOKED_DISMISS} variant="secondary" onPress={remove} />
              <Text variant="note" className="mt-3.5 text-center" style={{ fontSize: 13 }}>
                {DISMISS_SCOPE}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }}>
          <View className="flex-1">
            <View className="flex-row items-center gap-3">
              <Avatar name={actor?.name ?? null} size={44} imageUri={actor?.avatarUrl ?? null} />
              <View style={{ flex: 1 }}>
                <Text variant="body" className="text-ink" style={{ fontSize: 17, lineHeight: 23 }}>
                  {actorName}
                </Text>
                <Text variant="note" style={{ marginTop: 2, fontSize: 13 }}>
                  {REACTION_RELATION}
                  {event.data ? ` · ${spokenElapsed(event.data.occurredAt)}` : ''}
                </Text>
              </View>
            </View>

            {/* The reaction itself. One of three fixed words — there is no free
                text anywhere in `daily_social_reactions`, so nothing a stranger
                typed can reach this card. */}
            <View
              className="mt-5 rounded-lg p-4"
              style={{ backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule }}>
              <Text variant="body" className="text-ink" style={{ fontSize: 17, lineHeight: 23 }}>
                {word ? reactedWith(word) : 'Reacted to your look'}
              </Text>
            </View>

            <SectionHeader title={REACTION_LOOK_HEADING} className="mb-2 mt-6" />
            <View
              className="rounded-lg p-4"
              style={{ backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule }}>
              <Text variant="body" className="text-ink" style={{ fontSize: 15, lineHeight: 21 }}>
                {look.data?.name?.trim() || 'A look you shared'}
              </Text>
              {look.data?.wornAt ? (
                <Text variant="note" style={{ marginTop: 3, fontSize: 13 }}>
                  {`In Daily Social · ${new Date(look.data.wornAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                  })}`}
                </Text>
              ) : null}
            </View>

            <View className="flex-1" />

            <View className="pb-2" style={{ gap: 10 }}>
              <Button
                title={REACTION_VIEW}
                variant="primary"
                onPress={() => {
                  track(
                    ACTIVITY_EVENTS.action,
                    activityActionProps({
                      action: 'open',
                      surface: 'detail',
                      eventType: event.data?.type,
                    }),
                  );
                  router.push('/(tabs)/explore');
                }}
              />
              {event.data?.actorId ? (
                <Button
                  title={
                    isMuted(event.data.actorId)
                      ? `Unmute reactions from ${actorName}`
                      : reactionMute(actorName)
                  }
                  variant="secondary"
                  onPress={() => {
                    const who = event.data?.actorId;
                    if (!who) return;
                    haptics.commit();
                    setMuted(who, !isMuted(who));
                  }}
                />
              ) : null}
              {/* The read-receipt refusal, in words, on the one screen where a
                  reader would wonder. It is structural: `seen_at` is readable
                  under the recipient's own policy and there is no view,
                  function or join anywhere that hands it to the actor. */}
              <Text variant="note" className="mt-1 text-center" style={{ fontSize: 13 }}>
                {REACTION_PRIVACY}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
