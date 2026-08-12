import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { useTheme } from '@/theme/tokens';

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
      <Text variant="body" className="mt-4 text-muted">
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
  pieceCount,
  hasCaption = false,
  retrying = false,
}: {
  onRetry: () => void;
  onKeepDraft: () => void;
  /** Printed so the sentence names what survived, not just that something did. */
  pieceCount?: number;
  hasCaption?: boolean;
  retrying?: boolean;
}) {
  /**
   * SL-02 — "A failed post keeps the selection, the order and the caption,
   * SAYS SO EXPLICITLY, and confirms nobody was notified."
   *
   * The old sentence said "your look is saved as a draft", which was not true:
   * every field lives in `post.tsx`'s own component state and nothing writes a
   * draft anywhere — leaving the screen loses it. "Still here" is what is
   * actually the case, and it is the claim the atlas asks for.
   *
   * "Nobody was notified" is checked, not assumed: the post is a single insert
   * through `useComposeAndPostLook`, and every notification in this product is
   * sent by a trigger on a row that now exists (`supabase/migrations/
   * 20260810110100_push_senders.sql`). A write that failed inserted no row, so
   * there is nothing for a sender to have fired on.
   */
  const kept = [
    pieceCount ? `your ${pieceCount === 1 ? 'piece' : `${pieceCount} pieces`}` : 'your pieces',
    'their order',
    hasCaption ? 'your caption' : null,
  ].filter(Boolean);

  return (
    <View accessibilityRole="alert">
      <Text variant="title" trim>
        The look did not post
      </Text>
      <Text variant="body" className="mt-2 text-muted">
        {`${kept.join(', ').replace(/, ([^,]*)$/, ' and $1')} are all still here. Nobody was notified.`}
      </Text>
      <View className="mt-3.5 flex-row gap-2">
        <Button
          title={retrying ? 'Trying…' : 'Try again'}
          variant="secondary"
          haptic
          disabled={retrying}
          onPress={onRetry}
        />
        {/*
          The atlas's second outcome here is "Save it for later", described as
          "a real second outcome rather than a dismissal". It is NOT BUILT.

          There is no draft table, no local persistence and no save mutation
          anywhere in `features/share-look/**` — the only write in the whole
          flow is `useComposeAndPostLook`, which posts. A button labelled "Save
          it for later" would be a dead control: it could only do what this one
          does, which is close the banner and leave the state in memory until
          the screen unmounts. Parked and reported rather than faked.

          What ships instead says exactly what it does.
        */}
        <Button title="Keep editing" variant="ghost" haptic onPress={onKeepDraft} />
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
      <Text variant="body" className="mt-2 text-muted">
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
            // 52, the grounded control height from reference board A. Was 44,
            // the accessibility floor — which left this brick 8pt shorter than
            // the outlined `Button` it renders beside.
            minHeight: 52,
            borderRadius: 12,
            backgroundColor: theme.critical,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.canvas} />
        ) : (
          // Medium 17 — this is a FILLED variant (the critical brick), and
          // board A keeps the filled group on Medium at `body`. Was 15.
          <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
