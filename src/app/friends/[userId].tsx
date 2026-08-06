import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendItemCard } from '@/components/social/FriendItemCard';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useBlockUser, useReportContent } from '@/features/social-graph/moderation';
import { useRequestBorrow, useUnfollow } from '@/features/social-graph/mutations';
import { useFriendCloset, useFriends } from '@/features/social-graph/queries';
import { profileName, type FriendItem } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

const REPORT_REASONS = ['Harassment', 'Inappropriate content', 'Spam', 'Impersonation', 'Other'];

/**
 * A friend's closet — the browsable, borrowable edition.
 *
 * Everything on this screen comes through the `friend_items` projection:
 * presentation and the borrowable flag, nothing else. No prices, no wear
 * counts, no originals — the moat is hers, and this screen must not even have
 * the columns to leak. Not-for-lending pieces render like the rest, just with
 * no ask; the trigger on `borrow_requests` is the real gate.
 */
export default function FriendClosetScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const theme = useTheme();

  const friends = useFriends();
  const profile = (friends.data ?? []).find((p) => p.userId === userId) ?? null;
  const name = profile ? profileName(profile) : 'A friend';

  const closet = useFriendCloset(userId ?? null);
  const items = closet.data ?? [];
  const { resolve } = useSignedUrls(items.flatMap((i) => [i.thumbPath, i.cutoutPath]));

  const requestBorrow = useRequestBorrow();
  const unfollow = useUnfollow();
  const block = useBlockUser();
  const report = useReportContent();

  // The borrow sheet: which garment is being asked for, and the note going
  // with it. `null` is closed — one piece of state, not a boolean plus a copy.
  const [asking, setAsking] = useState<FriendItem | null>(null);
  const [message, setMessage] = useState('');

  const openAsk = (item: FriendItem) => {
    setMessage('');
    setAsking(item);
  };

  const sendAsk = () => {
    if (!asking || !userId) return;
    requestBorrow.mutate(
      // GRAPH's own surfaces are never event-scoped; eventId is for the event
      // screens, which call the same hook with one.
      { itemId: asking.id, ownerId: userId, eventId: null, message },
      {
        onSuccess: () => {
          setAsking(null);
          Alert.alert('Asked', `${name} will see your request. No pressure either way.`);
        },
        onError: (err) =>
          Alert.alert(
            'Could not ask',
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  const promptReport = () => {
    if (!profile) return;
    Alert.alert('Report', `Report ${name}'s profile?`, [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          report.mutate(
            {
              subject: 'profile' as const,
              subjectId: profile.userId,
              subjectUserId: profile.userId,
              reason,
            },
            {
              onSuccess: () => Alert.alert('Reported', 'Thank you — we review every report.'),
              onError: (err) =>
                Alert.alert(
                  'Could not send that report',
                  err instanceof Error ? err.message : 'Something went wrong. Try again.',
                ),
            },
          ),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const promptBlock = () => {
    if (!userId) return;
    Alert.alert(
      `Block ${name}`,
      'She won’t be able to find you, message you, or see your closet — and she won’t be told. This also ends the friendship.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            block.mutate(
              { userId },
              {
                onSuccess: () => router.back(),
                onError: (err) =>
                  Alert.alert(
                    'Could not block',
                    err instanceof Error ? err.message : 'Something went wrong. Try again.',
                  ),
              },
            ),
        },
      ],
    );
  };

  const promptUnfriend = () => {
    if (!userId) return;
    Alert.alert(
      `Unfriend ${name}`,
      'Her closet closes to you and yours to her. She isn’t notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () =>
            unfollow.mutate(
              { userId },
              {
                onSuccess: () => router.back(),
                onError: (err) =>
                  Alert.alert(
                    'Could not unfriend',
                    err instanceof Error ? err.message : 'Something went wrong. Try again.',
                  ),
              },
            ),
        },
      ],
    );
  };

  const overflow = () => {
    Alert.alert(name, undefined, [
      { text: 'Unfriend', onPress: promptUnfriend },
      { text: 'Report', onPress: promptReport },
      { text: 'Block', style: 'destructive', onPress: promptBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const borrowableCount = items.filter((i) => i.borrowable).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">Her closet</Text>
        <Pressable
          onPress={overflow}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${name}`}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
          <SymbolView name="ellipsis" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
      </View>

      <View className="px-gutter pb-3 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {name}
        </Text>
        <Text variant="label" className="mt-2 text-faint">
          {closet.isLoading
            ? 'Opening her closet…'
            : `${items.length} ${items.length === 1 ? 'piece' : 'pieces'} · ${borrowableCount} borrowable`}
        </Text>
      </View>

      {!closet.isLoading && items.length === 0 ? (
        // Empty either because her closet is genuinely empty or because the
        // friendship has lapsed — the view can't say which, and neither should
        // the copy: accusing a friend of unfriending is worse than vagueness.
        <EmptyState
          symbol="tshirt"
          title="Nothing to show"
          body="Her closet is empty, or it isn’t open to you right now. Pull down on the Friends list to refresh."
        />
      ) : (
        <FlashList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FriendItemCard
              item={item}
              imageUri={resolve(item.thumbPath, item.cutoutPath)}
              onAskToBorrow={openAsk}
            />
          )}
          // Plain style, not contentContainerClassName — FlashList is outside
          // NativeWind and silently drops classNames (see closet-grid.tsx).
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          ItemSeparatorComponent={() => <View className="h-1" />}
          refreshControl={
            <RefreshControl refreshing={closet.isRefetching} onRefresh={() => void closet.refetch()} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* The ask. A small sheet, not a form: garment, an optional line, send.
          The decline on her side is one canned tap, and this side promises as
          much — the whole flow exists to absorb the awkwardness. */}
      <Modal
        visible={asking !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAsking(null)}>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(28,26,22,0.4)' }}
          accessibilityLabel="Close"
          onPress={() => setAsking(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Stop taps inside the card falling through to the scrim. */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="rounded-t-sheet bg-canvas px-gutter pb-10 pt-6">
                <Text variant="title" trim>
                  Ask to borrow
                </Text>
                <Text variant="body" className="mt-3 text-muted">
                  {asking?.subcategory ?? asking?.category ?? ''}
                  {asking?.brand ? ` · ${asking.brand}` : ''} — {name} decides, and either answer
                  is one tap for her.
                </Text>

                <View className="mt-4 rounded-md border border-rule px-3">
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Add a line if you like — “for Thursday?”"
                    placeholderTextColor={theme.faint}
                    maxLength={500}
                    multiline
                    accessibilityLabel="Message with your request"
                    style={{
                      minHeight: 64,
                      paddingVertical: 10,
                      fontFamily: 'HelveticaNeue',
                      fontSize: 15,
                      color: theme.ink,
                    }}
                  />
                </View>

                <Button
                  title="Send request"
                  loading={requestBorrow.isPending}
                  haptic
                  onPress={sendAsk}
                  className="mt-5"
                />
                <Button
                  title="Never mind"
                  variant="ghost"
                  disabled={requestBorrow.isPending}
                  onPress={() => setAsking(null)}
                  className="mt-1"
                />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
