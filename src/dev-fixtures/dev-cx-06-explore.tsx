import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * CX-06 / UX-04 — Explore's masthead, on its own.
 *
 * The real page needs a session, a friend graph and a network before it draws
 * anything, so the three elements the corrections actually change are the
 * hardest part of it to look at. This is those, with nothing else on the page.
 *
 * What this frame is evidence for, now: "Between friends" is gone and "Explore"
 * is the sole heading (CX-06/LP-06); the support line reads "New in your
 * circle." rather than the curation claim "Looks and ideas to try."; and the
 * permanent search field is gone, replaced by a labelled 44pt search action on
 * the trailing edge that opens `people-search` (UX-04). Everything below the
 * masthead on the real screen is unchanged and deliberately absent here — a
 * fixture that redrew the feed would be a second copy of it to keep in step.
 */
export default function DevCx06Explore() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text variant="display" trim accessibilityRole="header">
              Explore
            </Text>
            <View style={{ marginTop: 6 }}>
              <Text variant="note">New in your circle.</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find people"
            style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, marginRight: -11 }}
            className="items-center justify-center active:opacity-60">
            <SymbolView
              name="magnifyingglass"
              size={17}
              tintColor={theme.ink}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
