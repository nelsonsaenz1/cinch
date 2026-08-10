import { SymbolView } from 'expo-symbols';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PlateTile } from '@/components/ui/plate-tile';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { dayCell, monthLabel, rowLine, rowMeta, wearsLine } from './entry';
import type { DiaryEntry, DiaryMonth, DiaryPiece, YearChip } from './types';

/**
 * The Wear diary, rendered — WD-01 populated, WD-02 empty, WD-04 loading.
 *
 * Render-only, on the `friends-page.tsx` precedent: every derivation and every
 * mutation lives in `src/app/diary.tsx`, and `dev-diary.tsx` mounts this same
 * component over fixtures, so what is signed off there is what ships.
 *
 * ── Where this departs from atlas 33, and why ─────────────────────────────
 *
 * **The well is the 2×2 plate tile, not one hero photograph.** The atlas draws
 * a single garment in the 68pt well and calls it "the hero piece of the look".
 * The shared `PlateTile` is what the wave standardised on for a look at rest,
 * and a tray of the pieces is a truer likeness of a look than whichever garment
 * happened to be first — a row whose picture is a pair of loafers is a row
 * about loafers.
 *
 * **The page's chrome is the app's, not the atlas's.** The atlas draws this as
 * a tab root with no way back; it is reached from Profile, so the eyebrow moves
 * into `ScreenHeader` beside a back button — exactly the composition Friends
 * already uses for the same shape of page.
 *
 * **`faint` is never text.** The atlas sets the row's second line and the month
 * count in #8A8578 and #A29C90; both fail AA on canvas. `note` and `colophon`
 * are the app's `muted` equivalents at the same sizes and tracking.
 */
export type DiaryPageProps = {
  months: DiaryMonth[];
  /** Empty when the record does not span a year boundary — the atlas's own rule. */
  chips: YearChip[];
  selectedChip: string;
  onSelectChip: (id: string) => void;
  loading: boolean;
  error: boolean;
  retrying: boolean;
  onRetry: () => void;
  /** True only once the read has succeeded and returned nothing. */
  showEmpty: boolean;
  onPlanToday: () => void;
  onOpenEntry: (entryId: string) => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  /**
   * A storage path resolved to a signed, displayable URL. The page signs
   * nothing itself — one batched request lives in the route, which is also what
   * lets the fixture hand over local asset URIs.
   */
  resolveImage: (piece: DiaryPiece) => string | undefined;
};

