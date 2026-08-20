import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTrialExpiredPlacement } from '@/features/billing/use-trial-expired';
import { useEventInvites } from '@/features/events/queries';
import { useExploreUnseenDot } from '@/features/explore/use-explore-unseen';
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
 * Five tabs. Four was argued ("a Stylist chat tab is the generic-AI tell"),
 * and on 2026-08-20 the founder overruled it in one sentence: "I barely know
 * stylist exists." The argument was right about chat tabs and wrong about
 * this one — the stylist is the app's flagship capability (the questionnaire,
 * the recreate-a-look door, the chat) and a flagship behind a masthead glyph
 * is a feature nobody finds. It sits centre, between the two halves it works
 * from: what today needs and what the closet holds. Profile stays the avatar
 * in Today's masthead (src/app/profile.tsx). Five is the ceiling — iOS
 * collapses into "More" past it — so the bar is now full, and the next
 * candidate has to evict something rather than join.
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

  /**
   * UX-10 — the app's two attention marks, and the whole of its notion of a
   * badge: a quiet dot, never a number in a red circle. A count is a scoreboard
   * and invites the arithmetic of falling behind; a dot says only "there is
   * something here", which is the entire honest content of the signal.
   *
   * Both are read from authoritative state, and both suppress rather than guess.
   *
   * - **Plan** — `useEventInvites` is a server read of invitations addressed to
   *   you and not yet answered. Actionable by construction: an invitation is a
   *   question, and the dot clears when you answer it.
   * - **Explore** — genuinely unseen friend activity, measured against a stored
   *   authoritative timestamp. Every uncertain path returns false: no session,
   *   the boundary never written, the feed still loading, the feed failed. See
   *   `unseen.ts` for why an unproven boundary draws nothing at all.
   *
   * Mounting the two queries here is what makes a badge a badge — it has to be
   * true on the tab you are NOT looking at. react-query then hands the same
   * cache entries to Plan and Explore already warm, so the cost is one request
   * each per session, not one per tab switch.
   */
  const invites = useEventInvites();
  const invitesWaiting = invites.isSuccess && (invites.data?.length ?? 0) > 0;
  const unseenInCircle = useExploreUnseenDot();

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
      {/* sparkles has no .fill variant; selection reads through tint and the
          indicator, the same two channels the labels already use. */}
      <NativeTabs.Trigger name="stylist">
        <NativeTabs.Trigger.Icon sf="sparkles" />
        <NativeTabs.Trigger.Label>Stylist</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>Plan</NativeTabs.Trigger.Label>
        {/* No children — SDK 57 draws a bare dot for a valueless badge, which
            is exactly the mark we want. `hidden` rather than a conditional
            child so the trigger's child set never changes shape. */}
        <NativeTabs.Trigger.Badge hidden={!invitesWaiting} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!unseenInCircle} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
