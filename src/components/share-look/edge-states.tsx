import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * S-05 — the compose flow's edge states, as reusable presentational pieces.
 *
 * Kept separate from `post.tsx` so the same components back both the live
 * flow (the states that actually occur there: empty closet, failed post) and
 * `dev-share-look.tsx`'s fixtures for the states that occur elsewhere in the
 * app (a card mid-write on the board, the retire confirmation) — one
 * definition either way, never a second copy drawn just for the dev route.
 */

/**
 * "Nothing in the closet yet" — S-01's empty branch. One piece is enough to
 * post; a plain photo is the escape hatch for someone with ten minutes.
 */
export function EmptyClosetPrompt({
  onAddPiece,
  onPostPhoto,
}: {
  onAddPiece: () => void;
  onPostPhoto?: () => void;
}) {
  return (
    <View>
      <Text variant="eyebrow">Nothing in the closet yet</Text>
      <Text variant="title" trim className="mt-2.5">
        Photograph one piece and you can post
      </Text>
      <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
        The board is waiting on you, and it takes about a minute.
      </Text>
      <View className="mt-3.5 flex-row gap-2">
        <Button title="Add a piece" variant="ink" haptic onPress={onAddPiece} />
        {onPostPhoto ? (
          <Button title="Post a photo instead" variant="secondary" haptic onPress={onPostPhoto} />
        ) : null}
      </View>
    </View>
  );
}

/** The card's shape mid-write on the board — drawn immediately, greyed at 60%. */
export function PostingCardSkeleton() {
  return (
    <View
      accessibilityLabel="Posting your look"
      className="flex-row items-center gap-3"
      style={{ opacity: 0.6 }}>
      <Skeleton className="h-16 w-16 rounded-md" />
      <View className="flex-1">
        <Skeleton className="h-3.5 rounded-chip" style={{ width: '70%' }} />
        <Skeleton className="mt-2 h-2.5 rounded-chip" style={{ width: '45%' }} />
      </View>
    </View>
  );
}

/**
 * "It didn't post" — the connection dropped and the composed stack survives.
 * Every field the caller had typed stays exactly where `post.tsx` left it;
 * this component only offers what to do next.
 */
export function FailedDraftBanner({
  onRetry,
  onKeepDraft,
  retrying = false,
}: {
  onRetry: () => void;
  onKeepDraft: () => void;
  retrying?: boolean;
}) {
  return (
    <View accessibilityRole="alert">
      <Text variant="title" trim>
        It didn’t post
      </Text>
      <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
        The connection dropped. Your look is saved as a draft — nothing was typed twice.
      </Text>
      <View className="mt-3.5 flex-row gap-2">
        <Button
          title={retrying ? 'Trying…' : 'Try again'}
          variant="secondary"
          haptic
          disabled={retrying}
          onPress={onRetry}
        />
        <Button title="Keep the draft" variant="ghost" haptic onPress={onKeepDraft} />
      </View>
    </View>
  );
}

/**
 * "Take it off the board?" — the destructive confirm the contract's §3 rule
 * requires: names what is lost, and its keep-option is named for the thing
 * being kept, never "Cancel".
 *
 * Presentational only — the destructive write itself is
 * `useDeletePost` in `features/event-outfits/mutations.ts`, which belongs to
 * the unit that owns `OutfitPostCard`'s overflow menu. This component is the
 * confirmation atlas asks for, ready to be wired to that call.
 */
export function TakeOffBoardConfirm({
  onLeaveUp,
  onTakeOff,
  removing = false,
}: {
  onLeaveUp: () => void;
  onTakeOff: () => void;
  removing?: boolean;
}) {
  return (
    <View>
      <Text variant="title" trim>
        Take it off the board?
      </Text>
      <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
        The picks and comments on it go too. The pieces stay in your closet.
      </Text>
      <View className="mt-4 flex-row gap-2">
        <Button title="Leave it up" variant="secondary" haptic onPress={onLeaveUp} className="flex-1" />
        <DestructiveButton title="Take it off" loading={removing} onPress={onTakeOff} />
      </View>
    </View>
  );
}

/**
 * The one destructive fill in this unit's files — `theme.critical`
 * (`#8A2E28`), the atlas's own colour and distinct from `accent`
 * (`#6E2B2B`). `Button` has no destructive variant and structurally refuses a
 * `style` prop, so this is hand-built on the same press-feedback primitive
 * `Button` itself uses, the same way `SelectionBar`'s `BarButton` is.
 */
function DestructiveButton({
  title,
  onPress,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const theme = useTheme();
  const press = usePressFeedback(!loading);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: loading }}
      className="flex-1">
      <Animated.View
        style={[
          press.style,
          {
            minHeight: MIN_TAP_TARGET,
            borderRadius: 12,
            backgroundColor: theme.critical,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.canvas} />
        ) : (
          <Text variant="label" style={{ fontSize: 15, lineHeight: 20, color: theme.canvas }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
