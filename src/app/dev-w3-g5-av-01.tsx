import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityPage } from '@/components/activity/ActivityPage';
import { Text } from '@/components/ui/text';
import { AV_LINES, AV_NOW } from '@/features/activity/w3-g5-fixtures';

/**
 * AV-01 — the row kinds, each reading as a sentence.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 90 — every decision row carries ONE filled inline action whose width
 *   is set by its own word (Add back, Lend it) with a quiet text alternative
 *   beside it; the informational rows carry a text action only. Nothing here is
 *   a 48pt full-width pair.
 * · audit 91 — emphasis is spent once per row, ON THE ACTOR. The verb, the
 *   object, the occasion's title and the timestamp are all regular, and the
 *   timestamp is 13pt on its own line under the sentence.
 * · audit 91 — the Today indicator is ONE OXBLOOD DOT beside the word. Never a
 *   count: `useHasUnseenActivity()` returns a boolean by construction, no row
 *   carries an unread flag, and nothing in `activity_feed()` is held open
 *   because a reader has not looked.
 * · CORRECTION 22 — the surface is ACTIVITY and its window is 30 DAYS, stated
 *   in the masthead and again at the foot. The foot's line names WHERE an
 *   aged-out item still lives: "Anything older still lives on the request,
 *   occasion or comment it belongs to." The number is the query's own —
 *   `interval '30 days'`, `20260810100100_activity_feed.sql:116` — so the copy
 *   was changed to match the SQL and no migration was written.
 *
 * FIVE KINDS, NOT THE ATLAS'S SIX. The atlas draws a comment row; the feed has
 * no comment branch, so that row cannot exist. See `w3-g5-fixtures.ts`.
 *
 * DETERMINISM: `AV_NOW` is a literal and every timestamp is an offset from it,
 * so the day groupings and the elapsed labels are byte-identical on every run.
 * No query, no clock, no spinner.
 */
export default function DevW3G5AV01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <ActivityPage
        status="ready"
        lines={AV_LINES}
        stateOf={() => ({ status: 'idle' })}
        onAnswer={() => undefined}
        onNavigate={() => undefined}
        onRetry={() => undefined}
        now={AV_NOW}
      />
    </View>
  );
}
