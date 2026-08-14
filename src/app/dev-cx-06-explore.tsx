import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchField } from '@/components/ui/search-field';
import { Text } from '@/components/ui/text';

/** CX-06's one number, restated here so the fixture cannot drift from it. */
const EXPLORE_SEARCH_GAP = 20;

/**
 * CX-06 — Explore's masthead, on its own.
 *
 * The real page needs a session, a friend graph and a network before it draws
 * anything, so the two lines the correction actually changes are the hardest
 * part of it to look at. This is those two lines and the field under them,
 * with nothing else on the page.
 *
 * What this frame is evidence for: "Between friends" is gone, "Lately" is the
 * sole heading, and there are 20 points between its baseline box and the
 * search field. Everything below the field on the real screen is unchanged and
 * deliberately absent here — a fixture that redrew the feed would be a second
 * copy of it to keep in step.
 */
export default function DevCx06Explore() {
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
        <Text variant="display" trim accessibilityRole="header">
          Lately
        </Text>
        <View style={{ marginTop: EXPLORE_SEARCH_GAP }}>
          <SearchField
            value=""
            onChangeText={() => {}}
            placeholder="Find a friend by username"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
