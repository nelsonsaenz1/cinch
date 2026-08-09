import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { Text } from './text';

/**
 * One settings row: label, an optional quiet value, a chevron, a tap target.
 *
 * Lifted out of `profile.tsx` when three atlases turned out to be built from
 * the same row — 08 Profile & settings, AC-06's Privacy switch and its
 * back-fill, and every "›" in between. It was already the right component; it
 * was just private to one screen, which is how the same row ends up written
 * three times and drifting (see the number-word table two waves ago).
 *
 * `tone="accent"` is spent on exactly one row in the entire app — Delete
 * account — which is the one-oxblood-per-screen rule applied inside a list
 * instead of to a button. The atlas states it in as many words: "Delete
 * account is the only critical-coloured thing in the app."
 */
export function SettingsRow({
  label,
  onPress,
  tone = 'ink',
  loading = false,
  detail,
  /**
   * `chevron.right` means "further in". A row that hands you to Safari is not
   * further in — it is out of the app entirely, and iOS's own settings mark
   * that with the up-right arrow. Two glyphs for two different promises.
   */
  external = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'accent';
  loading?: boolean;
  /**
   * Quiet fact before the chevron — "2 waiting". Data, not decoration, and
   * set in `muted` like every trailing value in the atlas: a single quiet
   * number here is the Plate's whole tolerance for unread-count anxiety, and
   * an oxblood one would be a badge wearing a disguise.
   */
  detail?: string;
  external?: boolean;
  /**
   * Inert rather than absent — AC-06's back-fill row exists before tagging is
   * switched on, and says so underneath, because a row that appears out of
   * nowhere after a toggle is a worse surprise than one that waits.
   */
  disabled?: boolean;
}) {
  const theme = useTheme();
  const inert = disabled || loading;
  const iconColor = tone === 'accent' ? theme.accent : external ? theme.byline : theme.faint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inert }}
      accessibilityHint={external ? 'Opens in your browser' : undefined}
      onPress={onPress}
      disabled={inert}
      style={{ minHeight: MIN_TAP_TARGET, opacity: disabled ? 0.4 : 1 }}
      className="flex-row items-center justify-between px-4 py-3.5 active:opacity-60">
      <Text variant="body" className={tone === 'accent' ? 'text-accent' : 'text-ink'}>
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {detail ? (
          <Text variant="caption" className="text-muted">
            {detail}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <SymbolView
            name={external ? 'arrow.up.right' : 'chevron.right'}
            size={13}
            tintColor={iconColor}
            resizeMode="scaleAspectFit"
          />
        )}
      </View>
    </Pressable>
  );
}
