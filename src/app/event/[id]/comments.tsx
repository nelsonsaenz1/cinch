import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentRow } from '@/components/event-outfits/CommentRow';
import { lookName } from '@/components/event-outfits/OutfitPostCard';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
// Batch-1 seam: the shared states kit.
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/use-session';
import { useEventComments, useEventPosts } from '@/features/event-outfits/queries';
import {
  socialErrorMessage,
  useAddComment,
  useDeleteComment,
  useHideComment,
} from '@/features/event-outfits/mutations';
import { COMPLIMENTS, type EventComment } from '@/features/event-outfits/types';
import { useEvent, useEventMembers } from '@/features/events/queries';
import { useEventChannel } from '@/features/events/use-event-channel';
import { useReportContent } from '@/features/social-graph/moderation';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** The comment box cap — product-spec §3.5. The schema allows more; the UI doesn't. */
const COMMENT_MAX = 500;

const REPORT_REASONS = ['Harassment', 'Inappropriate content', 'Spam', 'Impersonation'] as const;

/** Three comment rows' worth of shape — avatar disc, name, two lines of body. */
function ThreadSkeleton() {
  return (
    <View className="px-gutter pt-4" accessibilityLabel="Reading the thread">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row gap-3 py-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <View className="flex-1">
            <Skeleton className="h-3 w-24 rounded-sm" />
            <Skeleton className="mt-2 h-4 w-full rounded-sm" />
            <Skeleton className="mt-1.5 h-4 w-2/3 rounded-sm" />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The thread — event-level ("table talk", no `post` param) or one look's
 * (`post` param set). One cache serves both: `useEventComments` filters
 * client-side, so the realtime invalidation from EVENTS' channel keeps every
 * variant of this screen honest at once.
 *
 * Compliments live here as one-tap chips over the composer, per-look only:
 * a fixed positive-only vocabulary in the stylist's voice, sent as signed
 * comments. There is no down-reaction and no free-emoji anywhere on this
 * screen — accountability is the moderation, and the ⋯ menu carries the App
 * Store minimum set (report always, delete for author/host, hide for host).
 */
export default function EventCommentsScreen() {
  const { id, post } = useLocalSearchParams<{ id: string; post?: string }>();
  const eventId = id ?? null;
  const postId = post ?? null;
  const router = useRouter();
  const theme = useTheme();
  const session = useSession();

  useEventChannel(eventId);

  const event = useEvent(eventId);
  const members = useEventMembers(eventId ?? '');
  const posts = useEventPosts(eventId);
  const comments = useEventComments(eventId, postId);

  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const hideComment = useHideComment();
  const report = useReportContent();

  const [draft, setDraft] = useState('');

  const nameOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members.data ?? []) map.set(m.userId, m.displayName ?? m.username);
    return (userId: string): string | null => map.get(userId) ?? null;
  }, [members.data]);

  const look = postId ? (posts.data?.looks ?? []).find((l) => l.id === postId) : null;
  const isHost = event.data?.isHost ?? false;

  const send = (body: string) => {
    if (!eventId) return;
    addComment.mutate(
      { eventId, postId, body },
      {
        onSuccess: () => setDraft(''),
        onError: (error) => Alert.alert('That didn’t send', socialErrorMessage(error)),
      },
    );
  };

  const reportComment = (comment: EventComment) => {
    Alert.alert('Report this comment', 'What’s wrong with it?', [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: () =>
          report.mutate(
            {
              subject: 'comment',
              subjectId: comment.id,
              subjectUserId: comment.userId,
              reason,
            },
            {
              onSuccess: () =>
                Alert.alert('Thank you', 'Reports are reviewed within 24 hours.'),
              onError: (error: unknown) =>
                Alert.alert('That didn’t go through', socialErrorMessage(error)),
            },
          ),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const mutateErr = (error: unknown) =>
    Alert.alert('That didn’t work', socialErrorMessage(error));

  const title = look
    ? lookName(look.garments, look.caption)
    : (event.data?.title ?? 'Table talk');

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-row items-center gap-3 px-gutter pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
            <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
          </Pressable>
          <Text variant="colophon">{look ? 'On this look' : 'Table talk'}</Text>
        </View>

        <View className="px-gutter">
          <Text variant="title" trim numberOfLines={1} className="mt-4">
            {title}
          </Text>
          {look ? (
            <Text variant="caption" className="mt-1.5">
              {nameOf(look.userId) ?? 'A friend'}’s look — which one for the
              night?
            </Text>
          ) : null}
        </View>

        {comments.isError ? (
          // A thread that failed to arrive is not a quiet table. The composer
          // below stays live — sending still works when reading didn't.
          <View className="flex-1 px-gutter pt-8">
            <Text variant="body">This thread didn’t load</Text>
            <Text variant="caption" className="mt-1.5">
              Nothing was lost — the connection dropped on the way.
            </Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => void comments.refetch()}
              className="mt-4 self-start"
            />
          </View>
        ) : comments.isLoading ? (
          <ThreadSkeleton />
        ) : (
          <ScrollView contentContainerClassName="px-gutter pb-4 pt-2">
            {(comments.data ?? []).length === 0 ? (
              <Text variant="body" className="mt-6 text-muted">
                {look
                  ? 'Nothing yet — say the helpful thing. “Wear the gold hoops with it.”'
                  : 'Nothing yet. Start the table talking.'}
              </Text>
            ) : (
              (comments.data ?? []).map((comment, i) => (
                <View key={comment.id}>
                  {i > 0 ? <View className="h-hair w-full bg-hairline" /> : null}
                  <CommentRow
                    comment={comment}
                    authorName={
                      comment.userId === session.userId ? 'You' : nameOf(comment.userId)
                    }
                    isMine={comment.userId === session.userId}
                    isHost={isHost}
                    onReport={() => reportComment(comment)}
                    onDelete={() =>
                      Alert.alert('Delete this comment?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () =>
                            eventId &&
                            deleteComment.mutate(
                              { eventId, commentId: comment.id },
                              { onError: mutateErr },
                            ),
                        },
                      ])
                    }
                    onToggleHidden={() =>
                      eventId &&
                      hideComment.mutate(
                        { eventId, commentId: comment.id, hidden: !comment.hidden },
                        { onError: mutateErr },
                      )
                    }
                  />
                </View>
              ))
            )}
          </ScrollView>
        )}

        {/* Compliments — one tap, positive-only, on a look's thread only, and
            never on your own look (praising yourself is a strange sentence to
            put in someone's mouth). */}
        {look && look.userId !== session.userId ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-gutter pb-2">
            {COMPLIMENTS.map((c) => (
              <Chip
                key={c}
                label={c}
                onPress={() => send(c)}
                accessibilityHint="Sends this compliment as a comment"
              />
            ))}
          </ScrollView>
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-hairline px-gutter pb-2 pt-2">
          <View
            className="flex-1 flex-row items-center rounded-md border border-rule px-3"
            style={{ minHeight: MIN_TAP_TARGET }}>
            <TextInput
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
              placeholder={look ? 'Say the helpful thing…' : 'Message the table…'}
              placeholderTextColor={theme.faint}
              accessibilityLabel="Write a comment"
              multiline
              className="flex-1 font-body text-callout"
              style={{ color: theme.ink, maxHeight: 96, paddingVertical: 10 }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !draft.trim() || addComment.isPending }}
            disabled={!draft.trim() || addComment.isPending}
            onPress={() => send(draft)}
            style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
            className={[
              'items-center justify-center rounded-md bg-ink active:opacity-70',
              !draft.trim() || addComment.isPending ? 'opacity-40' : '',
            ].join(' ')}>
            {addComment.isPending ? (
              <ActivityIndicator size="small" color={theme.canvas} />
            ) : (
              <SymbolView name="arrow.up" size={16} tintColor={theme.canvas} resizeMode="scaleAspectFit" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
