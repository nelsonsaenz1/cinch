import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FailureNotice } from '@/components/ingest/garment-search-sheet';
import { Text } from '@/components/ui/text';
import { SEARCH_FAILURE_NOTICES } from '@/features/ingest/search-failure';

/**
 * DS-05 — the three notices, drawn together.
 *
 * "Comparison frame, not a screen." The atlas puts all three on one sheet
 * precisely so their difference can be read at once, and states in the same
 * breath that "in production one notice appears in place of the results list;
 * none of them is a dialog and none blocks the field". So this route is the
 * comparison, and the shipping sheet renders exactly one — chosen by
 * `classifySearchFailure`, whose ordering is pinned by
 * `tests/search-failure.test.ts`.
 *
 * Each is the REAL component with real copy; only the actions are inert here,
 * because a fixture must not file a row.
 */
const CAUSES = ['offline', 'consent_declined', 'partner_unavailable'] as const;

export default function DevW3G3Ds05() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-gutter pb-10 pt-6">
        <Text variant="title" trim>
          Describe a piece
        </Text>
        <Text variant="body" className="mt-2 text-muted">
          Three causes, three notices, one shape. Only one is ever on screen.
        </Text>

        {CAUSES.map((cause) => (
          <View key={cause} className="mt-8 border-t border-hairline pt-2">
            <FailureNotice
              cause={cause}
              filing={false}
              onFile={() => {}}
              onRetry={() => {}}
              onReviewConsent={() => {}}
            />
          </View>
        ))}

        <Text variant="note" className="mt-10">
          {`Every one of the ${CAUSES.length} ends in a filed piece: ${SEARCH_FAILURE_NOTICES.offline.primary.toLowerCase()}, or the peer beside the retry.`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
