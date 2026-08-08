import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { canvasAlpha, useTheme } from '@/theme/tokens';

// `canvasAlpha` used to live here. It is in the theme now — the camera chrome
// and three older screens wanted the same thing — and is re-exported so this
// unit's call sites keep importing it from where they always did.
export { canvasAlpha };

/**
 * The Reveal's dark stage — the one screen in the free-tier wave besides the
 * camera that departs from the light-only canvas, because R-01 through R-04
 * are read against the plates that follow: the same warm-paper card the rest
 * of the app uses lands brighter for being introduced on ink first.
 */
export function RevealStage({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View className="flex-1 justify-center px-7" style={{ backgroundColor: theme.ink }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
