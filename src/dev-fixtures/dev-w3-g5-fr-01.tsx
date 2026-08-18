import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendsPage } from '@/components/social/friends-page';
import { Text } from '@/components/ui/text';
import { FR_FRIENDS, FR_REQUESTS } from '@/features/social/w3-g5-fixtures';

/**
 * FR-01 — requests above friends.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 88 — the row is 68pt (`FRIEND_ROW_HEIGHT`), down from 96, so seven
 *   rows sit in the first viewport at 393×852 against an acceptance floor of
 *   five. Each request carries EXACTLY ONE filled action — Accept — with "Not
 *   now" beside it as 44pt quiet text; an existing friend carries no filled
 *   action at all, only its 44pt overflow.
 * · audit 88 again — no dismissal implies rejection. "Not now" writes nothing
 *   to the server (`DISMISSED_KEY`, `src/app/friends/index.tsx`), so the words
 *   decline, reject and remove appear nowhere on this page.
 * · CORRECTION 23 — every row draws only what the friendship record can answer:
 *   name, handle, avatar and the person's OWN bio. The mutual-friend count, the
 *   hosting note and the lending claim are absent because none of them is
 *   readable — a friendship here is two `follows` edges plus `social_profiles`
 *   (`user_id, username, display_name, avatar_url, bio`), and there is no
 *   account-level lending setting anywhere in the migrations to read.
 * · audit 89 — the name is the only Medium string; handle, bio, the section
 *   headings and the masthead counts are 13pt regular secondary.
 * · THE LONG-NAME STRESS CASE IS IN SITU, not in a frame of its own: the second
 *   request is "Marguerite Okonkwo-Bell" (24 characters) at "@margueriteokonkwobell"
 *   (22). The name wraps and the handle runs to the action's edge without
 *   colliding, because the text column is `flex-1` with `minWidth: 0` and both
 *   actions are `flex-none`.
 *
 * DETERMINISM: every profile, count and timestamp is a literal in
 * `features/social/w3-g5-fixtures`. No query, no clock, no network. The
 * shipping `FriendsPage` is what draws it — there is no second layout here.
 */
export default function DevW3G5FR01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
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
        requests={FR_REQUESTS}
        requestsError={false}
        requestsRetrying={false}
        onRetryRequests={() => undefined}
        onAccept={() => undefined}
        onNotNow={() => undefined}
        onUndo={() => undefined}
        onRetryAccept={() => undefined}
        friends={FR_FRIENDS}
        friendsLoading={false}
        friendsError={false}
        friendsRetrying={false}
        onRetryFriends={() => undefined}
        onOpenFriend={() => undefined}
        onOverflow={() => undefined}
        sent={[]}
        showEmpty={false}
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
  );
}
