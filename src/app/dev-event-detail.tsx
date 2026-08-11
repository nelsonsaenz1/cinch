import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttendeeLookGrid, type AttendeeLook } from '@/components/events/AttendeeLookGrid';
import { ConfirmSheet } from '@/components/events/ConfirmSheet';
import { RosterRow } from '@/components/events/RosterRow';
import { VenueCard } from '@/components/events/VenueCard';
import { YourLookCard } from '@/components/events/YourLookCard';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { DetailSkeleton, NavRow, StatePill } from '@/app/event/[id]/index';
import { groupStyleNote, type NoteBoard } from '@/features/events/group-note';
import type { EventMember } from '@/features/events/types';
import { toGarmentColors } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * Event Detail fixture — `cinch://dev-event-detail`.
 *
 * A picker over the Event Detail State Atlas (E-01…E-10), drawn with the SAME
 * components the real screen uses (`YourLookCard`, `AttendeeLookGrid`,
 * `ConfirmSheet`, `RosterRow`, `VenueCard`, and the page's own `StatePill` /
 * `NavRow` / `DetailSkeleton`) rather than a re-drawing — `event/[id]/
 * index.tsx` is unreachable in the simulator without a session, a real
 * occasion and, for half these states, a specific server refusal.
 *
 * Dev-only: refuses outside `__DEV__`, matching every other `dev-*` route.
 */

// ---------------------------------------------------------------------------
// Cast — the same people and pieces the atlas photographs.
// ---------------------------------------------------------------------------

const g = (id: string, colorName: string, category: string, subcategory: string, weight: number): Garment =>
  ({
    id,
    slot: 'base_top',
    category,
    subcategory,
    colors: toGarmentColors([{ name: colorName }]),
    visualWeight: weight,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
  }) as Garment;

const CREAM_COGNAC: Garment[] = [
  g('g1', 'cream', 'top', 'mohair sweater', 1.0),
  g('g2', 'beige', 'bottom', 'corduroy skirt', 1.1),
  g('g3', 'cognac', 'shoes', 'leather loafers', 0.6),
];
const LINEN_CHARCOAL: Garment[] = [
  g('g4', 'white', 'top', 'linen blouse', 1.0),
  g('g5', 'charcoal', 'bottom', 'tailored trousers', 1.1),
  g('g6', 'cognac', 'bag', 'leather tote', 0.4),
];
const NAVY_LOOK: Garment[] = [g('g7', 'navy', 'top', 'silk shell', 1.0)];
const BLACK_LOOK: Garment[] = [g('g8', 'black', 'top', 'crepe blouse', 1.0)];
const CHARCOAL_LOOK: Garment[] = [g('g9', 'charcoal', 'top', 'wool sweater', 1.0)];

const noResolveImage = () => undefined;

const dana: EventMember = {
  userId: 'fx-dana',
  role: 'host',
  state: 'joined',
  username: 'dana',
  displayName: 'Dana',
  avatarUrl: null,
};
const june: EventMember = {
  userId: 'fx-june',
  role: 'attendee',
  state: 'joined',
  username: 'junelee',
  displayName: 'June Lee',
  avatarUrl: null,
};
const mara: EventMember = {
  userId: 'fx-mara',
  role: 'attendee',
  state: 'joined',
  username: 'mara',
  displayName: 'Mara',
  avatarUrl: null,
};
const tom: EventMember = {
  userId: 'fx-tom',
  role: 'attendee',
  state: 'invited',
  username: 'tom',
  displayName: 'Tom',
  avatarUrl: null,
};

const ATTENDEE_GRID: AttendeeLook[] = [
  { userId: 'me', id: 'look-me', garments: CREAM_COGNAC },
  { userId: 'fx-dana', id: 'look-dana', garments: LINEN_CHARCOAL },
];
const nameOf = (userId: string) =>
  userId === 'me' ? 'You' : ({ 'fx-dana': 'Dana' }[userId] ?? null);

