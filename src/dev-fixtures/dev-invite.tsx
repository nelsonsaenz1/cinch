import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InviteFriendRow } from '@/components/events/InviteFriendRow';
import { LeaveWithoutInvitingSheet } from '@/components/events/leave-without-inviting-sheet';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import {
  buildInviteRows,
  failedSends,
  filterInviteRows,
  partitionInviteRows,
  sendResultBody,
  sendResultTitle,
  standingSummary,
  type InviteFriend,
  type InviteRosterEntry,
  type SendOutcome,
} from '@/features/events/invite-rows';
import { useTheme } from '@/theme/tokens';

/**
 * Invite Friends fixture — `cinch://dev-invite`.
 *
 * A picker over the Invite Friends State Atlas (IF-01…IF-06), drawn with the
 * real `InviteFriendRow` / `LeaveWithoutInvitingSheet` components and the
 * real `features/events/invite-rows.ts` derivations — the row classification,
 * the partition, the filter and the send copy are the actual functions the
 * live sheet calls, fed fixture data instead of a network roster.
 *
 * Dev-only: refuses outside `__DEV__`.
 */

const FRIENDS: InviteFriend[] = [
  { userId: 'ada', name: 'Ada Márquez', username: 'adam' },
  { userId: 'hana', name: 'Hana Petrova', username: 'hanap' },
  { userId: 'sena', name: 'Sena Ruiz', username: 'senaruiz' },
  { userId: 'deji', name: 'Deji Okonkwo', username: 'deji' },
  { userId: 'iris', name: 'Iris Kaneko', username: 'iriskaneko' },
  { userId: 'nora', name: 'Nora Lindqvist', username: 'nora' },
  { userId: 'noor', name: 'Noor Bakhtiari', username: 'noorb' },
  { userId: 'theo', name: 'Theo Ansah', username: 'theoansah' },
];

const ROSTER: InviteRosterEntry[] = [
  { userId: 'ada', state: 'joined' },
  { userId: 'hana', state: 'invited' },
  { userId: 'sena', state: 'declined' },
];

const ALL_ROSTER: InviteRosterEntry[] = FRIENDS.map((f, i) => ({
  userId: f.userId,
  state: (['joined', 'joined', 'joined', 'joined', 'invited', 'declined', 'joined', 'joined'] as const)[
    i
  ]!,
}));

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8 overflow-hidden rounded-plate border border-rule">
      <View className="border-b border-rule bg-tray px-4 py-2">
        <Text variant="colophon">{title}</Text>
      </View>
      <View className="bg-canvas">{children}</View>
    </View>
  );
}

const STATES = [
  { id: 'IF-01', name: 'Opened — nothing picked yet' },
  { id: 'IF-02', name: 'Three picked — the count lands on Done' },
  { id: 'IF-03', name: 'Filtering, and everyone already asked' },
  { id: 'IF-05', name: 'After Done — sending, sent, partly failed' },
  { id: 'IF-05b', name: 'Cancel with picks made' },
  { id: 'IF-06', name: 'No friends to invite' },
] as const;

type StateId = (typeof STATES)[number]['id'];

export default function DevInviteScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }
  return <DevInviteInner />;
}

