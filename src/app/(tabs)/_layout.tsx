import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme/tokens';

/**
 * Classic `Tabs`, deliberately — not `expo-router/unstable-native-tabs`.
 *
 * The SDK 57 default template ships the native tabs API, but the import path
 * carries an `unstable-` prefix and the docs warn it may change or be removed
 * in a *minor* version. That is not a dependency a production app heading for
 * TestFlight should sit on.
 */

/**
 * Driven off `focused` rather than the `color` the tab bar hands back, because
 * that callback types its colour as RN's `ColorValue` (string | OpaqueColorValue)
 * while SymbolView's tintColor wants a plain string. Reading the tint straight
 * from the theme avoids the cast and keeps the two tints in one place.
 */
function TabIcon({ name, focused }: { name: SFSymbol; focused: boolean }) {
  const theme = useTheme();
  return (
    <SymbolView
      name={name}
      size={26}
      tintColor={focused ? theme.accent : theme.muted}
      resizeMode="scaleAspectFit"
    />
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.canvas,
          borderTopColor: theme.hairline,
        },
        tabBarLabelStyle: { fontSize: 11, letterSpacing: 0.2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon name="sun.max" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ focused }) => <TabIcon name="square.grid.2x2" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stylist"
        options={{
          title: 'Stylist',
          tabBarIcon: ({ focused }) => <TabIcon name="bubble.left.and.bubble.right" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
