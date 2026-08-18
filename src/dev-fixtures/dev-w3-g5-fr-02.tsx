import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RequestRow } from '@/components/social/friend-rows';
import { BlockedResult, FriendsPage } from '@/components/social/friends-page';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { FR_FAILED, FR_SET_ASIDE } from '@/features/social/w3-g5-fixtures';

/**
 * FR-02 — empty, failed action, blocked result. Three states, drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · THE EMPTY leads with what friendship MEANS for privacy — "Friends can see
 *   the looks you choose to share and lend pieces if they opt in. Nothing in
 *   your closet is shared until you decide it is." — rather than with an
 *   exhortation to invite. Both halves are shipping truth: lending is per
 *   garment (`items.borrowable`), never an account setting. The page's ONE
 *   oxblood action sits here, on Invite someone.
 * · THE FAILED ACCEPT keeps the row, its avatar and its position, states that
 *   nothing reached her — "Accepting did not go through. Priya Raghunathan has
 *   not been told anything." — and retries in place. No toast, no removal, and
 *   no ambiguity about whether she was declined.
 * · THE SET-ASIDE ROW is the same refusal from the other end: "Request from
 *   Marguerite Okonkwo-Bell set aside · Still waiting in Friends. Marguerite
 *   Okonkwo-Bell was not told." with a real Undo beside it. The undo is not
 *   drawn scenery — `undoNotNow` deletes the id from the device set that hid
 *   the row, which is the whole of what "Not now" did.
 * · THE BLOCKED RESULT uses the SAFETY PAGE'S OWN STRINGS. `BLOCK_EFFECT` in
 *   `components/social/friends-lines.ts` is the sentence `BlockedList` prints
 *   above the blocked rows; both surfaces import the one constant, so the
 *   policy is stated once. It includes the fact the frame exists for: the other
 *   person is not told.
 *
 * DETERMINISM: fixtures only, no clock, no query, no spinner. Each panel is the
 * shipping component — `FriendsPage`, `RequestRow`, `BlockedResult` — posed in
 * the state, not a redrawing of it.
 */
export default function DevW3G5FR02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-12">
        <Panel label="Empty">
          {/* The whole page, because the empty state IS the page — it takes the
              remaining canvas rather than sitting in a card. */}
          <View style={{ height: 520 }}>
            <FriendsPage
              query=""
              onQueryChange={() => undefined}
              searching={false}
              searchLoading={false}
              searchError={false}
              searchRetrying={false}
              onRetrySearch={() => undefined}
              searchRows={[]}
              onAddFromSearch={() => undefined}
              onAcceptFromSearch={() => undefined}
              onCancelAsk={() => undefined}
              searchPendingId={null}
              requests={[]}
              requestsError={false}
              requestsRetrying={false}
              onRetryRequests={() => undefined}
              onAccept={() => undefined}
              onNotNow={() => undefined}
              onUndo={() => undefined}
              onRetryAccept={() => undefined}
              friends={[]}
              friendsLoading={false}
              friendsError={false}
              friendsRetrying={false}
              onRetryFriends={() => undefined}
              onOpenFriend={() => undefined}
              onOverflow={() => undefined}
              sent={[]}
              showEmpty
              canInvite
              onInvite={() => undefined}
              refreshing={false}
              onRefresh={() => undefined}
        onBack={() => undefined}
        searchOpen={false}
        onSearchOpen={() => undefined}
        presence={new Map()}
        presenceWithheld={false}
        large={false}
            />
          </View>
        </Panel>

        <Panel label="Action failed">
          <Card>
            {FR_FAILED.map((row) => (
              <RequestRow
                key={row.profile.userId}
                profile={row.profile}
                requestedAt={row.requestedAt}
                state={row.state}
                onAccept={() => undefined}
                onNotNow={() => undefined}
                onUndo={() => undefined}
                onRetry={() => undefined}
              />
            ))}
            <Rule tone="hairline" />
            {FR_SET_ASIDE.map((row) => (
              <RequestRow
                key={row.profile.userId}
                profile={row.profile}
                requestedAt={row.requestedAt}
                state={row.state}
                onAccept={() => undefined}
                onNotNow={() => undefined}
                onUndo={() => undefined}
                onRetry={() => undefined}
              />
            ))}
          </Card>
        </Panel>

        <Panel label="Blocked">
          <BlockedResult onManage={() => undefined} />
        </Panel>
      </ScrollView>
    </View>
  );
}

/** Scaffolding, not a designed surface — the label names which state is below. */
function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-gutter pt-6">
      <Text variant="eyebrow" className="mb-2">
        {label}
      </Text>
      {children}
    </View>
  );
}
