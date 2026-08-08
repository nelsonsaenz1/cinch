import { Pressable, View } from 'react-native';

import { LookPlate, type ResolveImage } from '@/components/look/look-plate';
import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { lookDescriptor } from '@/features/events/look-copy';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/** The 96pt "card thumb" size — the composed look at grid-cell scale. */
const THUMB = 96;

export interface AttendeeLook {
  userId: string;
  /** The look's own id — opaque here, threaded back through `onOpen` so the
   *  caller can route to its thread without this module knowing `PostedLook`. */
  id: string;
  garments: readonly Garment[];
}

/**
 * One "Who's wearing what" cell (Event Detail State Atlas E-01/E-08): the
 * composed look, the attendee's initial-avatar and first name, one muted
 * descriptor line. A summary, not a poll — voting lives on the boards behind
 * "Every option"; this card carries no counts and no controls beyond
 * navigating to that look.
 */
function AttendeeLookCell({
  look,
  attendeeName,
  resolveImage,
  onPress,
}: {
  look: AttendeeLook;
  attendeeName: string | null;
  resolveImage: ResolveImage;
  onPress: () => void;
}) {
  const theme = useTheme();
  const firstName = attendeeName?.split(/\s+/)[0] ?? 'Friend';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${firstName}'s look: ${lookDescriptor(look.garments)}`}
      onPress={onPress}
      className="rounded-plate border border-hairline bg-surface p-3 active:opacity-70">
      <LookPlate pieces={look.garments} width={THUMB} resolveImage={resolveImage} />
      <View className="mt-2.5 flex-row items-center gap-2">
        <Avatar name={attendeeName} size={24} tone="accent" />
        {/* Inline style, not a stacked `text-ink` className: `label` already
            carries `text-muted`, and NativeWind gives no guaranteed
            precedence between two `text-*` utilities on one element. */}
        <Text variant="label" numberOfLines={1} className="flex-1" style={{ color: theme.ink }}>
          {firstName}
        </Text>
      </View>
      <Text variant="caption" numberOfLines={1} className="mt-1">
        {lookDescriptor(look.garments)}
      </Text>
    </Pressable>
  );
}

/**
 * The two-column grid itself. Order is the caller's (self first, then roster
 * order); this only prints, and it prints nothing at all for an attendee
 * whose leading look is somehow empty rather than drawing a hole in the grid.
 */
export function AttendeeLookGrid({
  boards,
  nameOf,
  resolveImage,
  onOpen,
}: {
  boards: readonly AttendeeLook[];
  nameOf: (userId: string) => string | null;
  resolveImage: ResolveImage;
  onOpen: (look: AttendeeLook) => void;
}) {
  return (
    <View className="-mx-1.5 flex-row flex-wrap">
      {boards.map((look) => (
        <View key={look.userId} className="w-1/2 p-1.5">
          <AttendeeLookCell
            look={look}
            attendeeName={nameOf(look.userId)}
            resolveImage={resolveImage}
            onPress={() => onOpen(look)}
          />
        </View>
      ))}
    </View>
  );
}
