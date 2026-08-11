import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

const CAPTION_MAX = 280;

/**
 * Caption + submit for pinning a look — and, above the button, the sentence
 * architecture.md §9.2 requires: posting an outfit publishes its garments
 * (including private ones) to everyone in this event, and the schema cannot
 * soften that, so the UI must say it plainly at post time. Quiet copy, but
 * always present — never behind a disclosure.
 */
export function PostComposer({
  pending,
  disabled,
  submitTitle = 'Share with group',
  onSubmit,
}: {
  pending: boolean;
  disabled: boolean;
  submitTitle?: string;
  onSubmit: (caption: string | null) => void;
}) {
  const theme = useTheme();
  const [caption, setCaption] = useState('');

  return (
    <View>
      <View
        className="rounded-md border border-rule px-3 py-2"
        style={{ minHeight: 44 }}>
        <TextInput
          value={caption}
          onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
          placeholder="A note for the table — “option A, comfy shoes”"
          placeholderTextColor={theme.faint}
          accessibilityLabel="Caption for your look"
          multiline
          className="font-body text-callout"
          style={{ color: theme.ink, maxHeight: 88 }}
        />
      </View>

      <Text variant="noteSmall" className="mt-3">
        Sharing shows this look — and the pieces in it — to everyone in this
        event.
      </Text>

      <Button
        title={submitTitle}
        haptic
        loading={pending}
        disabled={disabled}
        onPress={() => onSubmit(caption.trim() ? caption.trim() : null)}
        className="mt-4 self-stretch"
      />
    </View>
  );
}
