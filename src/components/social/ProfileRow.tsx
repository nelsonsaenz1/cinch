import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ProfileRowProps = {
  profile: SocialProfile;
  /** Small line under the name — "@username", "Requested", a state. */
  subtitle?: string | null;
  onPress?: (profile: SocialProfile) => void;
  /** Action on the right edge — a follow button, a ⋯ menu, a state label. */
  trailing?: React.ReactNode;
  /** Chevron on the right, for rows that navigate. Ignored when `trailing` is set. */
  showsChevron?: boolean;
};

/** "DA" from "Dana Alvarez", "DA" from "dana" alone — same rules as Profile's masthead. */
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2);
  return (letters || '?').toUpperCase();
}

/**
 * One person in a list — friends, requests, search results. Identity on the
 * left, whatever the list needs on the right. The avatar falls back to
 * initials on ink rather than a person-glyph: initials are hers, the glyph is
 * anybody's.
 */
export function ProfileRow({ profile, subtitle, onPress, trailing, showsChevron }: ProfileRowProps) {
  const theme = useTheme();
  const name = profileName(profile);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={[name, subtitle].filter(Boolean).join(', ')}
      onPress={onPress ? () => onPress(profile) : undefined}
      disabled={!onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3 px-4 py-3 active:opacity-60">
      <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-ink">
        {profile.avatarUrl ? (
          <Image
            source={{ uri: profile.avatarUrl }}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // Inline style, not a className: light-on-ink text does not reliably
          // win through NativeWind precedence — same gotcha as Profile's avatar.
          <Text variant="callout" style={{ color: theme.canvas }}>
            {initialsFor(name)}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5 text-faint">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ??
        (showsChevron ? (
          <SymbolView
            name="chevron.right"
            size={13}
            tintColor={theme.faint}
            resizeMode="scaleAspectFit"
          />
        ) : null)}
    </Pressable>
  );
}
