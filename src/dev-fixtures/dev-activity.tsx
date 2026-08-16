import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityPage } from '@/components/activity/ActivityPage';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import type { AnswerState } from '@/features/activity/answers';
import {
  describeActivity,
  type ActivityActionId,
  type ActivityLine,
} from '@/features/activity/sentence';
import type { ActivityFeedRow, ActivitySubjects } from '@/features/activity/types';

/**
 * The switcher over every state this unit owns — AV-01…AV-05.
 * `cinch://dev-activity`.
 *
 * "A state without a dev route is a state nobody has looked at, and a dev route
 * whose fixture handlers are no-ops is a dead end." So the answers here really
 * move: tapping Add back or Lend it puts the row into `pending` and lands it on
 * `done` a beat later, and AV-05's failed row retries into the same path. No
 * network, no writes — the fixture handlers advance local state and nothing
 * else. `now` is frozen so the elapsed labels and day headings are the atlas's.
 */

const FRAMES = ['AV-01', 'AV-02', 'AV-03', 'AV-04', 'AV-05'] as const;
type Frame = (typeof FRAMES)[number];

/** 9:41 on a Thursday, so "Tue 4 Aug" and "Mon 3 Aug" fall where the atlas draws them. */
const NOW = new Date(2026, 7, 6, 9, 41);

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const dayAt = (day: number, hour = 18) => new Date(2026, 7, day, hour).toISOString();

type Fixture = { row: ActivityFeedRow; subjects: ActivitySubjects };

const SAM = 'Sam Okafor';
const NORA = 'Nora Lindqvist';
const MARA = 'Mara Whitfield';

const NONE: ActivitySubjects = {
  actorName: null,
  garment: null,
  eventTitle: null,
  eventStartsAt: null,
};

/** The atlas's own six rows, plus the mutual-follow row it puts under Earlier. */
const FIXTURES: Fixture[] = [
  {
    row: {
      kind: 'follow_in',
      subjectKey: 'u-sam',
      actorId: 'u-sam',
      occurredAt: hoursAgo(2),
      itemId: null,
      outfitId: null,
      eventId: null,
      postId: null,
      tally: null,
    },
    subjects: { ...NONE, actorName: SAM },
  },
  {
    row: {
      kind: 'borrow_request',
      subjectKey: 'br-1',
      actorId: 'u-nora',
      occurredAt: hoursAgo(4),
      itemId: 'i-coat',
      outfitId: null,
      eventId: 'e-fri',
      postId: null,
      tally: null,
    },
    subjects: {
      ...NONE,
      actorName: NORA,
      garment: 'shearling coat',
      eventTitle: 'Drinks at the Ivy',
      eventStartsAt: dayAt(7, 19),
    },
  },
  {
    row: {
      kind: 'event_invite',
      subjectKey: 'e-lunch',
      actorId: 'u-mara',
      occurredAt: hoursAgo(5),
      itemId: null,
      outfitId: null,
      eventId: 'e-lunch',
      postId: null,
      tally: null,
    },
    subjects: {
      ...NONE,
      actorName: MARA,
      eventTitle: 'Sunday lunch',
      eventStartsAt: dayAt(14, 13),
    },
  },
  {
    row: {
      kind: 'votes',
      subjectKey: 'p-1',
      actorId: null,
      occurredAt: dayAt(5, 20),
      itemId: null,
      outfitId: 'o-1',
      eventId: 'e-supper',
      postId: 'p-1',
      tally: 3,
    },
    subjects: { ...NONE, eventTitle: 'Wednesday supper', eventStartsAt: dayAt(5, 19) },
  },
  {
    row: {
      kind: 'compliment',
      subjectKey: 'u-sam:i-coat',
      actorId: 'u-sam',
      occurredAt: dayAt(5, 16),
      itemId: 'i-coat',
      outfitId: null,
      eventId: null,
      postId: null,
      tally: null,
    },
    subjects: { ...NONE, actorName: SAM, garment: 'shearling coat' },
  },
  {
    row: {
      kind: 'borrow_returned',
      subjectKey: 'br-0',
      actorId: 'u-nora',
      occurredAt: dayAt(4, 11),
      itemId: 'i-skirt',
      outfitId: null,
      eventId: null,
      postId: null,
      tally: null,
    },
    subjects: { ...NONE, actorName: NORA, garment: 'corduroy skirt' },
  },
  {
    row: {
      kind: 'follow_back',
      subjectKey: 'u-mara',
      actorId: 'u-mara',
      occurredAt: dayAt(3, 9),
      itemId: null,
      outfitId: null,
      eventId: null,
      postId: null,
      tally: null,
    },
    subjects: { ...NONE, actorName: MARA },
  },
];

