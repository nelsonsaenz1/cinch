import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityPage } from '@/components/activity/ActivityPage';
import { ActivityRow } from '@/components/activity/ActivityRow';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import type { AnswerState } from '@/features/activity/answers';
import {
  AV_BORROW,
  AV_MARGUERITE,
  AV_NOW,
  AV_PRIYA,
} from '@/features/activity/w3-g5-fixtures';

/**
 * AV-02 — pending, failed, dismissed, empty, error. Drawn together.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · PENDING is a TRAY-FILLED LABEL IN THE PRESENT PARTICIPLE — "Adding back…"
 *   — not a spinner replacing the row. A spinner says only "wait", and it
 *   cannot reproduce its own bytes in a capture, so a state drawn with one can
 *   never be verified from a screenshot.
 * · FAILED NAMES WHAT DID NOT HAPPEN: "Lending did not go through. Ana has not
 *   been told anything." Retry sits on the row; nothing moves, nothing is lost.
 * · DISMISSED IS THE SUBTLEST CASE. The backend only sets aside — one row into
 *   `activity_dismissals`, which `activity_feed()` filters on and nothing else
 *   reads — so the row says SET ASIDE, says the request is STILL WAITING IN
 *   FRIENDS, says SHE WAS NOT TOLD, and offers Undo. No rejection is implied
 *   anywhere, and the undo is real: `activity_dismissals` carries an owner
 *   DELETE policy and grant (`20260810100100_activity_feed.sql:79-82`), which
 *   `useUndoDismissActivity` uses to put the row back.
 * · EMPTY says quiet is the normal state instead of prompting engagement.
 * · THE LOAD ERROR does not promise that nothing expires while unread — unread
 *   state has no effect on retention. It says what is true and more useful:
 *   anything waiting is waiting on its own record.
 *
 * DETERMINISM: fixed clock, fixed rows, no query, no `ActivityIndicator`, no
 * infinite shimmer. Every panel is the shipping component in the state.
 */
const PENDING: AnswerState = { status: 'pending', actionId: 'add-back' };
const FAILED: AnswerState = { status: 'failed', actionId: 'lend' };
const SET_ASIDE: AnswerState = { status: 'done', actionId: 'not-now' };

export default function DevW3G5AV02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-12">
        <Panel label="Row states">
          <Card style={{ borderRadius: 16 }}>
            <ActivityRow
              line={AV_PRIYA}
              state={PENDING}
              onAnswer={() => undefined}
              onNavigate={() => undefined}
            />
            <Rule tone="hairline" />
            <ActivityRow
              line={AV_BORROW}
              state={FAILED}
              onAnswer={() => undefined}
              onNavigate={() => undefined}
            />
            <Rule tone="hairline" />
            <ActivityRow
              line={AV_MARGUERITE}
              state={SET_ASIDE}
              onAnswer={() => undefined}
              onNavigate={() => undefined}
              onUndo={() => undefined}
              isLast
            />
          </Card>
        </Panel>

        <Panel label="Nothing lately">
          <View style={{ height: 360 }}>
            <ActivityPage
              status="ready"
              lines={[]}
              stateOf={() => ({ status: 'idle' })}
              onAnswer={() => undefined}
              onNavigate={() => undefined}
              onRetry={() => undefined}
              now={AV_NOW}
            />
          </View>
        </Panel>

        <Panel label="Could not load">
          <View style={{ height: 360 }}>
            <ActivityPage
              status="error"
              lines={[]}
              stateOf={() => ({ status: 'idle' })}
              onAnswer={() => undefined}
              onNavigate={() => undefined}
              onRetry={() => undefined}
              now={AV_NOW}
            />
          </View>
        </Panel>
      </ScrollView>
    </View>
  );
}

/** Scaffolding, not a designed surface. */
function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-gutter pt-6">
      <Text variant="eyebrow" className="mb-2">
        {label}
      </Text>
      {children}
    </View>
  );
}
