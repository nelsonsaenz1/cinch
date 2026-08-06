import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, View } from 'react-native';

import { InitialAvatar } from '@/components/event-outfits/OutfitPostCard';
import { Text } from '@/components/ui/text';
import { isCompliment, type EventComment } from '@/features/event-outfits/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** "7:02pm" / "Tue" — enough to order a conversation, no timestamp noise. */
function timeLabel(d: Date): string {
  const now = Date.now();
  if (now - d.getTime() < 20 * 60 * 60_000) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * One comment: author, body, quiet time, and the ⋯ affordances the App Store
 * UGC minimum set requires on every piece of user content (report always;
 * delete for author/host; hide for host).
 *
 * Hidden rows reach only their author and the host (RLS decides, not the
 * client); this component's job is to LABEL that state honestly so the host
 * sees what she hid and the author knows her words are under review — nobody
 * is shown a silently vanished message they can still see.
 *
 * A compliment (fixed-vocabulary body) is typeset as the stylist would say
 * it — serif, no bubble weight — so praise reads as a printed note rather
 * than chat.
 */
export function CommentRow({
  comment,
  authorName,
  isMine,
  isHost,
  onReport,
  onDelete,
  onToggleHidden,
}: {
  comment: EventComment;
  authorName: string | null;
  isMine: boolean;
  isHost: boolean;
  onReport: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
}) {
  const theme = useTheme();
  const compliment = isCompliment(comment.body);

  const openMenu = () => {
    const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (!isMine) buttons.push({ text: 'Report', style: 'destructive', onPress: onReport });
    if (isHost && !isMine) {
      buttons.push({
        text: comment.hidden ? 'Unhide' : 'Hide from the table',
        onPress: onToggleHidden,
      });
    }
    if (isMine || isHost) buttons.push({ text: 'Delete', style: 'destructive', onPress: onDelete });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('This comment', undefined, buttons);
  };

  return (
    <View className="flex-row gap-3 py-3" style={{ opacity: comment.hidden ? 0.5 : 1 }}>
      <InitialAvatar name={authorName} size={28} />

      <View className="flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text variant="label" className="text-ink">
            {authorName ?? 'A friend'}
          </Text>
          <Text variant="caption">{timeLabel(comment.createdAt)}</Text>
        </View>

        {compliment ? (
          <Text variant="plate" className="mt-1" style={{ color: theme.ink }}>
            {comment.body}
          </Text>
        ) : (
          <Text variant="callout" className="mt-0.5">
            {comment.body}
          </Text>
        )}

        {comment.hidden ? (
          <Text variant="caption" className="mt-1" style={{ color: theme.warning }}>
            {isMine ? 'Hidden while the host takes a look' : 'Hidden from the table'}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comment options"
        onPress={openMenu}
        hitSlop={10}
        style={{ minHeight: MIN_TAP_TARGET - 20, justifyContent: 'center' }}
        className="active:opacity-60">
        <SymbolView name="ellipsis" size={14} tintColor={theme.faint} resizeMode="scaleAspectFit" />
      </Pressable>
    </View>
  );
}
