import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme } from '@/theme/tokens';

import { settingsRowSpec } from './settings-row-spec';
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
  sublabel,
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
  /**
   * A whole sentence UNDER the label, rather than a value beside it.
   *
   * `detail` is a trailing value and has to stay short — it shares a line with
   * the chevron, and a sentence there wins a fight with the label for width.
   * The settled row's own rule (group 6) is that a value which cannot share the
   * line goes underneath, so this is that position, made explicit for the rows
   * whose second fact is prose: "Opens the App Store, where the subscription
   * lives". Set one or the other, never both.
   */
  sublabel?: string;
  external?: boolean;
  /**
   * Inert rather than absent — AC-06's back-fill row exists before tagging is
   * switched on, and says so underneath, because a row that appears out of
   * nowhere after a toggle is a worse surprise than one that waits.
   */
  disabled?: boolean;
}) {
  const theme = useTheme();
  const spec = settingsRowSpec({ tone, external, loading, disabled });
  const iconColor = theme[spec.icon];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={spec.accessibilityState}
      accessibilityHint={spec.accessibilityHint}
      onPress={onPress}
      disabled={spec.inert}
      style={{ minHeight: spec.minHeight, opacity: spec.opacity }}
      className="flex-row items-center justify-between gap-3 px-4 py-3.5 active:opacity-60">
      <View className="flex-1">
        <Text variant="body" className={spec.labelClass}>
          {label}
        </Text>
        {sublabel ? (
          <Text variant="note" className="mt-1">
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View className="flex-none flex-row items-center gap-2">
        {detail ? (
          <Text variant="caption" className="text-muted">
            {detail}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <SymbolView
            name={spec.glyph}
            size={13}
            tintColor={iconColor}
            resizeMode="scaleAspectFit"
          />
        )}
      </View>
    </Pressable>
  );
}
