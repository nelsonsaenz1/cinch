import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { weatherLineFor } from '@/components/events/EventCard';
import { RosterRow } from '@/components/events/RosterRow';
import { VenueCard } from '@/components/events/VenueCard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useStyleContext } from '@/features/context/use-style-context';
import { fetchForecast } from '@/features/context/weather';
import {
  useCancelEvent,
  useLeaveEvent,
  useRemoveMember,
  useRespondToInvite,
} from '@/features/events/mutations';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import type { EventDetail } from '@/features/events/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** Open-Meteo's free forecast horizon; past it the metadata simply omits weather. */
const FORECAST_DAYS = 16;

/** Whole days between today and `d`, in the user's own calendar. */
function daysFromToday(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/** "Fri, Aug 8, 7:30 PM" — or the span for a multi-day occasion. */
function whenLine(event: EventDetail): string {
  const dayOf = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const multiDay = event.endsAt && daysFromToday(event.endsAt) !== daysFromToday(event.startsAt);
  if (multiDay) return `${dayOf(event.startsAt)} – ${dayOf(event.endsAt!)}`;

  const time = event.startsAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dayOf(event.startsAt)}, ${time}`;
}

/** The RSVP-row pill — ink for the standing state, outline for the action. */
function Pill({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'ink' | 'outline';
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={[
        'flex-row items-center justify-center rounded-full px-6',
        onPress ? 'active:opacity-70' : '',
        tone === 'ink' ? 'bg-ink' : 'border border-rule dark:border-rule-dark',
      ].join(' ')}>
      <Text
        variant="body"
        className="font-semibold"
        style={{ color: tone === 'ink' ? theme.canvas : theme.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A quiet push-row into the boards this screen deliberately does not own. */
function NavRow({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between border-b border-hairline py-3 active:opacity-60 dark:border-hairline-dark">
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" className="text-faint dark:text-faint-dark">
            {hint}
          </Text>
        ) : null}
      </View>
      <SymbolView name="chevron.right" size={12} tintColor={theme.faint} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

/**
 * Occasion detail — the group dinner page.
 *
 * This screen owns the header, RSVP, venue and roster. Below that it HANDS
 * OFF: the look boards ("Who's wearing what") and comments are their own
 * routes owned by the event-outfits slice, reached by path string — never by
 * import — so the two features compile independently (build plan §0). At
 * integration the boards can be inlined here by rendering that slice's
 * components under the roster; the navigation rows below are the placeholder
 * composition point until that decision is made together.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();

  const eventQuery = useEvent(id ?? null);
  const members = useEventMembers(id ?? '');

  const respond = useRespondToInvite();
  const leave = useLeaveEvent();
  const cancel = useCancelEvent();
  const removeMember = useRemoveMember();

  // Live votes/comments for the boards this screen links into — mounted here
  // so the channel exists the moment the event page is open (build plan §2).
  useEventChannel(id ?? null);

  const event = eventQuery.data ?? null;
  const isMember = Boolean(event && (event.isHost || event.myState === 'joined'));

  // Display-only weather for the metadata line, from the app's existing
  // forecast source at the USER's coordinates — an honest stand-in while the
  // venue has no coordinates of its own. TODO(SOCIAL-VENUE): when venue
  // search lands, venue_meta carries coords and this fetch should use them.
  const { coords } = useStyleContext();
  const dayIndex = event ? daysFromToday(event.startsAt) : -1;
  const forecast = useQuery({
    queryKey: [
      'forecast',
      coords.latitude.toFixed(2),
      coords.longitude.toFixed(2),
      FORECAST_DAYS,
    ],
    enabled: isMember && dayIndex >= 0 && dayIndex < FORECAST_DAYS,
    staleTime: 30 * 60_000,
    queryFn: ({ signal }) =>
      fetchForecast(coords.latitude, coords.longitude, FORECAST_DAYS, signal),
  });
  const weather = dayIndex >= 0 ? (forecast.data?.[dayIndex] ?? null) : null;

  if (eventQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <ActivityIndicator color={theme.muted} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">This occasion isn’t available.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  const roster = members.data ?? [];
  const joinedCount = roster.filter((m) => m.state === 'joined').length;

  // §7.1, enforced at the surface: coarse before joined, precise after. RLS
  // hands an invitee the full row (she needs the date to decide), but venue,
  // time and logistics stay off her screen until she is on the list.
  const metadata = isMember
    ? [
        whenLine(event),
        event.venueName ?? event.venueAddress,
        weather ? weatherLineFor(weather) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : event.startsAt.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

  const colophonBits = isMember
    ? [
        event.occasion,
        event.partySize ? `table for ${event.partySize}` : null,
        event.dressCode,
      ].filter(Boolean)
    : [];

  const confirmLeave = () =>
    Alert.alert('Leave this occasion?', 'Your looks and comments go with you.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leave.mutate({ eventId: event.id }, { onSuccess: () => router.back() }),
      },
    ]);

  const confirmCancel = () =>
    Alert.alert('Cancel this occasion?', 'Everyone on the list will see it as canceled.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel it',
        style: 'destructive',
        onPress: () => cancel.mutate({ eventId: event.id }, { onSuccess: () => router.back() }),
      },
    ]);

  const confirmRemove = (userId: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'They lose access to the occasion. Nobody else is told.', [
      { text: 'Keep them', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMember.mutate({ eventId: event.id, userId }),
      },
    ]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">Event</Text>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-16" showsVerticalScrollIndicator={false}>
        <View className="mt-5">
          <Text variant="display" trim>
            {event.title}
          </Text>
        </View>

        <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
          {metadata}
        </Text>
        {colophonBits.length > 0 ? (
          <Text variant="colophon" className="mt-2">
            {colophonBits.join(' · ')}
          </Text>
        ) : null}

        {event.canceledAt ? (
          <Text variant="label" className="mt-4 text-critical dark:text-critical">
            This occasion was canceled.
          </Text>
        ) : (
          <View className="mt-5 flex-row gap-3">
            {event.isHost ? (
              <>
                <Pill label="Hosting" tone="ink" />
                <Pill
                  label="Invite"
                  tone="outline"
                  onPress={() => router.push(`/event/${event.id}/invite`)}
                />
              </>
            ) : event.myState === 'joined' ? (
              <Pill label="Going" tone="ink" onPress={confirmLeave} />
            ) : event.myState === 'invited' ? (
              <>
                <Pill
                  label="Join"
                  tone="ink"
                  onPress={() => respond.mutate({ eventId: event.id, response: 'joined' })}
                />
                <Pill
                  label="Decline"
                  tone="outline"
                  onPress={() =>
                    respond.mutate(
                      { eventId: event.id, response: 'declined' },
                      { onSuccess: () => router.back() },
                    )
                  }
                />
              </>
            ) : null}
          </View>
        )}
        {!isMember && event.myState === 'invited' ? (
          <Text variant="caption" className="mt-3 text-faint dark:text-faint-dark">
            Joining puts it on your Plan — and shows you where and when.
          </Text>
        ) : null}

        {isMember ? (
          <>
            <View className="mt-7">
              <VenueCard
                venueName={event.venueName}
                venueAddress={event.venueAddress}
                reservationUrl={event.reservationUrl}
              />
            </View>

            {/* ── COMPOSITION POINT ──────────────────────────────────────────
                The look boards and comments belong to the event-outfits slice
                (src/app/event/[id]/outfits.tsx et al). They are reached by
                route, not import; swap these rows for that slice's inline
                components at integration if one page is wanted. */}
            <Text variant="eyebrow" className="mt-8">
              Who’s wearing what
            </Text>
            <View className="mt-2">
              <NavRow
                label="The looks"
                hint="Share options, help everyone decide"
                onPress={() => router.push(`/event/${event.id}/outfits`)}
              />
              <NavRow
                label="Comments"
                onPress={() => router.push(`/event/${event.id}/comments`)}
              />
            </View>

            <View className="mt-8 flex-row items-baseline justify-between">
              <Text variant="eyebrow">The guests</Text>
              <Text variant="label" className="text-faint dark:text-faint-dark">
                {joinedCount} going
              </Text>
            </View>
            <View className="mt-1">
              {roster
                // Still-deciding rows are the host's private knowledge; a
                // guest's roster shows who is actually coming, nothing more.
                .filter((m) => m.state === 'joined' || event.isHost)
                .map((m, i, list) => (
                  <RosterRow
                    key={m.userId}
                    member={m}
                    isSelf={m.userId === session.userId}
                    isLast={i === list.length - 1}
                    onRemove={
                      event.isHost && m.role !== 'host' && m.userId !== session.userId
                        ? () => confirmRemove(m.userId, m.displayName ?? m.username ?? 'this guest')
                        : undefined
                    }
                  />
                ))}
            </View>
          </>
        ) : (
          <Text variant="label" className="mt-6 text-muted dark:text-muted-dark">
            {joinedCount > 0
              ? `${joinedCount} going so far.`
              : 'The list is still coming together.'}
          </Text>
        )}

        {!event.canceledAt && event.isHost ? (
          <Pressable
            onPress={confirmCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel this occasion"
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="mt-10 self-start active:opacity-60">
            <Text variant="label" className="text-critical dark:text-critical">
              Cancel this occasion
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
