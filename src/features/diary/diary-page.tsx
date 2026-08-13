import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoticeBand } from '@/components/ui/notice-band';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Rule } from '@/components/ui/rule';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { dayCell, monthLabel, rowLine, rowMeta } from './entry';
import type { DiaryEntry, DiaryMonth, DiaryPiece, YearChip } from './types';

/**
 * The row's three columns, and where the name's width comes from.
 *
 * Audit 77 in one line of arithmetic: the date column drops from 88 to 44, the
 * well from 72 to 56, and every trailing fact moves under the name. At the
 * app's own 20pt page measure that leaves 393 − 40 − 44 − 56 − 28 = 225pt for
 * the name over two lines, against the atlas's 233 at its 16pt margin. The 8pt
 * difference is the app's gutter, which is a token and not this screen's to
 * spend; the name still takes every point the row is not using for something
 * else, which is what the audit asks for.
 */
const DATE_COL = 44;
const WELL = 56;

/**
 * The Wear diary, rendered — WD-01 populated, WD-02 empty, WD-04 loading.
 *
 * Render-only, on the `friends-page.tsx` precedent: every derivation and every
 * mutation lives in `src/app/diary.tsx`, and `dev-diary.tsx` mounts this same
 * component over fixtures, so what is signed off there is what ships.
 *
 * ── Where this departs from atlas 33, and why ─────────────────────────────
 *
 * **The well is one 56pt photograph again, not the 2×2 plate tile.** Atlas 33
 * was read as asking for a tray of the pieces, and at 68pt that was arguable.
 * The wave-3 atlas settles it twice over: the row is drawn at 56pt, where four
 * quarter-tiles are 25pt each and nothing in them is identifiable, and its own
 * transition note says the row's thumbnail "becomes the first tile of the
 * composed grid" on the way into WD-02 — which only means anything if the row
 * is showing one piece. A described piece shows its silhouette at the same
 * scale, so a words-only closet reads the same way.
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
  /**
   * The masthead's own line — "612 wears since March", "188 wears in 2026".
   * It FOLLOWS THE FILTER (`diaryTotalLine`), so an all-time figure and a
   * filtered one can never be on screen together. Null when there is nothing
   * to count, because zero is quiet.
   */
  totalLine: string | null;
  /** Empty when the record does not span a year boundary — the atlas's own rule. */
  chips: YearChip[];
  selectedChip: string;
  onSelectChip: (id: string) => void;
  /**
   * WD-03's undo notice, already composed by `undoneNotice`. Present only in
   * the render immediately after a correction lands.
   */
  undoneNotice?: string | null;
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
        {/* The count under the title, 13pt prose. `note`, not `label`: it is a
            sentence about the record, and the constitution moves prose out of
            the label cut. */}
        {props.totalLine ? (
          <Text variant="note" className="mt-2">
            {props.totalLine}
          </Text>
        ) : null}
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
        {/* WD-03's notice sits above the record it changed, not over it: the
            two figures it names are both visible on the same screen. */}
        {props.undoneNotice ? (
          <NoticeBand
            className="mx-gutter mt-4"
            cause="A wear was undone"
            title="The record has been corrected"
            body={props.undoneNotice}
          />
        ) : null}

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
      <MonthHeader label={month.label} />
      {month.entries.map((entry, i) => (
        <View key={entry.id}>
          {/* A rule ABOVE every row after the first, and — WD-03's third
              channel — one under a planned row too, separating the plan from
              the worn record beneath it. */}
          {i > 0 ? <Rule tone="hairline" className="mx-gutter" /> : null}
          <DiaryRow
            entry={entry}
            onPress={() => onOpenEntry(entry.id)}
            resolveImage={resolveImage}
          />
          {entry.planned ? <Rule className="mx-gutter" /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The month.
 *
 * 13pt REGULAR in secondary ink, not the serif `plate` cut — audit 78's
 * "filters and month headers are comprehensible without bolding". The month's
 * own total went with the bolding: it was a second figure competing with the
 * masthead's, and the masthead's is the one that follows the filter.
 */
function MonthHeader({ label }: { label: string }) {
  return (
    <View className="px-gutter pb-2.5 pt-7">
      <Text variant="note">{label}</Text>
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
  const { weekday, day } = dayCell(entry.wornAt);
  const line = rowLine(entry);
  const meta = rowMeta(entry);
  const planned = Boolean(entry.planned);

  // One element, and a planned row says so BEFORE the name — the atlas's own
  // VoiceOver line for this row.
  const label = [planned ? 'Planned, not worn yet' : null, `${weekday} ${day}`, line, meta]
    .filter(Boolean)
    .join('. ');

  /**
   * A planned row LEADS NOWHERE, and is therefore not a button.
   *
   * WD-02 is a recorded wear: a composed grid, the weather that day, the cost
   * of the look, and a 24-hour correction window. A plan has none of those —
   * it has not happened — and this atlas draws no detail screen for one. A row
   * that opened an entry page full of absent facts, or that swallowed the tap
   * silently, would both be worse than a row that is plainly a statement.
   */
  const Row = planned ? View : Pressable;

  return (
    <Row
      {...(planned
        ? { accessible: true, accessibilityLabel: label }
        : {
            onPress,
            accessibilityRole: 'button' as const,
            accessibilityLabel: label,
            accessibilityHint: 'Opens this day',
          })}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center gap-3.5 px-gutter py-3.5 ${planned ? '' : 'active:opacity-60'}`}>
      {/* The date column — 44pt, weekday label over a display-face numeral. It
          repeats within a month rather than being collapsed, because the
          reader scans down dates. */}
      <View className="items-center" style={{ width: DATE_COL }}>
        <Text variant="colophon">{weekday}</Text>
        <Text variant="plate">{day}</Text>
      </View>

      <RowWell uri={entry.pieces[0] ? resolveImage(entry.pieces[0]) : undefined} />

      {/* Everything else. The name takes two lines and WRAPS — audit 77's
          whole point — and the metadata sits under it rather than in a third
          column that was stealing the width. */}
      <View className="flex-1">
        <Text
          variant="body"
          numberOfLines={2}
          // WD-03 drew three channels between a worn day and a planned one.
          // Weight was the third and TY-01 removes it; the two that carry the
          // distinction are the word "Planned" at the head of the name and the
          // rule beneath the row, and both are still here.
          className={planned ? 'text-muted' : 'text-ink'}>
          {line}
        </Text>
        {meta ? (
          <Text variant="note" numberOfLines={2} className="mt-1">
            {meta}
          </Text>
        ) : null}
      </View>
    </Row>
  );
}

/**
 * The 56pt well. Fitted, never cropped — the same rule as every other well in
 * the app — and a silhouette at the identical scale when the piece has no
 * photograph, so a described closet reads the same way.
 */
function RowWell({ uri }: { uri: string | undefined }) {
  const theme = useTheme();

  return (
    <View
      className="items-center justify-center overflow-hidden rounded bg-tray"
      style={{ width: WELL, height: WELL, padding: 4 }}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          transition={120}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <SymbolView name="tshirt" size={20} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
      )}
    </View>
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
      <MonthHeader label={monthLabel(new Date().toISOString())} />
      {widths.map((width, i) => (
        <View key={width}>
          {i > 0 ? <Rule tone="hairline" className="mx-gutter" /> : null}
          <View className="flex-row items-center gap-3.5 px-gutter py-3.5">
            <View className="items-center gap-1.5" style={{ width: DATE_COL }}>
              <Skeleton className="h-2 w-[70%] rounded-chip" delay={i * 120} />
              <Skeleton className="h-5 w-full rounded-chip" delay={i * 120} />
            </View>
            <Skeleton
              className="rounded"
              style={{ width: WELL, height: WELL }}
              delay={i * 120}
            />
            <View className="flex-1 gap-2">
              <Skeleton className="h-3.5 rounded-chip" style={{ width }} delay={i * 120} />
              <Skeleton className="h-2.5 w-[44%] rounded-chip" delay={i * 120} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
