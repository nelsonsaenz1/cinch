import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The circular back button, on its own.
 *
 * A 36pt disc is under Apple's 44pt floor, which is why every copy of it also
 * carried `hitSlop={8}` — the visual size is the design's, the touch target is
 * the HIG's. Kept separate from `ScreenHeader` for the screens that place it
 * over a hero image rather than in a header row.
 *
 * Circular, and staying circular: `rounded-full` on a 1:1 box is a disc, not
 * the labelled capsule the radius scale rules out. See tailwind.config.js.
 */
export function BackButton({ onPress, label = 'Back' }: { onPress?: () => void; label?: string }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
      <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

export type ScreenHeaderProps = {
  /** The small-caps colophon — "Event", "Your circle", "Between friends". */
  title?: string;
  /**
   * `center` sets the colophon between the back button and a matching spacer,
   * the way Item detail and New occasion do it. `leading` sets it immediately
   * beside the button, the way the event pages do. Both shipped; both are
   * right for their page, so both are here rather than one being flattened
   * into the other.
   */
  align?: 'center' | 'leading';
  onBack?: () => void;
  backLabel?: string;
  /** A real control on the right — replaces the balancing spacer if given. */
  trailing?: React.ReactNode;
  className?: string;
};

/**
 * The header eight screens hand-copied.
 *
 * `item/[id].tsx`, `event/new.tsx`, `event/[id]/index.tsx`, `outfits.tsx`,
 * `post.tsx`, `comments.tsx`, `friends/index.tsx`, `friends/[userId].tsx` and
 * `borrow.tsx` each contained the same nine-line Pressable — same 36pt disc,
 * same `chevron.left` at 15, same `hitSlop`, same `active:opacity-60`. They
 * had not drifted yet. Nine copies of anything drift eventually, and this one
 * carries an accessibility guarantee (the hitSlop) that is invisible when it
 * goes missing.
 */
export function ScreenHeader({
  title,
  align = 'center',
  onBack,
  backLabel,
  trailing,
  className = '',
}: ScreenHeaderProps) {
  if (align === 'leading') {
    return (
      <View className={`flex-row items-center gap-3 px-gutter pt-2 ${className}`}>
        <BackButton onPress={onBack} label={backLabel} />
        {title ? <Text variant="colophon">{title}</Text> : null}
        {trailing ? <View className="ml-auto">{trailing}</View> : null}
      </View>
    );
  }

  return (
    <View className={`flex-row items-center justify-between px-gutter pt-2 ${className}`}>
      <BackButton onPress={onBack} label={backLabel} />
      {title ? <Text variant="colophon">{title}</Text> : <View />}
      {/* 36pt of nothing, so the centred colophon is centred on the page and
          not on the space left over beside the button. */}
      {trailing ?? <View style={{ width: 36 }} />}
    </View>
  );
}