const LINES: ActivityLine[] = FIXTURES.map((f) => describeActivity(f.row, f.subjects, NOW));

/**
 * AV-05 — three states of one action, on three rows that can actually reach
 * them.
 *
 * The atlas puts the failed state on its event-invitation row. An invitation
 * carries a destination, not an answer, so nothing about it can fail to send
 * and its retry would have nothing to retry — the third row here is a second
 * friend request instead. Same three states, on rows that can hold them.
 */
const AV05: ActivityLine[] = [
  LINES[0]!,
  LINES[1]!,
  describeActivity(
    {
      kind: 'follow_in',
      subjectKey: 'u-mara',
      actorId: 'u-mara',
      occurredAt: hoursAgo(5),
      itemId: null,
      outfitId: null,
      eventId: null,
      postId: null,
      tally: null,
    },
    { ...NONE, actorName: MARA },
    NOW,
  ),
];

const ANSWERED: Record<string, AnswerState> = {
  'follow_in:u-sam': { status: 'done', actionId: 'add-back' },
  'borrow_request:br-1': { status: 'pending', actionId: 'lend' },
  'follow_in:u-mara': { status: 'failed', actionId: 'add-back' },
};

export default function DevActivityScreen() {
  const [frame, setFrame] = useState<Frame>('AV-01');
  const [states, setStates] = useState<Record<string, AnswerState>>({});
  const [went, setWent] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  // AV-05's three rows are posed; AV-01's are live and answer for real.
  const posed = frame === 'AV-05';
  const lines = posed ? AV05 : LINES;

  const stateOf = (key: string): AnswerState =>
    states[key] ?? (posed ? (ANSWERED[key] ?? { status: 'idle' }) : { status: 'idle' });

  const answer = (line: ActivityLine, actionId: ActivityActionId) => {
    setStates((prev) => ({ ...prev, [line.key]: { status: 'pending', actionId } }));
    timers.current.push(
      setTimeout(() => {
        setStates((prev) => ({ ...prev, [line.key]: { status: 'done', actionId } }));
      }, 700),
    );
  };

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1">
        <ActivityPage
          status={frame === 'AV-03' ? 'loading' : frame === 'AV-04' ? 'error' : 'ready'}
          lines={frame === 'AV-02' ? [] : lines}
          stateOf={stateOf}
          onAnswer={answer}
          // Destinations are named rather than pushed: the fixture ids point at
          // no real event or friend, and a dev route that navigated into a Not
          // Found is a worse dead end than one that says where it would go.
          onNavigate={(line, actionId) => setWent(`${actionId} → ${line.key}`)}
          // A retry that actually loads: AV-04's button lands on AV-01, which
          // is where a successful second read would land.
          onRetry={() => setFrame('AV-01')}
          now={NOW}
        />
      </View>

      <View className="border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={frame === f}
              selectedGround="ink"
              onPress={() => {
                setStates({});
                setWent(null);
                setFrame(f);
              }}
            />
          ))}
        </View>
        <Text variant="noteSmall" className="mt-2">
          {went ?? 'AV-01 answers for real (pending → answered). AV-05 poses all three.'}
        </Text>
      </View>
    </View>
  );
}