function DevInviteInner() {
  const theme = useTheme();
  const [active, setActive] = useState<StateId>('IF-01');

  const [picked01, setPicked01] = useState<Set<string>>(new Set());
  const [picked02, setPicked02] = useState<Set<string>>(new Set(['deji', 'iris', 'noor']));
  const [askLeave, setAskLeave] = useState(false);

  const allRows = buildInviteRows(FRIENDS, ROSTER);
  const { alreadyInvited: ai01, yourFriends: yf01 } = partitionInviteRows(allRows);

  const outcomesSent: SendOutcome[] = [
    { userId: 'deji', name: 'Deji', ok: true },
    { userId: 'iris', name: 'Iris', ok: true },
    { userId: 'noor', name: 'Noor', ok: true },
  ];
  const outcomesPartial: SendOutcome[] = [
    { userId: 'deji', name: 'Deji', ok: true },
    { userId: 'iris', name: 'Iris', ok: true },
    { userId: 'noor', name: 'Noor', ok: false },
  ];

  const filtered = filterInviteRows(allRows, 'no');
  const allInvitedRows = buildInviteRows(FRIENDS, ALL_ROSTER);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="border-b border-rule px-gutter py-3">
        <Text variant="title" trim>
          Invite Friends
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

        {active === 'IF-01' ? (
          <Frame title="IF-01 · Opened — nothing picked yet">
            <View className="p-4">
              <SearchField value="" onChangeText={() => {}} placeholder="Filter your friends" />
            </View>
            <SectionHeader
              title="Already invited"
              className="px-4 pb-2"
              trailing={<Text variant="label">{ai01.length}</Text>}
            />
            <View className="mx-4 overflow-hidden rounded-plate border border-rule">
              {ai01.map((row, i) => (
                <InviteFriendRow
                  key={row.userId}
                  row={row}
                  selected={picked01.has(row.userId)}
                  isLast={i === ai01.length - 1}
                  onToggle={() =>
                    setPicked01((prev) => {
                      const next = new Set(prev);
                      next.has(row.userId) ? next.delete(row.userId) : next.add(row.userId);
                      return next;
                    })
                  }
                />
              ))}
            </View>
            <SectionHeader
              title="Your friends"
              className="mb-2 mt-5 px-4"
              trailing={<Text variant="label">{yf01.length}</Text>}
            />
            <View className="mx-4 mb-4 overflow-hidden rounded-plate border border-rule">
              {yf01.map((row, i) => (
                <InviteFriendRow
                  key={row.userId}
                  row={row}
                  selected={picked01.has(row.userId)}
                  isLast={i === yf01.length - 1}
                  onToggle={() =>
                    setPicked01((prev) => {
                      const next = new Set(prev);
                      next.has(row.userId) ? next.delete(row.userId) : next.add(row.userId);
                      return next;
                    })
                  }
                />
              ))}
            </View>
            <Text variant="caption" className="px-4 pb-4">
              Only friends can be invited. To add someone new, add them as a friend first.
            </Text>
          </Frame>
        ) : null}

        {active === 'IF-02' ? (
          <Frame title="IF-02 · Three picked — the count lands on Done">
            <View className="mx-4 mt-4 overflow-hidden rounded-plate border border-rule">
              {buildInviteRows(FRIENDS, ROSTER).map((row, i, list) => (
                  <InviteFriendRow
                    key={row.userId}
                    row={row}
                    selected={picked02.has(row.userId)}
                    isLast={i === list.length - 1}
                    onToggle={() =>
                      setPicked02((prev) => {
                        const next = new Set(prev);
                        next.has(row.userId) ? next.delete(row.userId) : next.add(row.userId);
                        return next;
                      })
                    }
                  />
                ))}
            </View>
            <View className="p-4">
              <View
                style={{ minHeight: 50, backgroundColor: theme.ink }}
                className="items-center justify-center rounded-md">
                <Text variant="body" style={{ color: theme.canvas }}>
                  Invite {picked02.size} {picked02.size === 1 ? 'friend' : 'friends'}
                </Text>
              </View>
            </View>
          </Frame>
        ) : null}

        {active === 'IF-03' ? (
          <Frame title="IF-03 · Filtering, and everyone already asked">
            <View className="p-4">
              <Text variant="colophon" className="mb-2">
                Filtering — “no”
              </Text>
              <SearchField value="no" onChangeText={() => {}} placeholder="Filter your friends" />
              <View className="mt-3 overflow-hidden rounded-plate border border-rule">
                {filtered.map((row, i) => (
                  <InviteFriendRow
                    key={row.userId}
                    row={row}
                    selected={false}
                    isLast={i === filtered.length - 1}
                    onToggle={() => {}}
                  />
                ))}
              </View>

              <Text variant="colophon" className="mb-2 mt-6">
                Filter matches nobody
              </Text>
              <View className="items-center rounded-plate border border-rule p-5">
                <Text variant="body" className="text-center">
                  No friend called “quinn”
                </Text>
                <Text variant="label" className="mt-2 text-center">
                  You can only invite people you’re already friends with on Cinch.
                </Text>
                <Text variant="label" className="mt-3" style={{ color: theme.accent }}>
                  Add a friend
                </Text>
              </View>

              <Text variant="colophon" className="mb-2 mt-6">
                Everyone is already invited
              </Text>
              <View className="rounded-plate border border-rule p-5">
                <Text variant="plate">All {allInvitedRows.length} are in</Text>
                <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
                  Every friend you have is on the list for this one. {standingSummary(allInvitedRows)}
                </Text>
              </View>
            </View>
          </Frame>
        ) : null}

        {active === 'IF-05' ? (
          <Frame title="IF-05 · After Done — sending, sent, partly failed">
            <View className="gap-6 p-4">
              <View>
                <Text variant="colophon" className="mb-2">
                  Sending
                </Text>
                <View
                  style={{ minHeight: 50, backgroundColor: theme.ink }}
                  className="items-center justify-center rounded-md">
                  <Text variant="body" style={{ color: theme.canvas }}>
                    Inviting…
                  </Text>
                </View>
              </View>

              <View>
                <Text variant="colophon" className="mb-2">
                  Sent — back on the occasion
                </Text>
                <View className="rounded-plate border border-rule p-4">
                  <Text variant="body">
                    {sendResultTitle(outcomesSent)}
                  </Text>
                  <Text variant="label" className="mt-1.5">
                    {sendResultBody(outcomesSent)}
                  </Text>
                </View>
              </View>

              <View>
                <Text variant="colophon" className="mb-2">
                  Partly failed
                </Text>
                <View className="overflow-hidden rounded-plate border border-rule">
                  <View className="p-4">
                    <Text variant="body">
                      {sendResultTitle(outcomesPartial)}
                    </Text>
                    <Text variant="label" className="mt-1.5">
                      {sendResultBody(outcomesPartial)}
                    </Text>
                  </View>
                  {failedSends(outcomesPartial).map((f) => (
                    <View
                      key={f.userId}
                      className="flex-row items-center gap-3 border-t border-hairline px-4 py-3">
                      <View className="flex-1">
                        <Text variant="body">{f.name}</Text>
                        <Text variant="caption" style={{ color: theme.critical }}>
                          Couldn’t invite just now
                        </Text>
                      </View>
                      <View
                        style={{ minHeight: 36, borderColor: theme.ruleStrong, borderWidth: 1 }}
                        className="items-center justify-center rounded-md px-3.5">
                        <Text variant="label">Retry</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Frame>
        ) : null}

        {active === 'IF-05b' ? (
          <Frame title="IF-05 · Cancel with picks made — tap to open">
            <View className="p-4">
              <Pressable
                onPress={() => setAskLeave(true)}
                className="rounded-md border px-4 py-3"
                style={{ borderColor: theme.rule }}>
                <Text variant="body">Cancel with 3 people checked</Text>
              </Pressable>
            </View>
            <LeaveWithoutInvitingSheet
              visible={askLeave}
              pickedCount={3}
              onKeepChoosing={() => setAskLeave(false)}
              onDiscard={() => setAskLeave(false)}
            />
          </Frame>
        ) : null}

        {active === 'IF-06' ? (
          // AUDIT 100 #58 — one reason, one recovery. See the live screen
          // (src/app/event/[id]/invite.tsx) for the full reasoning: the
          // duplicate "Share your username" action and the contacts/link
          // footer are gone rather than redrawn here.
          <Frame title="IF-06 · No friends to invite">
            <View className="items-center px-10 py-10">
              <Text variant="title" trim className="text-center">
                Nobody to invite yet
              </Text>
              <Text variant="body" className="mt-2.5 text-center" style={{ color: theme.muted }}>
                Invitations go to friends on Cinch.
              </Text>
              <View
                style={{ minHeight: 44, backgroundColor: theme.ink }}
                className="mt-5 items-center justify-center rounded-md px-5">
                <Text variant="body" style={{ color: theme.canvas }}>
                  Add a friend
                </Text>
              </View>
            </View>
          </Frame>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
