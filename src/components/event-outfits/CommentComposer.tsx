import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { COMMENT_MAX, counterLabel } from '@/features/event-outfits/comment-thread';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The composer at the foot of a thread — EC-02. Placeholder is "Say
 * something nice", stated once, which the contract calls "the whole content
 * policy stated once at the point of writing" — never replaced with a
 * generic "Write a comment" for the event-level thread, because the rule
 * doesn't change when the thread isn't about one look.
 *
 * The reply target is named directly above the field and cancellable there
 * (never buried), because the difference between replying to Dana and
 * posting to the room is the kind of mistake this thread can't take back
 * gracefully. The send button only exists once there is something to send.
 */
export function CommentComposer({
  replyToName,
  onCancelReply,
  onSend,
  disabled,
}: {
  replyToName: string | null;
  onCancelReply: () => void;
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const counter = counterLabel(draft);
  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <View>
      {replyToName ? (
        <View className="flex-row items-center justify-between px-gutter pb-1.5">
          <Text variant="caption">{`Replying to ${replyToName}…`}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            onPress={onCancelReply}
            hitSlop={8}>
            <Text variant="caption" className="font-semibold" style={{ color: theme.accent }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row items-end gap-2.5 px-gutter pb-2 pt-1">
        <Avatar name={null} size={30} tone="accent" fallback="ME" />
        <View
          className="flex-1 flex-row items-center rounded-md border border-hairline bg-tray px-3.5"
          style={{ minHeight: MIN_TAP_TARGET }}>
          <TextInput
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
            placeholder={replyToName ? `Reply to ${replyToName}…` : 'Say something nice'}
            placeholderTextColor={theme.muted}
            accessibilityLabel="Write a comment"
            multiline
            className="flex-1 font-body text-callout"
            style={{ color: theme.ink, maxHeight: 96, paddingVertical: 10 }}
          />
        </View>
        {canSend ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={submit}
            style={{
              minHeight: MIN_TAP_TARGET,
              minWidth: MIN_TAP_TARGET,
              borderRadius: MIN_TAP_TARGET / 2,
              backgroundColor: theme.ink,
            }}
            className="items-center justify-center active:opacity-70">
            <SymbolView name="arrow.up" size={16} tintColor={theme.canvas} resizeMode="scaleAspectFit" />
          </Pressable>
        ) : null}
      </View>

      {counter ? (
        <Text variant="caption" className="px-gutter pb-1" style={{ fontVariant: ['tabular-nums'] }}>
          {counter}
        </Text>
      ) : null}
    </View>
  );
}
