import { Alert, View } from 'react-native';

import { ProfileRow } from '@/components/social/ProfileRow';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useUnblockUser } from '@/features/social-graph/moderation';
import { useBlockedUsers } from '@/features/social-graph/queries';
import { profileName } from '@/features/social-graph/types';

/**
 * Blocked users, manageable — the half of App Store Guideline 1.2 that is
 * easy to forget: blocking must be undoable somewhere findable.
 *
 * Names show only for public accounts. `social_profiles` screens out blocked
 * pairs by design, so a private blocked account has no readable identity here
 * and renders as a neutral row — blocking someone must not keep a window open
 * onto their profile.
 */
export function BlockedList() {
  const blocked = useBlockedUsers();
  const unblock = useUnblockUser();

  const confirmUnblock = (userId: string, name: string) => {
    Alert.alert(
      'Unblock',
      `${name} will be able to find you and send requests again. The old friendship does not come back — you would both start over.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () =>
            unblock.mutate(
              { userId },
              {
                onError: (err) =>
                  Alert.alert(
                    'Could not unblock',
                    err instanceof Error ? err.message : 'Something went wrong. Try again.',
                  ),
              },
            ),
        },
      ],
    );
  };

  if (blocked.isLoading) return null;

  const rows = blocked.data ?? [];
  if (rows.length === 0) {
    return (
      <Text variant="caption" className="px-4 py-3.5 text-faint">
        No one is blocked.
      </Text>
    );
  }

  return (
    <View>
      {rows.map((row, i) => {
        const name = row.profile ? profileName(row.profile) : 'A private member';
        return (
          <View key={row.userId}>
            {i > 0 ? <View className="h-px bg-hairline" /> : null}
            <ProfileRow
              profile={
                row.profile ?? {
                  userId: row.userId,
                  username: null,
                  displayName: 'A private member',
                  avatarUrl: null,
                }
              }
              subtitle="Blocked"
              trailing={
                <Button
                  title="Unblock"
                  variant="ghost"
                  disabled={unblock.isPending}
                  onPress={() => confirmUnblock(row.userId, name)}
                />
              }
            />
          </View>
        );
      })}
    </View>
  );
}
