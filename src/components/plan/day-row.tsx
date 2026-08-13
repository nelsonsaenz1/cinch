import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { describeWeather, formatTemp } from '@/features/context/weather';
import { type PlannedDay } from '@/features/plan/packing';
import { explain, type Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

const LAYOUT_ORDER: Garment['slot'][] = [
 'outerwear', 'mid_layer', 'base_top', 'dress', 'bottom', 'footwear', 'bag', 'accessory', 'headwear',
];

/**
 * The image column, and where the type's width comes from.
 *
 * Audit 80 in arithmetic: three garments at 44×52 with 5pt between them is a
 * 142pt column, and the type takes the 191pt that is left of a 393pt frame at
 * the app's own page measure. The two never contend for the same space, which
 * is the whole complaint — a colour square 16pt wide sitting inside the text
 * column was competing with the sentence it was supposed to illustrate.
 */
const THUMB_W = 44;
const THUMB_H = 52;
const IMAGE_COL = THUMB_W * 3 + 10;

/**
 * "THU 7 · 72° · 60% RAIN" — the whole date-and-weather line, uppercased by the
 * type variant rather than here.
 *
 * ONE label, not two lines and not a stack. Audit 79's fix gives both type
 * lines to the outfit, so everything the day itself knows has to compress into
 * this one 11pt line: the weekday, the date, the temperature and the reason.
 *
 * The weather phrase is `describeWeather` — the same sentence the Today strip
 * and the memo print. There is no separate "condition" field anywhere in the
 * forecast (precipitation, wind and apparent temperature are all it returns),
 * so the atlas's "clear" is a word a mock can write and the app cannot: it
 * prints the phrase the data actually supports, and prints nothing at all when
 * no forecast reached the day rather than borrowing another day's.
 */
export function dayHeadLabel(
  day: PlannedDay,
  units: 'C' | 'F',
  occasion?: string | null,
  /**
   * INJECTED, never read from the clock inside here. `packing.ts`'s `dayLabel`
   * defaults to `new Date()`, which makes every frame that renders it change
   * overnight; a fixture route passes its own frozen day so the capture can be
   * diffed against itself.
   */
  today: Date = new Date(),
): string {
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const when = sameDay(day.date, today)
    ? 'Today'
    : sameDay(day.date, tomorrow)
      ? 'Tomorrow'
      : `${day.date.toLocaleDateString('en-GB', { weekday: 'short' })} ${day.date.getDate()}`;

  return [
    when,
    day.weather ? formatTemp(day.weather.feelsLikeC, units) : null,
    day.weather ? describeWeather(day.weather, units) : null,
    occasion?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * "Merino crewneck and the black jeans" — the outfit's first line.
 *
 * The week planner does not NAME its outfits: the editorial name on the Today
 * plate is generated per-day by the model, and seven of them is seven model
 * calls for a screen the user scrolls past. The atlas's own PL-01 rows are
 * mostly piece lists anyway ("Overshirt, trousers, boots"), so the pieces stand
 * in for a name and are joined the way the atlas joins them: two read as a
 * pair, three or more as a list.
 *
 * Capitalised to the approved register, matching the Today plate's `labelFor` —
 * lowercase reads as debug output.
 */
export function outfitLine(pieces: readonly Garment[]): string {
  const names = pieces.map((g) => {
    const s = g.subcategory ?? g.category;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and the ${names[1]!.toLowerCase()}`;
  return names.join(', ');
}

/**
 * One day of the week — PL-01, PL-02 and PL-03's three cuts.
 *
 * ── What changed for audit 79 and 80 ──────────────────────────────────────
 *
 * · The outfit's name and its reasoning each get their OWN line and both WRAP.
 *   Neither is truncated to one line, which is the whole of audit 79: a plan
 *   described by half a sentence is a plan nobody can judge.
 * · Colour squares are gone. Three owned photographs at 44×52 stand for the
 *   outfit's core, with a silhouette in the same slot when a piece has no
 *   picture — so a described closet loses no legibility (audit 80).
 * · NOTHING ON THE ROW IMPLIES THE OUTFIT WAS WORN. The filled oxblood
 *   checkmark that used to mark a committed day is gone; a plan that has been
 *   kept says so in a WORD at the end of its own date label, which is the
 *   group's own second-channel rule — "a planned diary row carries a word, a
 *   weight change and a rule", never a mark on its own. A tick next to an
 *   outfit reads as done, and a plan is not done.
 * · The busy state is a word too. The spinner is gone: an `ActivityIndicator`
 *   inside a captured viewport is a frame that can never be diffed, and
 *   "Saving…" in the label says more than a rotating arc.
 */
export function DayRow({
  day,
  resolveImage,
  onPlan,
  planned,
  planning,
  isLast,
  units = 'F',
  occasion,
  today,
}: {
  day: PlannedDay;
  resolveImage: (...paths: (string | null | undefined)[]) => string | undefined;
  onPlan?: () => void;
  planned?: boolean;
  planning?: boolean;
  /** Suppresses the row's bottom hairline for the last row in a list. */
  isLast?: boolean;
  units?: 'C' | 'F';
  /**
   * A Cinch occasion falling on this day — "Sarah's birthday dinner, 8pm".
   *
   * CINCH'S OWN OCCASION, never the device calendar. `loadTodaysEvents` reads
   * EventKit for TODAY only, so a device-calendar title for Friday is not a
   * fact this app holds; `useMyEvents` is already read on the Plan screen and
   * covers every day of the week.
   */
  occasion?: string | null;
  /** The frozen "today" a fixture route injects. See `dayHeadLabel`. */
  today?: Date;
}) {
  const theme = useTheme();
  const pieces = [...(day.outfit?.items ?? [])].sort(
    (a, b) => LAYOUT_ORDER.indexOf(a.slot) - LAYOUT_ORDER.indexOf(b.slot),
  );

  // The three garments the image column stands for — the outfit's core, read
  // in layout order so it is top, bottom, shoe rather than whatever was first.
  const shown = pieces.slice(0, 3);

  const head = dayHeadLabel(day, units, occasion, today);
  const name = outfitLine(pieces);
  const reasoning = day.outfit ? explain(day.outfit) : null;

  const state = planning ? 'Saving…' : planned ? 'Kept' : null;

  const a11yLabel = [
    head,
    day.outfit ? name : 'Nothing in your closet works for this day’s weather yet.',
    reasoning,
    state,
    onPlan && !planned ? 'Keep this plan' : null,
  ]
    .filter(Boolean)
    .join('. ');

  // `rule`, not `hairline`: the atlas separates day rows at the card-border
  // weight (ink at 12%), keeping the whisper hairline for the tab bar above
  // the home indicator. py is the atlas's exact 18.
  const containerClassName = [
 'flex-row items-start gap-3.5 px-gutter py-[18px]',
    isLast ? '' : 'border-b border-rule',
    onPlan ? 'active:opacity-60' : '',
  ].join(' ');

  const rowContent = (
    <>
      {shown.length ? (
        <View className="flex-row" style={{ width: IMAGE_COL, gap: 5 }}>
          {shown.map((g) => (
            <GarmentThumb key={g.id} uri={resolveImage(g.cutoutPath, g.thumbPath)} />
          ))}
        </View>
      ) : null}

      <View className="flex-1">
        {/* The date, the weather and the occasion, in one uppercase label.
            Where a Cinch occasion exists it JOINS this label rather than
            opening a second line — nothing on the row changes shape because a
            dinner exists. */}
        <Text variant="colophon">{head}</Text>

        {day.outfit ? (
          <>
            {/* Two lines each, and both WRAP. `numberOfLines` is a ceiling on
                a wrap, not a truncation to one line. */}
            <Text variant="body" numberOfLines={2} className="mt-1.5">
              {name}
            </Text>
            {reasoning ? (
              <Text variant="note" numberOfLines={2} className="mt-1">
                {reasoning}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="note" className="mt-1.5">
            Nothing in your closet works for this day&rsquo;s weather yet.
          </Text>
        )}

        {/* The committed state, said in a word. Oxblood text, no fill, no
            glyph — the row's one accent when there is one at all. */}
        {state ? (
          <Text variant="label" className="mt-1.5" style={{ color: theme.accent }}>
            {state}
          </Text>
        ) : null}
      </View>
    </>
  );

  return onPlan ? (
    <Pressable
      onPress={onPlan}
      disabled={planning}
      accessibilityRole="button"
      accessibilityState={{ disabled: planning, selected: Boolean(planned) }}
      accessibilityLabel={a11yLabel}
      className={containerClassName}>
      {rowContent}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={a11yLabel} className={containerClassName}>
      {rowContent}
    </View>
  );
}

/** Fitted, never cropped, with the silhouette at the identical size. */
function GarmentThumb({ uri }: { uri: string | undefined }) {
  const theme = useTheme();

  return (
    <View
      className="items-center justify-center overflow-hidden rounded bg-tray"
      style={{ width: THUMB_W, height: THUMB_H, padding: 3 }}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          transition={120}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <SymbolView name="tshirt" size={16} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
      )}
    </View>
  );
}

/**
 * PL-03's building day — the skeleton MIRRORS THE DAY ROW EXACTLY.
 *
 * The date label is kept, because the day's own date is a fact the device
 * already has and blanking it would be pretending not to know it. Placeholders
 * sit in the exact geometry the plan will occupy, so nothing moves when it
 * lands. No shimmer and no spinner: this frame has to be capturable.
 */
export function DayRowBuilding({
  day,
  isLast,
  units = 'F',
  today,
}: {
  day: PlannedDay;
  isLast?: boolean;
  units?: 'C' | 'F';
  today?: Date;
}) {
  const head = dayHeadLabel(day, units, null, today);
  return (
    <View
      accessibilityLabel={`${head}. Being planned.`}
      className={[
 'flex-row items-start gap-3.5 px-gutter py-[18px]',
        isLast ? '' : 'border-b border-rule',
      ].join(' ')}>
      <View className="flex-row" style={{ width: IMAGE_COL, gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="rounded bg-tray"
            style={{ width: THUMB_W, height: THUMB_H }}
          />
        ))}
      </View>
      <View className="flex-1">
        <Text variant="colophon">{head}</Text>
        <View className="mt-2 h-3.5 rounded-sm bg-tray" style={{ maxWidth: 176 }} />
        <View className="mt-2 h-2.5 rounded-sm bg-tray" style={{ maxWidth: 140 }} />
      </View>
    </View>
  );
}

/**
 * PL-03's unplanned day — it says so in words, and offers the one action that
 * fills it.
 *
 * Not an empty card and not a dashed outline: both of those are a shape
 * pretending to be content. The row keeps its date label and its image column's
 * width, so the week's rhythm does not break around it.
 */
export function DayRowUnplanned({
  day,
  onPlan,
  planning,
  isLast,
  units = 'F',
  occasion,
  today,
}: {
  day: PlannedDay;
  onPlan: () => void;
  planning?: boolean;
  isLast?: boolean;
  units?: 'C' | 'F';
  occasion?: string | null;
  today?: Date;
}) {
  const theme = useTheme();
  const head = dayHeadLabel(day, units, occasion, today);

  return (
    <View
      className={[
 'flex-row items-start gap-3.5 px-gutter py-[18px]',
        isLast ? '' : 'border-b border-rule',
      ].join(' ')}>
      <View style={{ width: IMAGE_COL }} />
      <View className="flex-1">
        <Text variant="colophon">{head}</Text>
        <Text variant="body" className="mt-1.5">
          Nothing planned
        </Text>
        <Pressable
          onPress={onPlan}
          disabled={planning}
          accessibilityRole="button"
          accessibilityLabel={`Plan ${head}`}
          accessibilityState={{ disabled: Boolean(planning) }}
          hitSlop={10}
          style={{ minHeight: 44 }}
          className="justify-center active:opacity-60">
          <Text variant="label" style={{ color: theme.accent }}>
            {planning ? 'Planning…' : 'Plan this day'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
