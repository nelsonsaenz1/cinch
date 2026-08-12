import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { canvasAlpha } from '@/theme/tokens';

// `canvasAlpha` used to live here. It is in the theme now — the camera chrome
// and three older screens wanted the same thing — and is re-exported so this
// unit's call sites keep importing it from where they always did.
export { canvasAlpha };

/**
 * The Reveal's stage.
 *
 * IT USED TO BE INK, AND IS NOT ANY MORE. The constitution spends the dark
 * ground exactly once, on the tour's first frame — "ink is spent once, on frame
 * one, so that the tour walks from an announcement onto the paper the rest of
 * the app is printed on", and "ground is the only ink surface in the whole
 * hallway". A second dark screen four steps later spends a thing that was
 * defined by being spent once, and it made the Reveal read as a second
 * announcement rather than as the first page of the app the reader is about to
 * use. R-02, R-04 and R-05 are all drawn on canvas.
 *
 * The stage is kept as a component rather than dissolved into each screen
 * because it is still where the frame's edges and its status-bar style are
 * decided, and those must not drift between the three states.
 */
export function RevealStage({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <StatusBar style="dark" />
      <View className="flex-1 px-gutter" style={{ paddingTop: 34 }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
