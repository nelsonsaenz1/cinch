import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  RequestRow,
  SearchResultRow,
  type RequestRowState,
  type SearchRelation,
} from '@/components/social/friend-rows';
import {
  BlockConfirmSheet,
  FriendOverflowSheet,
  RemoveFriendDialog,
  ReportSheet,
} from '@/components/social/friend-sheets';
import { FriendsPage, type FriendsPageProps } from '@/components/social/friends-page';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import type { SocialProfile } from '@/features/social-graph/types';

/**
 * Friends fixture — `cinch://dev-friends`.
 *
 * A picker over the Friends State Atlas (F-01…F-08), so the page can be
 * verified state by state on a simulator, where the real screen is
 * unreachable without a session, a populated graph, and — for half the
 * states — a specific in-flight mutation.
 *
 * Every state is drawn by the SAME components the real screen uses:
 * `FriendsPage` for the full-page frames, `RequestRow`/`SearchResultRow` for
 * the per-row state strips, and the four sheets from `friend-sheets.tsx`.
 * There is no hand copy in this file — if a frame needs presentation to
 * behave differently, it gets a prop in the shared component, never a
 * re-drawing here. The relative-time strings come from `waitingSince` fed
 * with computed dates (now minus two days, now minus eight), so the util is
 * what is being verified, not a transcription of its output.
 *
 * Dev-only, like every other `dev-` route: the auth gate in `app/_layout.tsx`
 * bounces the whole prefix outside `__DEV__`, and this file refuses a second
 * time below in case the route is ever reached another way.
 */

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

function person(id: string, displayName: string, username: string): SocialProfile {
  return { userId: id, username, displayName, avatarUrl: null, bio: null };
}

const IRIS = person('fx-iris', 'Iris Kaneko', 'iriskaneko');
const THEO = person('fx-theo', 'Theo Ansah', 'theoansah');
const ADA = person('fx-ada', 'Ada Márquez', 'adam');
const DEJI = person('fx-deji', 'Deji Okonkwo', 'deji');
const HANA = person('fx-hana', 'Hana Petrova', 'hanap');
const NORA_L = person('fx-nora-l', 'Nora Lindqvist', 'nora');
const SENA = person('fx-sena', 'Sena Ruiz', 'senaruiz');
const NOOR = person('fx-noor', 'Noor Bakhtiari', 'noorb');
const NORA_F = person('fx-nora-f', 'Nora Farrell', 'norafarrell');
const NOMI = person('fx-nomi', 'Nomi Osei', 'nomio');
const MAYA = person('fx-maya', 'Maya Osei', 'mayaosei');

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

const STATES = [
  { id: 'F-01', name: 'Two requests waiting' },
  { id: 'F-02', name: 'Nothing waiting — resting' },
  { id: 'F-03', name: 'No one yet' },
  { id: 'F-04', name: 'Request states, in sequence' },
  { id: 'F-05', name: 'Search — the relationships' },
  { id: 'F-06', name: 'Row overflow' },
  { id: 'F-07', name: 'Block — the confirm' },
  { id: 'F-08a', name: 'Remove friend' },
  { id: 'F-08b', name: 'Report' },
  { id: 'F-08c', name: 'Report — after sending' },
] as const;

type StateId = (typeof STATES)[number]['id'];

/** Everything a full-page frame needs, quiet by default. Frames override data. */
function pageProps(overrides: Partial<FriendsPageProps>): FriendsPageProps {
  const noop = () => undefined;
  return {
    query: '',
    onQueryChange: noop,
    searching: false,
    searchLoading: false,
    searchError: false,
    searchRetrying: false,
    onRetrySearch: noop,
    searchRows: [],
    onAddFromSearch: noop,
    onAcceptFromSearch: noop,
    onCancelAsk: noop,
    searchPendingId: null,
    requests: [],
    requestsError: false,
    requestsRetrying: false,
    onRetryRequests: noop,
    onAccept: noop,
    onNotNow: noop,
    onUndo: noop,
    onRetryAccept: noop,
    friends: [],
    friendsLoading: false,
    friendsError: false,
    friendsRetrying: false,
    onRetryFriends: noop,
    onOpenFriend: noop,
    onOverflow: noop,
    sent: [],
    showEmpty: false,
    canShareUsername: true,
    onShareUsername: noop,
    refreshing: false,
    onRefresh: noop,
    ...overrides,
  };
}

/** The strip label above each isolated row state. */
function StripLabel({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" className="mb-2.5 mt-6">
      {children}
    </Text>
  );
}