// ---------------------------------------------------------------------------
// Frame shell
// ---------------------------------------------------------------------------

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8 overflow-hidden rounded-plate border border-rule">
      <View className="border-b border-rule bg-tray px-4 py-2">
        <Text variant="colophon">{title}</Text>
      </View>
      <View className="bg-canvas p-4">{children}</View>
    </View>
  );
}

const STATES = [
  { id: 'E-01', name: 'Host — masthead + RSVP row' },
  { id: 'E-02', name: 'Venue, Every option, Table talk, guests, destructive' },
  { id: 'E-03', name: 'Invited — coarse until they join' },
  { id: 'E-04', name: 'Going — the guest’s foot' },
  { id: 'E-05', name: 'Canceled' },
  { id: 'E-06', name: 'Your look — the three states' },
  { id: 'E-07', name: 'The group note — computed, four situations' },
  { id: 'E-08', name: 'Who’s wearing what — nobody yet' },
  { id: 'E-09', name: 'The three confirmations' },
  { id: 'E-10', name: 'Loading and failed' },
] as const;

type StateId = (typeof STATES)[number]['id'];

export default function DevEventDetailScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }
  return <DevEventDetailInner />;
}

function DevEventDetailInner() {
  const theme = useTheme();
  const [active, setActive] = useState<StateId>('E-01');
  const [confirmKind, setConfirmKind] = useState<'cancel' | 'leave' | 'remove' | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="border-b border-rule px-gutter py-3">
        <Text variant="title" trim>
          Event Detail
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row gap-2">
            {STATES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setActive(s.id)}
                className="rounded-chip border px-3 py-1.5"
                style={{
                  borderColor: theme.rule,
                  backgroundColor: active === s.id ? theme.ink : 'transparent',
                }}>
                <Text variant="label" style={{ color: active === s.id ? theme.canvas : theme.ink }}>
                  {s.id}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerClassName="px-gutter py-6">
        <Text variant="body" className="mb-4" style={{ color: theme.muted }}>
          {STATES.find((s) => s.id === active)?.name}
        </Text>

        {active === 'E-01' ? (
          <Frame title="E-01 · Host, top of page">
            <Text variant="title" trim>
              Dana’s birthday dinner
            </Text>
            <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
              Sat, Aug 8, 7:30 PM · Bar Ideale · Feels 70°, clear evening
            </Text>
            <Text variant="colophon" className="mt-2">
              Birthday dinner · table for 6 · something festive
            </Text>
            <View className="mt-5 flex-row gap-3">
              <StatePill label="Hosting" />
              <View
                style={{ minHeight: 44, borderColor: theme.rule, borderWidth: 1 }}
                className="items-center justify-center rounded-md px-5">
                <Text variant="body" className="font-semibold">
                  Invite
                </Text>
              </View>
            </View>
          </Frame>
        ) : null}

        {active === 'E-02' ? (
          <Frame title="E-02 · Host, scrolled to the foot">
            <VenueCard
              venueName="Bar Ideale"
              venueAddress="1801 Blake St, Denver, CO"
              reservationUrl="https://opentable.com/bar-ideale"
            />
            <View className="mt-4">
              <NavRow label="Every option" hint="All the looks, with picks" onPress={() => {}} />
              <NavRow label="Table talk" trailing="8" onPress={() => {}} />
            </View>
            <SectionHeader
              title="The guests"
              className="mt-6"
              trailing={<Text variant="label">3 going</Text>}
            />
            <View className="mt-1">
              <RosterRow member={dana} isSelf={false} />
              <RosterRow member={june} isSelf={false} />
              <RosterRow member={mara} isSelf={false} />
              <RosterRow member={tom} isSelf={false} isLast />
            </View>
            <Text variant="label" className="mt-6" style={{ color: theme.critical }}>
              Cancel this occasion
            </Text>
          </Frame>
        ) : null}

        {active === 'E-03' ? (
          <Frame title="E-03 · Invited — coarse until they join">
            <Text variant="title" trim>
              Dana’s birthday dinner
            </Text>
            <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
              Sat, Aug 8
            </Text>
            <View className="mt-4 flex-row gap-3">
              <View
                style={{ minHeight: 44, backgroundColor: theme.accent }}
                className="items-center justify-center rounded-md px-6">
                <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                  Join
                </Text>
              </View>
              <View
                style={{ minHeight: 44, borderColor: theme.rule, borderWidth: 1 }}
                className="items-center justify-center rounded-md px-6">
                <Text variant="body" className="font-semibold">
                  Decline
                </Text>
              </View>
            </View>
            <Text variant="caption" className="mt-3">
              Joining puts it on your Plan — and shows you where and when.
            </Text>
            <Text variant="label" className="mt-6">
              4 going so far.
            </Text>
          </Frame>
        ) : null}

        {active === 'E-04' ? (
          <Frame title="E-04 · Going — the guest’s foot">
            <StatePill label="Going" />
            <View className="mt-5 h-px" style={{ backgroundColor: theme.rule }} />
            <Text variant="label" className="mt-5" style={{ color: theme.critical }}>
              Leave this occasion
            </Text>
          </Frame>
        ) : null}

        {active === 'E-05' ? (
          <Frame title="E-05 · Canceled">
            <Text variant="title" trim style={{ color: theme.muted }}>
              Dana’s birthday dinner
            </Text>
            <Text variant="body" className="mt-4" style={{ color: theme.muted }}>
              Sat, Aug 8, 7:30 PM · Bar Ideale
            </Text>
            <Text variant="label" className="mt-4" style={{ color: theme.critical }}>
              This occasion was canceled.
            </Text>
          </Frame>
        ) : null}

        {active === 'E-06' ? (
          <Frame title="E-06 · Your look — the three states">
            <Text variant="colophon" className="mb-2">
              Nothing shared
            </Text>
            <YourLookCard
              leading={null}
              resolveImage={noResolveImage}
              locked={false}
              onSwap={() => {}}
              onShare={() => {}}
            />

            <Text variant="colophon" className="mb-2 mt-6">
              Shared, no picks yet
            </Text>
            <YourLookCard
              leading={{ garments: LINEN_CHARCOAL, caption: null, votes: 0 }}
              resolveImage={noResolveImage}
              locked={false}
              onSwap={() => {}}
              onShare={() => {}}
            />

            <Text variant="colophon" className="mb-2 mt-6">
              Locked — the evening started
            </Text>
            <YourLookCard
              leading={{ garments: CREAM_COGNAC, caption: null, votes: 3 }}
              resolveImage={noResolveImage}
              locked
              onSwap={() => {}}
              onShare={() => {}}
            />
          </Frame>
        ) : null}

        {active === 'E-07' ? (
          <Frame title="E-07 · The group note — four situations">
            {(
              [
                {
                  label: 'You are in the set',
                  boards: [
                    { userId: 'me', garments: CREAM_COGNAC },
                    { userId: 'fx-dana', garments: CREAM_COGNAC },
                  ] as NoteBoard[],
                },
                {
                  label: 'You are the exception',
                  boards: [
                    { userId: 'me', garments: CREAM_COGNAC },
                    { userId: 'fx-dana', garments: BLACK_LOOK },
                    { userId: 'fx-june', garments: CHARCOAL_LOOK },
                  ] as NoteBoard[],
                },
                {
                  label: 'You have not picked',
                  boards: [
                    { userId: 'fx-dana', garments: NAVY_LOOK },
                    { userId: 'fx-june', garments: NAVY_LOOK },
                  ] as NoteBoard[],
                },
                {
                  label: 'Silent — fewer than two boards',
                  boards: [{ userId: 'fx-dana', garments: NAVY_LOOK }] as NoteBoard[],
                },
              ] as const
            ).map(({ label, boards }) => {
              const note = groupStyleNote(boards, 'me');
              return (
                <View key={label} className="mb-3">
                  <Text variant="colophon" className="mb-2">
                    {label}
                  </Text>
                  {note ? (
                    <View className="rounded-plate bg-tray p-4">
                      <Text variant="body">{note}</Text>
                    </View>
                  ) : (
                    <View
                      className="rounded-plate border border-dashed p-4"
                      style={{ borderColor: theme.rule }}>
                      <Text variant="caption">The plate is absent entirely.</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Frame>
        ) : null}

        {active === 'E-08' ? (
          <Frame title="E-08 · Who’s wearing what — nobody yet">
            <SectionHeader
              title="Who’s wearing what"
              trailing={<Text variant="colophon">0 of 5 shared</Text>}
            />
            <Card border="hairline" padding="xl" className="mt-3">
              <Text variant="body" style={{ color: theme.muted }}>
                Be the first to the mirror — share a look and the table follows.
              </Text>
            </Card>

            <Text variant="colophon" className="mb-2 mt-6">
              With two boards shared
            </Text>
            <AttendeeLookGrid
              boards={ATTENDEE_GRID}
              nameOf={nameOf}
              resolveImage={noResolveImage}
              onOpen={() => {}}
            />
          </Frame>
        ) : null}

        {active === 'E-09' ? (
          <Frame title="E-09 · The three confirmations — tap to open">
            <View className="gap-3">
              <Pressable
                onPress={() => setConfirmKind('cancel')}
                className="rounded-md border px-4 py-3"
                style={{ borderColor: theme.rule }}>
                <Text variant="body">Cancel this occasion?</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmKind('leave')}
                className="rounded-md border px-4 py-3"
                style={{ borderColor: theme.rule }}>
                <Text variant="body">Leave this occasion?</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmKind('remove')}
                className="rounded-md border px-4 py-3"
                style={{ borderColor: theme.rule }}>
                <Text variant="body">Remove Tom?</Text>
              </Pressable>
            </View>

            <ConfirmSheet
              visible={confirmKind === 'cancel'}
              title="Cancel this occasion?"
              body="Everyone on the list will see it as canceled."
              keepLabel="Keep it"
              destructiveLabel="Cancel it"
              onKeep={() => setConfirmKind(null)}
              onConfirm={() => setConfirmKind(null)}
            />
            <ConfirmSheet
              visible={confirmKind === 'leave'}
              title="Leave this occasion?"
              body="Your looks and comments go with you."
              keepLabel="Stay"
              destructiveLabel="Leave"
              onKeep={() => setConfirmKind(null)}
              onConfirm={() => setConfirmKind(null)}
            />
            <ConfirmSheet
              visible={confirmKind === 'remove'}
              title="Remove Tom?"
              body="They lose access to the occasion. Nobody else is told."
              keepLabel="Keep them"
              destructiveLabel="Remove"
              onKeep={() => setConfirmKind(null)}
              onConfirm={() => setConfirmKind(null)}
            />
          </Frame>
        ) : null}

        {active === 'E-10' ? (
          <Frame title="E-10 · Loading and the three independent failures">
            <Text variant="colophon" className="mb-2">
              Opening this occasion
            </Text>
            <DetailSkeleton />

            <Text variant="colophon" className="mb-2 mt-6">
              The occasion didn’t load
            </Text>
            <ErrorState
              compact
              title="This occasion didn’t load"
              body="It’s still there — the connection dropped on the way. Try again in a moment."
              onRetry={() => {}}
            />

            <Text variant="colophon" className="mb-2 mt-6">
              The looks didn’t load — the venue still prints beneath it
            </Text>
            <ErrorState
              compact
              title="The looks didn’t load"
              body="Nobody’s board is lost — the connection dropped on the way."
              onRetry={() => {}}
            />
            <VenueCard
              venueName="Bar Ideale"
              venueAddress="1801 Blake St, Denver, CO"
              reservationUrl={null}
            />

            <Text variant="colophon" className="mb-2 mt-6">
              The guest list didn’t load
            </Text>
            <ErrorState
              compact
              title="The guest list didn’t load"
              body="This is a connection problem, not a change to who is coming."
              onRetry={() => {}}
            />
          </Frame>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
