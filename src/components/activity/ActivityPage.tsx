import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import type { AnswerState } from '@/features/activity/answers';
import type { ActivityActionId, ActivityLine } from '@/features/activity/sentence';
import { groupByDay } from '@/features/explore/timeline';
import { useTheme } from '@/theme/tokens';

import { ActivityBellGlyph, ActivityErrorGlyph } from './glyphs';
import { ActivityRow } from './ActivityRow';

/**
 * The Activity page, as a pure presentation — AV-01 through AV-05.
 *
 * Everything that can fail, write or navigate is a prop, which is what lets
 * `dev-activity.tsx` pose all five states against the same component the app
 * mounts rather than against a second drawing of it.
 *
 * The card sits at 16, not the plate's 20: a ledger line is smaller furniture
 * than an outfit plate, and this page speaks the same local dialect Lately
 * already does.
 */

const CARD_RADIUS = 16;

export type ActivityPageStatus = 'ready' | 'loading' | 'error';

export type ActivityPageProps = {
  status: ActivityPageStatus;
  lines: ActivityLine[];
  /** Actor id → avatar URL. */
  faces?: Map<string, string | null>;
  stateOf: (key: string) => AnswerState;
  onAnswer: (line: ActivityLine, actionId: ActivityActionId) => void;
  onNavigate: (line: ActivityLine, actionId: ActivityActionId) => void;
  onRetry: () => void;
  isRefetching?: boolean;
  onRefresh?: () => void;
  /** Injected for the dev route, so the day headings can be posed. */
  now?: Date;
};

export function ActivityPage({
  status,
  lines,
  faces,
  stateOf,
  onAnswer,
  onNavigate,
  onRetry,
  isRefetching = false,
  onRefresh,
  now,
}: ActivityPageProps) {
  const theme = useTheme();

  const groups = groupByDay(lines, (line) => line.row.occurredAt, now ?? new Date());

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The atlas draws this page as a tab, with the tab bar as its way out.
          It ships as a route pushed from Today, so it carries the chevron every
          other pushed screen carries — `borrow.tsx`'s shape exactly. Without it
          the only way back is the edge swipe, which is a gesture and not an
          affordance. */}
      <ScreenHeader align="leading" />

      <View className="px-gutter pt-3">
        <Text variant="eyebrow">What has happened</Text>
        <View style={{ marginTop: 6 }}>
          <Text variant="display" trim accessibilityRole="header">
            Activity
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="pb-10"
        // `flexGrow`, not `flex`: the two hero states centre with `flex-1`,
        // which collapses to nothing inside a content-sized scroll container —
        // and hoisting them out would cost pull-to-refresh on exactly the
        // screen where "try again" matters most. Same reasoning as Lately's.
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.muted} />
          ) : undefined
        }>
        {status === 'error' ? (
          // AV-04. A failed read is never dressed as an empty page: the copy
          // says plainly that nothing has been accepted, declined or missed,
          // because the reader's real question is whether they have lost
          // something, not whether the network is well.
          <Hero
            alert
            glyph={<ActivityErrorGlyph size={34} color={theme.accent} />}
            title="Couldn’t read your activity"
            body="This did not load, which is a connection problem rather than an empty page. Nothing has been accepted, declined or missed."
            actionTitle="Try again"
            onAction={onRetry}
          />
        ) : status === 'loading' ? (
          <ActivitySkeleton />
        ) : lines.length === 0 ? (
          // AV-02. No count, no bell ringing — the sentence's job is to say
          // where the dot lives, because that dot is the only badge in the app.
          <Hero
            glyph={<ActivityBellGlyph size={34} color="rgba(28,26,22,0.28)" />}
            title="Nothing waiting"
            body="Requests, borrows, invitations and votes land here. When one does, you will see a dot on Today — and nowhere else."
          />
        ) : (
          <View className="px-gutter">
            {groups.map((group) => (
              <View key={group.key}>
                <SectionHeader title={group.label} className="mb-2.5 mt-5" />
                <Card style={{ borderRadius: CARD_RADIUS }}>
                  {group.entries.map((line, i) => (
                    <ActivityRow
                      key={line.key}
                      line={line}
                      avatarUri={line.row.actorId ? faces?.get(line.row.actorId) : null}
                      state={stateOf(line.key)}
                      onAnswer={(actionId) => onAnswer(line, actionId)}
                      onNavigate={(actionId) => onNavigate(line, actionId)}
                      isLast={i === group.entries.length - 1}
                    />
                  ))}
                </Card>
              </View>
            ))}

            {/* The thirty-day floor, stated once rather than discovered as a
                list that mysteriously stops. There is no "load more" because
                the bound is enforced in SQL and older answers live on the
                object itself — the event, the item, the friend. */}
            <Text variant="noteSmall" className="mt-5">
              Activity from the last thirty days.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The full-page state: glyph, serif line, body, and — for the failure only —
 * one way forward. The empty page carries no button on purpose: there is
 * nothing here to do, and "Find a friend" would be this page borrowing
 * Lately's job.
 */
function Hero({
  glyph,
  title,
  body,
  actionTitle,
  onAction,
  alert = false,
}: {
  glyph: React.ReactNode;
  title: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
  alert?: boolean;
}) {
  return (
    <View
      accessibilityRole={alert ? 'alert' : 'summary'}
      className="flex-1 items-center justify-center"
      style={{ paddingHorizontal: 42 }}>
      {glyph}
      <View style={{ marginTop: 18 }}>
        <Text variant="title" trim className="text-center">
          {title}
        </Text>
      </View>
      <Text className="mt-2.5 text-center text-muted" style={{ fontSize: 15, lineHeight: 23 }}>
        {body}
      </Text>
      {actionTitle && onAction ? (
        // The one control on this page that is a control the app's own size,
        // so it is the shared `Button` — ink, not the accent, which stays spent
        // on the glyph above it. The row-level 34pt buttons are the exception
        // and say why in ActivityRow.tsx.
        <View style={{ marginTop: 20 }}>
          <Button title={actionTitle} variant="ink" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * AV-03 — the same geometry the real rows have.
 *
 * 36pt mark, two lines, and an action bar on the FIRST TWO rows only, which is
 * the atlas's own instruction and its reason: answerable rows sort to the top
 * of a fresh page, so a skeleton without those bars would shorten by two
 * button-heights the moment the data landed.
 */
export function ActivitySkeleton() {
  return (
    <View className="px-gutter">
      <SectionHeader title="Today" className="mb-2.5 mt-5" />
      <Card style={{ borderRadius: CARD_RADIUS }}>
        {[
          { width: '86%' as const, bar: true },
          { width: '72%' as const, bar: true },
          { width: '92%' as const, bar: false },
          { width: '64%' as const, bar: false },
        ].map((row, i, all) => (
          <View key={row.width}>
            <View
              className="flex-row items-start gap-3"
              style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
              <Skeleton style={{ width: 36, height: 36, borderRadius: 18 }} delay={i * 120} />
              <View className="flex-1" style={{ gap: 8 }}>
                <Skeleton
                  className="rounded-chip"
                  style={{ height: 13, width: row.width }}
                  delay={i * 120}
                />
                <Skeleton className="rounded-chip" style={{ height: 10, width: '34%' }} delay={i * 120} />
                {row.bar ? (
                  <Skeleton style={{ height: 20, width: '46%', borderRadius: 8 }} delay={i * 120} />
                ) : null}
              </View>
            </View>
            {i === all.length - 1 ? null : <Rule tone="hairline" />}
          </View>
        ))}
      </Card>
    </View>
  );
}