export default function DevFriendsScreen() {
  const [state, setState] = useState<StateId>('F-01');
  const insets = useSafeAreaInsets();

  // Computed once per mount — a fixture that recomputes "2 days ago" every
  // render would still be right, but the dates only need to exist.
  const requestsWaiting = useMemo(
    () => [
      { profile: IRIS, requestedAt: daysAgo(2), state: 'waiting' as RequestRowState },
      { profile: THEO, requestedAt: daysAgo(8), state: 'waiting' as RequestRowState },
    ],
    [],
  );

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const fiveFriends = [ADA, DEJI, HANA, NORA_L, SENA];
  const sixFriends = [ADA, DEJI, HANA, IRIS, NORA_L, SENA];
  const restingPage = pageProps({ friends: sixFriends });

  // Sheets return the picker to the resting frame on close, because a modal
  // with a no-op close would leave the fixture with no way back to the chips.
  const closeTo = (id: StateId) => () => setState(id);

  const searchStrip: { label: string; relation: SearchRelation; profile: SocialProfile }[] = [
    { label: 'Add', relation: 'add', profile: NORA_F },
    { label: 'Requested', relation: 'requested', profile: NOOR },
    { label: 'Friends', relation: 'friends', profile: NORA_L },
    { label: 'Accept — they already asked you', relation: 'accept', profile: NOMI },
  ];

  const requestStrip: { label: string; state: RequestRowState }[] = [
    { label: 'Waiting', state: 'waiting' },
    { label: 'Accepting — optimistic', state: 'adding' },
    { label: 'Accepted', state: 'accepted' },
    { label: 'Not now', state: 'dismissed' },
    { label: 'Failed', state: 'failed' },
  ];

  const selected = STATES.find((s) => s.id === state)!;

  return (
    <View className="flex-1 bg-canvas">
      {/* The frame under review. */}
      {state === 'F-04' ? (
        <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
          <ScrollView contentContainerClassName="px-gutter pb-32">
            <Text variant="display" trim className="pt-3">
              Request states
            </Text>
            {requestStrip.map((strip) => (
              <View key={strip.label}>
                <StripLabel>{strip.label}</StripLabel>
                <Card>
                  <RequestRow
                    profile={IRIS}
                    requestedAt={daysAgo(2)}
                    state={strip.state}
                    onAccept={() => undefined}
                    onNotNow={() => undefined}
                    onUndo={() => undefined}
                    onRetry={() => undefined}
                  />
                </Card>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      ) : state === 'F-05' ? (
        <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
          <ScrollView contentContainerClassName="px-gutter pb-32">
            <Text variant="display" trim className="pt-3">
              Search states
            </Text>
            <StripLabel>The four relationships</StripLabel>
            <Card>
              {searchStrip.map((strip, i) => (
                <View key={strip.profile.userId}>
                  {i > 0 ? <Rule tone="hairline" /> : null}
                  <SearchResultRow
                    profile={strip.profile}
                    relation={strip.relation}
                    onAdd={() => undefined}
                    onAccept={() => undefined}
                    onCancel={() => undefined}
                    onOpen={() => undefined}
                  />
                </View>
              ))}
            </Card>
            <StripLabel>After Add</StripLabel>
            <Card>
              <SearchResultRow
                profile={NORA_F}
                relation="asked"
                onAdd={() => undefined}
                onAccept={() => undefined}
                onCancel={() => undefined}
                onOpen={() => undefined}
              />
            </Card>
            <StripLabel>Yourself</StripLabel>
            <Card>
              <SearchResultRow
                profile={MAYA}
                relation="self"
                onAdd={() => undefined}
                onAccept={() => undefined}
                onCancel={() => undefined}
                onOpen={() => undefined}
              />
            </Card>
          </ScrollView>
        </SafeAreaView>
      ) : state === 'F-01' ? (
        <FriendsPage
          {...pageProps({ requests: requestsWaiting, friends: fiveFriends, sent: [NOOR] })}
        />
      ) : state === 'F-03' ? (
        <FriendsPage {...pageProps({ showEmpty: true })} />
      ) : (
        // F-02 resting page, doubling as the ground the sheets float over.
        <FriendsPage {...restingPage} />
      )}

      {/* F-06 · overflow, titled with the person — "friends since March"
          computed from a real date, not typed. */}
      <FriendOverflowSheet
        profile={
          state === 'F-06'
            ? { ...DEJI, friendsSince: new Date(new Date().getFullYear(), 2, 15).toISOString() }
            : null
        }
        onClose={closeTo('F-02')}
        isMuted={false}
        onViewCloset={closeTo('F-02')}
        onMute={closeTo('F-02')}
        onRemove={closeTo('F-08a')}
        onReport={closeTo('F-08b')}
        onBlock={closeTo('F-07')}
      />
      <BlockConfirmSheet
        profile={state === 'F-07' ? DEJI : null}
        onClose={closeTo('F-02')}
        onBlock={closeTo('F-02')}
        pending={false}
      />
      <RemoveFriendDialog
        profile={state === 'F-08a' ? DEJI : null}
        onClose={closeTo('F-02')}
        onRemove={closeTo('F-02')}
        pending={false}
      />
      <ReportSheet
        profile={state === 'F-08b' || state === 'F-08c' ? DEJI : null}
        onClose={closeTo('F-02')}
        onSubmit={() => setState('F-08c')}
        pending={false}
        sent={state === 'F-08c'}
        onDone={closeTo('F-02')}
      />

      {/* The picker. Scaffolding, not a designed surface — floated over the
          foot of the frame so the page keeps its real geometry above it. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-rule bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip key={s.id} label={s.id} selected={s.id === state} onPress={() => setState(s.id)} />
          ))}
        </ScrollView>
        <Text variant="caption" className="px-gutter pb-1">
          {selected.id} · {selected.name}
        </Text>
      </View>
    </View>
  );
}
