import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedEmptyState, BlockedRows } from '@/components/social/BlockedList';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { G6_BLOCKED, G6_NOW } from '@/features/social-graph/w3-g6-fixtures';

/**
 * SF-03 — BL-01's three other states: unblocking, failed, and empty.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · UNBLOCKING keeps the row and labels itself in the present participle. The
 *   affordance becomes a tray-filled word rather than disappearing, so the row
 *   does not reflow — and rather than a spinner, which can never reproduce its
 *   own pixels in a capture.
 * · FAILED is the important one on a safety screen. It says the block is still
 *   in force, that nothing changed and that the other person was told nothing.
 *   It lives ON THE ROW rather than in an `Alert`: a modal that dismisses
 *   leaves no evidence of which person did not change, and a user who cannot
 *   tell whether a block lapsed has a real problem rather than a cosmetic one.
 * · EMPTY teaches the mechanism without dramatising it and repeats the two
 *   facts that matter: nobody is notified, and it is reversible from here. It
 *   makes NO claim about what blocking did to somebody, because there is
 *   nobody on screen for the claim to be about.
 *
 * Three states stacked in one route so the differences are readable side by
 * side; each is the shipping component, not a mock of one.
 */
export default function DevW3G6SF03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <SectionHeader title="Unblocking" className="mb-2.5" />
        <BlockedRows
          rows={G6_BLOCKED.slice(0, 1)}
          now={G6_NOW}
          pendingId="u-daniel"
          onUnblock={() => undefined}
          onRetry={() => undefined}
        />

        <Rule tone="hairline" className="my-8" />

        <SectionHeader title="Failed" className="mb-2.5" />
        <BlockedRows
          rows={G6_BLOCKED.slice(0, 1)}
          now={G6_NOW}
          failedId="u-daniel"
          onUnblock={() => undefined}
          onRetry={() => undefined}
        />

        <Rule tone="hairline" className="my-8" />

        <SectionHeader title="Empty" className="mb-2.5" />
        <View style={{ minHeight: 300 }}>
          <BlockedEmptyState />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
