import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/tokens';

/** `theme.canvas` is always `#RRGGBB`; alpha reads derive from it, never retype. */
export function canvasAlpha(alpha: number): string {
  return `rgba(251,250,246,${alpha})`;
}

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
