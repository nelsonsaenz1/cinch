import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
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
      <Avatar name={name} size={44} tone="ink" imageUri={profile.avatarUrl} />

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {/* 13pt REGULAR secondary, not `caption`'s Medium and not `faint`.
            #8A8578 is 3.5:1 on canvas — an AA failure — and this line carries
            a handle or a state, which is content. `note` is the secondary
            voice: same quiet, one step darker, and regular so the name above
            stays the row's only Medium string (audit 89). */}
        {subtitle ? (
          <Text variant="note" numberOfLines={1} className="mt-0.5">
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
