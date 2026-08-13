import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTrialExpiredPlacement } from '@/features/billing/use-trial-expired';
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
 * Four tabs, deliberately — and the fourth was argued for, not assumed. A
 * Stylist chat tab is the generic-AI tell and duplicates Today's job; it is a
 * sheet off Today (src/app/stylist.tsx), and Profile is the avatar in Today's
 * masthead (src/app/profile.tsx). The fourth earns a place those two could not
 * because it is the only *destination* in the app whose content changes
 * without the user doing anything: what your friends have added since you last
 * looked. Buried behind the Friends screen it would be a page nobody knows
 * updated. Four is also still inside what the bar composes well — iOS allows
 * five before it collapses into "More", and each label stays a single short
 * word at 11px.
 *
 * On the label: **Explore**, per the Today State Atlas (docs/design/today-atlas,
 * "Rules the atlas encodes": Today / Closet / Plan / Explore, person.2). The
 * atlas is founder-approved canon and supersedes the earlier "Lately" call,
 * which had matched the page's own title in explore.tsx.
 *
 * `person.2` rather than a compass or a magnifying glass: this page is
 * emphatically not a public discovery feed (the projection behind it is
 * friends-only — see src/features/explore/queries.ts), and an icon that
 * promised strangers' closets would be promising something the security model
 * does not permit. It also keeps the family the other three set — a plain
 * symbol and its `.fill` for the selected state.
 *
 * Chrome discipline: monochrome ink tint (accent belongs to content, never
 * chrome), no `backgroundColor` (it kills the scroll-edge effect), and both
 * colours via `dynamic()` — Expo's docs: plain hex on the glass bar flickers
 * when dark mode flips.
 */
export default function TabsLayout() {
  // "Your trial ended" — fires at most once per lapse, on entering the main
  // app. Here rather than the root layout because this subtree only mounts
  // signed-in: the welcome screen must never open with a paywall.
  useTrialExpiredPlacement();

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
        // TY-01: one cut. Selected and default differ by COLOUR — muted to
        // ink — and by the indicator rule, never by weight.
        default: { fontFamily: 'HelveticaNeue', fontSize: 11, color: dynamic('muted') },
        selected: { fontFamily: 'HelveticaNeue', fontSize: 11, color: dynamic('ink') },
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
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
