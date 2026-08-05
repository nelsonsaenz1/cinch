import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { dynamic } from '@/theme/tokens';

/**
 * The native Liquid Glass tab bar — the single loudest native signal in the
 * app. The glass material, the scroll-edge treatment, and minimize-on-scroll
 * are unfakeable in JS.
 *
 * On the `unstable-` prefix: AGENTS.md avoided this API, and that call is
 * deliberately overruled here. It has soaked three SDKs (alpha in 54 →
 * compound API in 55 → selected icons in 56 → 57), the blast radius is this
 * one file, and `expo-router` is pinned to exactly 57.0.10 in package.json so
 * a breaking minor cannot arrive uninvited. The previous JS implementation is
 * preserved verbatim at ./_layout.js-tabs.bak — restoring it is a rename.
 *
 * Three tabs, deliberately. A Stylist chat tab is the generic-AI tell and
 * duplicates Today's job — it is a sheet off Today now (src/app/stylist.tsx).
 * Profile is the avatar in Today's masthead (src/app/profile.tsx).
 *
 * Chrome discipline: monochrome ink tint (accent belongs to content, never
 * chrome), no `backgroundColor` (it kills the scroll-edge effect), and both
 * colours via `dynamic()` — Expo's docs: plain hex on the glass bar flickers
 * when dark mode flips.
 */
export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={dynamic('ink')}
      iconColor={{ default: dynamic('muted') }}
      // Colour set per state: without it, unselected labels fall back to
      // UIKit's cool system gray while the icons above them are the warm
      // muted — two grays on one chrome. (The brief asks for +1.10 tracking
      // here too; NativeTabsLabelStyle has no letterSpacing, so the labels
      // ride without it — noted in docs/design-directive.md.)
      labelStyle={{
        default: { fontFamily: 'HelveticaNeue-Medium', fontSize: 11, color: dynamic('muted') },
        selected: { fontFamily: 'HelveticaNeue-Medium', fontSize: 11, color: dynamic('ink') },
      }}
      minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="closet">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
        />
        <NativeTabs.Trigger.Label>Closet</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
