import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/rule';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  EMPTY_BODY,
  EMPTY_TITLE,
  ERROR_BODY,
  ERROR_RETRY,
  ERROR_TITLE,
  LOADING_STATUS,
  OFFLINE_BANNER,
} from '@/features/activity-center/copy';
import { useTheme } from '@/theme/tokens';

import { ActivityCenterEmptyGlyph, ActivityCenterErrorGlyph } from './glyphs';

/**
 * AC-01, AC-06 and AC-07 — the three states with no rows in them, plus the
 * banner AC-07 draws ABOVE rows that do exist.
 *
 * The distinction that matters most here is the one between AC-01 and AC-07. An
 * empty inbox and a failed read look identical from the outside and mean
 * opposite things: one says nothing has happened, the other says we could not
 * find out. Dressing the second as the first would tell a reader that nobody
 * had invited them to anything when in fact the app had simply failed to look,
 * which is the failure `ErrorState` exists for across this app and the reason
 * these are two components rather than one with a flag.
 */

const HERO_GLYPH = 34;

function Hero({
  glyph,
  title,
  body,
  actionTitle,
  onAction,
  footnote,
  alert = false,
}: {
  glyph: React.ReactNode;
  title: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
  footnote?: string | null;
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
        <View style={{ marginTop: 20 }}>
          <Button title={actionTitle} variant="ink" onPress={onAction} />
        </View>
      ) : null}
      {footnote ? (
        <Text variant="note" className="mt-3 text-center" style={{ fontSize: 13 }}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * AC-01 · "You're all caught up."
 *
 * NO BUTTON, and that is the design rather than an omission. There is nothing
 * on an empty inbox to do — the page fills because other people did things —
 * and a "Find friends" or "Make a group" here would be this surface borrowing
 * Explore's job in order to have something to ask for. Quiet is the normal
 * state, and a surface that cannot bear its own quiet is an engagement surface.
 */
export function ActivityEmpty() {
  const theme = useTheme();

  return (
    <Hero
      glyph={<ActivityCenterEmptyGlyph size={HERO_GLYPH} color={theme.faint ?? theme.muted} />}
      title={EMPTY_TITLE}
      body={EMPTY_BODY}
    />
  );
}

/**
 * AC-07 · the read failed and there is nothing cached to fall back on.
 *
 * `lastUpdated` is the frame's "Last updated 5 hours ago". It is drawn only when
 * there genuinely was a previous success; a fabricated one would be worse than
 * none, because the whole point of the line is to tell the reader how stale
 * what they are looking at is.
 */
export function ActivityError({
  onRetry,
  lastUpdated,
}: {
  onRetry: () => void;
  lastUpdated?: string | null;
}) {
  const theme = useTheme();

  return (
    <Hero
      alert
      glyph={<ActivityCenterErrorGlyph size={HERO_GLYPH} color={theme.accent} />}
      title={ERROR_TITLE}
      body={ERROR_BODY}
      actionTitle={ERROR_RETRY}
      onAction={onRetry}
      footnote={lastUpdated ? `Last updated ${lastUpdated}` : null}
    />
  );
}

/**
 * AC-07's banner, for the case that matters more: a failed refresh over a list
 * that is still perfectly readable.
 *
 * It sits ABOVE the rows and never instead of them. A reader who opened the app
 * on a train wants yesterday's invitation, correctly labelled as yesterday's,
 * rather than a full-screen apology in front of data the device is already
 * holding. `accessibilityLiveRegion="polite"` so it is announced when it
 * appears without interrupting whatever VoiceOver is reading.
 */
export function OfflineBanner() {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="mx-gutter mt-1.5 flex-row items-center gap-2.5 rounded-lg px-3.5 py-2.5"
      style={{ backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: theme.accent,
        }}>
        <Text style={{ fontSize: 11, lineHeight: 13, color: theme.accent }}>!</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.accent }}>
        {OFFLINE_BANNER}
      </Text>
    </View>
  );
}

/**
 * AC-06 · five rows of the geometry the real ones have, and one status line.
 *
 * The pulse is `Skeleton`'s own sweep, which already freezes under Reduce Motion
 * (`useReducedMotion` inside the primitive) — so §10's "skeleton pulse frozen"
 * is honoured by using the shared primitive rather than by a branch here.
 *
 * The status line is a POLITE LIVE REGION rather than decoration: a reader who
 * has just pushed this screen and cannot see it needs to be told that something
 * is happening, and "Loading your activity…" is the sentence §9 keys for it.
 */
export function ActivitySkeleton() {
  return (
    <View>
      <View className="px-gutter pb-1.5 pt-2.5">
        <Skeleton className="rounded-chip" style={{ width: 44, height: 12 }} />
      </View>

      {[
        { circle: true, wide: '82%' as const, narrow: '46%' as const },
        { circle: false, wide: '70%' as const, narrow: '38%' as const },
        { circle: true, wide: '88%' as const, narrow: '52%' as const },
        { circle: false, wide: '64%' as const, narrow: '40%' as const },
        { circle: true, wide: '76%' as const, narrow: '44%' as const },
      ].map((row, i, all) => (
        <View key={row.wide}>
          <View className="flex-row items-center gap-3" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
            {/* The presence gutter is reserved here too, so nothing shifts
                sideways when the real rows land. */}
            <View style={{ width: 8 }} />
            <Skeleton
              style={{ width: 36, height: 36, borderRadius: row.circle ? 11 : 18 }}
              delay={i * 120}
            />
            <View className="flex-1" style={{ gap: 8 }}>
              <Skeleton className="rounded-chip" style={{ height: 12, width: row.wide }} delay={i * 120} />
              <Skeleton className="rounded-chip" style={{ height: 11, width: row.narrow }} delay={i * 120} />
            </View>
          </View>
          {i === all.length - 1 ? null : <Rule tone="hairline" />}
        </View>
      ))}

      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        variant="note"
        className="mt-6 text-center"
        style={{ fontSize: 13 }}>
        {LOADING_STATUS}
      </Text>
    </View>
  );
}
