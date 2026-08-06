import { Stack } from 'expo-router';

/**
 * The social group: the friends list and, pushed from it, individual friend
 * closets. Headers are the screens' own — same rule as the rest of the app.
 */
export default function FriendsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
