import { Switch, TextInput, View } from 'react-native';

import { LookPlate, type ResolveImage } from '@/components/look/look-plate';
import { Text } from '@/components/ui/text';
import { CAPTION_DISPLAY_MAX, audienceLine } from '@/features/share-look/compose';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * S-03 — say what it is, then post.
 *
 * The title arrives pre-written (`titleFromPieces`, computed by the caller so
 * it can regenerate as the stack changes) and this component only ever edits
 * it, never invents it. Both the title and the caption are optional; there is
 * nothing here that argues with an empty field.
 */
export function CaptionStep({
  stack,
  resolveImage,
  title,
  onChangeTitle,
  caption,
  onChangeCaption,
  eventTitle,
  eventDateLine,
  peopleCount,
  saveToLately,
  onChangeSaveToLately,
}: {
  stack: Garment[];
  resolveImage: ResolveImage;
  title: string;
  onChangeTitle: (next: string) => void;
  caption: string;
  onChangeCaption: (next: string) => void;
  eventTitle: string;
  eventDateLine: string | null;
  peopleCount: number;
  saveToLately: boolean;
  onChangeSaveToLately: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <View
        className="rounded-plate bg-surface"
        style={{ borderWidth: 1, borderColor: theme.rule, padding: 16 }}>
        <View className="flex-row" style={{ gap: 14 }}>
          <View style={{ width: 96, height: 96, flexShrink: 0 }}>
            <LookPlate pieces={stack.slice(0, 4)} width={96} resolveImage={resolveImage} padding={6} gap={4} />
          </View>

          <View className="flex-1" style={{ minWidth: 0 }}>
            <TextInput
              value={title}
              onChangeText={onChangeTitle}
              placeholder="Name this look"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Look title"
              accessibilityHint="Suggested from your pieces — tap to rename"
              className="font-title text-plate text-ink"
              style={{ padding: 0 }}
            />
            <Text variant="caption" className="mt-1.5">
              Suggested from your pieces · tap to rename
            </Text>

            <View className="mt-3 h-px" style={{ backgroundColor: theme.hairline }} />

            <TextInput
              value={caption}
              onChangeText={(t) => onChangeCaption(t.slice(0, CAPTION_DISPLAY_MAX))}
              placeholder="A line about it — optional"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Caption"
              multiline
              className="font-body text-callout text-ink"
              style={{ marginTop: 12, padding: 0, maxHeight: 88 }}
            />
          </View>
        </View>

        <View className="mt-3.5 flex-row items-center justify-between">
          <Text variant="caption">Caption</Text>
          <Text
            variant="caption"
            style={{ fontFamily: 'ui-monospace' }}>{`${caption.length} / ${CAPTION_DISPLAY_MAX}`}</Text>
        </View>
      </View>

      <View className="mt-[18px]">
        <Text variant="eyebrow">Posting to</Text>

        <View
          className="mt-2.5 flex-row items-center rounded-lg bg-surface"
          style={{ gap: 12, borderWidth: 1, borderColor: theme.rule, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View className="flex-1">
            <Text variant="body" numberOfLines={1}>
              {eventTitle}
            </Text>
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {eventDateLine ? `${eventDateLine} · ${audienceLine(peopleCount)}` : audienceLine(peopleCount)}
            </Text>
          </View>
        </View>

        <View
          className="mt-2.5 flex-row items-center rounded-lg bg-surface"
          style={{ gap: 12, borderWidth: 1, borderColor: theme.rule, paddingVertical: 14, paddingHorizontal: 16 }}>
          <View className="flex-1">
            <Text variant="body">Also save to Lately</Text>
            <Text variant="caption" className="mt-0.5">
              {`Counts a wear for all ${stack.length} ${stack.length === 1 ? 'piece' : 'pieces'}`}
            </Text>
          </View>
          <Switch
            value={saveToLately}
            onValueChange={onChangeSaveToLately}
            trackColor={{ false: theme.rule, true: theme.ink }}
            accessibilityRole="switch"
            accessibilityState={{ checked: saveToLately }}
            accessibilityLabel="Also save to Lately"
          />
        </View>
      </View>
    </View>
  );
}