export function DiaryPage(props: DiaryPageProps) {
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Everything you wore" onBack={props.onBack} backLabel="Back" />

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Wear diary
        </Text>
      </View>

      {/* One row of year chips, nothing more — no occasion filter, no search,
          no calendar picker. A diary is read by scrolling. */}
      {props.chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // A ScrollView grows to fill its parent by default; as a flex child
          // of this column that would stretch every chip screen-tall. The row's
          // height is its content's, nothing more.
          style={{ flexGrow: 0 }}
          contentContainerClassName="gap-2 px-gutter pt-4">
          {props.chips.map((chip) => (
            <Chip
              key={chip.id}
              label={chip.label}
              selected={chip.id === props.selectedChip}
              selectedGround="ink"
              onPress={() => props.onSelectChip(chip.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-16"
        contentContainerStyle={props.showEmpty || props.error ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={props.refreshing}
            onRefresh={props.onRefresh}
            tintColor={theme.muted}
          />
        }>
        {props.loading ? (
          <DiarySkeleton />
        ) : props.error ? (
          <ErrorState
            title="Couldn’t read the diary."
            body="Cinch couldn’t reach your record just now. Nothing you wore has changed — it is all still there."
            onRetry={props.onRetry}
            retrying={props.retrying}
          />
        ) : props.showEmpty ? (
          <EmptyState
            symbol="list.bullet.rectangle"
            title="The record starts today"
            body="Every look you confirm is written here, newest first. Nothing to do differently — wear the clothes, and the month fills itself in."
            actionTitle="Plan today’s look"
            onAction={props.onPlanToday}
          />
        ) : props.months.length === 0 ? (
          // A year chip with nothing behind it. Not the empty state: the record
          // is not empty, this slice of it is, and saying otherwise would tell
          // someone with two years of wears that they have none.
          <View className="px-gutter pt-8">
            <Text variant="note">Nothing recorded in that year.</Text>
          </View>
        ) : (
          props.months.map((month) => (
            <MonthSection
              key={month.key}
              month={month}
              onOpenEntry={props.onOpenEntry}
              resolveImage={props.resolveImage}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// The spine
// ---------------------------------------------------------------------------

function MonthSection({
  month,
  onOpenEntry,
  resolveImage,
}: {
  month: DiaryMonth;
  onOpenEntry: (entryId: string) => void;
  resolveImage: (piece: DiaryPiece) => string | undefined;
}) {
  return (
    <View>
      <MonthHeader label={month.label} count={month.count} />
      <Card className="mx-gutter">
        {month.entries.map((entry, i) => (
          <View key={entry.id}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <DiaryRow
              entry={entry}
              onPress={() => onOpenEntry(entry.id)}
              resolveImage={resolveImage}
            />
          </View>
        ))}
      </Card>
    </View>
  );
}

/**
 * The month, and its total ranged right.
 *
 * The count is the number of rows under it — counted from the record, never
 * estimated, and never a figure the server was asked for separately and could
 * disagree with.
 */
function MonthHeader({ label, count }: { label: string; count: number | null }) {
  return (
    <View className="flex-row items-baseline justify-between px-gutter pb-2.5 pt-7">
      <Text variant="plate">{label}</Text>
      {count !== null ? <Text variant="colophon">{wearsLine(count)}</Text> : null}
    </View>
  );
}

/**
 * One entry. The whole row is one target and leads to the day.
 *
 * `className` plus an OBJECT style, never a function style: a `Pressable`
 * carrying both a className and a function style renders nothing at all under
 * NativeWind's interop, which is how a dead button once shipped.
 */
function DiaryRow({
  entry,
  onPress,
  resolveImage,
}: {
  entry: DiaryEntry;
  onPress: () => void;
  resolveImage: (piece: DiaryPiece) => string | undefined;
}) {
  const theme = useTheme();
  const { weekday, day } = dayCell(entry.wornAt);
  const line = rowLine(entry);
  const meta = rowMeta(entry);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${day}. ${line}${meta ? `. ${meta}` : ''}`}
      accessibilityHint="Opens this day"
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3.5 px-4 py-3.5 active:opacity-60">
      {/* The date column — 44pt, weekday over numeral. It repeats within a
          month rather than being collapsed, because the reader scans down
          dates. */}
      <View className="items-center" style={{ width: 44 }}>
        <Text variant="colophon">{weekday}</Text>
        <Text variant="plate">{day}</Text>
      </View>

      <PlateTile images={entry.pieces.slice(0, 4).map((p) => resolveImage(p) ?? null)} size={68} />

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {line}
        </Text>
        {meta ? (
          <Text variant="note" numberOfLines={1} className="mt-0.5">
            {meta}
          </Text>
        ) : null}
      </View>

      <SymbolView
        name="chevron.right"
        size={13}
        tintColor={theme.byline}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// WD-04
// ---------------------------------------------------------------------------

/**
 * Reading the record.
 *
 * The skeleton keeps the date column, the 68pt well and two lines, so the month
 * header does not shift when rows arrive. The header itself carries the CURRENT
 * month — a fact the device already has — and no count, because a count is the
 * one thing the page does not know yet and a placeholder figure would be a
 * number nobody wrote.
 */
function DiarySkeleton() {
  const widths = ['64%', '78%', '52%'] as const;

  return (
    <View accessibilityLabel="Reading your diary">
      <MonthHeader label={monthLabel(new Date().toISOString())} count={null} />
      <Card className="mx-gutter">
        {widths.map((width, i) => (
          <View key={width}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <View className="flex-row items-center gap-3.5 px-4 py-3.5">
              <View className="items-center gap-1.5" style={{ width: 44 }}>
                <Skeleton className="h-2 w-[70%] rounded-chip" delay={i * 120} />
                <Skeleton className="h-5 w-full rounded-chip" delay={i * 120} />
              </View>
              <Skeleton className="h-[68px] w-[68px] rounded" delay={i * 120} />
              <View className="flex-1 gap-2">
                <Skeleton className="h-3.5 rounded-chip" style={{ width }} delay={i * 120} />
                <Skeleton className="h-2.5 w-[44%] rounded-chip" delay={i * 120} />
              </View>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}
