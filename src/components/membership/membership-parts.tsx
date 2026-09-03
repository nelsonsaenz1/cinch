import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Rule } from '@/components/ui/rule';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { deltaSpoken, type CapacityRow } from '@/features/membership/manage-membership-spec';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/**
 * The furniture of redesign 30's two membership pages.
 *
 * Same parts idiom as `settings-parts` (redesign 29) and `room-parts` before
 * it, and for the same reason: the `dev-mm-*` fixtures have to pose these
 * pages against the components the app actually mounts, and a screen that
 * draws its plates inline can only be posed by a second drawing of them. On a
 * billing surface that reason is not a convenience — a fixture built from
 * hand-typed strings keeps looking right through exactly the edits that break
 * the real page.
 *
 * ── THE STRUCTURAL CHANGE ─────────────────────────────────────────────────
 *
 * Both pages shipped as white `Card`s with a hairline ring. Every frame here
 * paints them as tinted plates with no ring — `tray` for the page's own
 * furniture, `blush` for the one plate that is an OUTCOME (something was
 * restored, something failed, a paywall was closed). That is the directive's
 * "colour becomes structural", spent on the distinction this page actually has
 * to draw: what your account holds, versus what just happened to it.
 *
 * ── NOTHING HERE CARRIES WEIGHT ───────────────────────────────────────────
 *
 * The frames set every card title and every figure in Helvetica Bold. This app
 * has one sans cut (TY-01/TY-02, `tests/type-weight.test.ts`), so emphasis is
 * spent as SIZE, COLOUR and FACE instead: card titles are `body` ink over
 * `note` muted, and figures are the serif stat cut the app already uses for
 * data. Listed as a deviation.
 */

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/**
 * A group on a warm ground.
 *
 * `overflow-hidden` because rows carry their own padding and the plate clips
 * them to the radius. Not `Card`: that component's ground is `surface` white
 * by contract at ~35 call sites, and a `fill` prop added there for one page
 * would be a new option on a shared component with one consumer.
 * `SettingsPlate` set this precedent; this is the same plate on a second page,
 * and it is deliberately a local one rather than a shared export, because the
 * two pages disagree about nothing except which tone means what.
 *
 * `rounded-plate` is 20pt where the frames measure 18. The scale in
 * `tailwind.config.js` is the documented dialect and a new radius requires an
 * entry in the shape audit; 2pt is not evidence for one. Listed as a deviation.
 */
export function MembershipPlate({
  tone = 'tray',
  children,
  className = '',
}: {
  /** `blush` is spent on outcome plates only — see the header note. */
  tone?: 'tray' | 'blush';
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`overflow-hidden rounded-plate ${tone === 'blush' ? 'bg-blush' : 'bg-tray'} ${className}`}>
      {children}
    </View>
  );
}

/**
 * `WHAT YOU HAVE` · `CHANGE` · `WHAT CHANGES` — in OXBLOOD.
 *
 * Not `SectionHeader`, and the one difference is the whole reason (the same
 * one `SettingsKicker` states): that component sets `variant="eyebrow"`, which
 * is `muted` by contract, and every frame here sets these heads in the accent.
 * `accent` on `tray` clears AA at 11px with room to spare; the eyebrow's own
 * tracking, casing and size are untouched.
 */
export function MembershipKicker({ title }: { title: string }) {
  const theme = useTheme();

  return (
    <Text variant="eyebrow" accessibilityRole="header" style={{ color: theme.accent }}>
      {title}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// The masthead
// ---------------------------------------------------------------------------

/**
 * Eyebrow, plate, colophon — the typographic masthead, kept and grown.
 *
 * `trim` collapses the serif's tall line box to the cap height, so the margins
 * around it are larger than they look on paper. The frames measure the plate
 * at 46pt; `display` (40) is the largest step the scale offers below `spread`,
 * which is rationed to the tour by its own note in `tailwind.config.js`.
 * Listed as a deviation.
 *
 * `quiet` is the read that has not landed: "Checking…" is set at the same size
 * in `muted`, so the page's shape is identical before and after the answer
 * arrives and nothing jumps when it does.
 */
export function Masthead({
  eyebrow,
  title,
  mark,
  quiet = false,
}: {
  eyebrow: string;
  title: string;
  /** The data line. Empty string draws nothing at all — never a guessed date. */
  mark?: string;
  quiet?: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      {/* The masthead eyebrow stays `muted` — the variant's own colour.
          The frames set it in clay, and clay as TYPE is below AA on paper
          (`tests/contrast.test.ts` holds the whole palette to it); the two
          levels the frames distinguish by colour are still distinguished,
          because the plate kickers below take the accent. Listed as a
          deviation. */}
      <Text variant="eyebrow">{eyebrow}</Text>
      <Text
        variant="display"
        trim
        accessibilityRole="header"
        className="mt-3"
        style={quiet ? { color: theme.muted } : undefined}>
        {title}
      </Text>
      {mark ? (
        <Text variant="colophon" className="mt-3">
          {mark}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

/** The frames' 6pt bar. */
const METER_HEIGHT = 6;

/**
 * The fill under a capacity count.
 *
 * ── WHY THIS IS NOT THE BAR THE CONSTITUTION RETIRED ──────────────────────
 *
 * "Progress is a count, never a bar or percentage" retired `ProgressTrack`,
 * and the refusal is about a bar STANDING IN for a count: an upload queue
 * whose only readout was a sliver of colour, where the honest answer was "3
 * left". Nothing is standing in here. The count is the row — "88 of 150", set
 * in the figure cut, read aloud as one composed sentence — and this is a
 * second channel under it showing the same two numbers as a proportion. No
 * percentage is drawn or spoken, and removing the meter would remove no
 * information, which is exactly the test the retired component failed.
 *
 * The fill grows to its value once, and only once, and not at all under Reduce
 * Motion — the frames state it: "the capacity fill appears at its value
 * instead of growing to it. Nothing is removed."
 */
function Meter({ fraction }: { fraction: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const grown = useSharedValue(reduced ? fraction : 0);

  // Keyed on the value, so a count that lands late (or changes on a refetch)
  // animates to the new fill rather than snapping — and under Reduce Motion it
  // is assigned rather than tweened, which is the frames' own wording.
  useEffect(() => {
    grown.value = reduced ? fraction : withTiming(fraction, { duration: motion.duration.slow });
  }, [fraction, reduced, grown]);

  const fill = useAnimatedStyle(() => ({ width: `${grown.value * 100}%` }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      className="mt-2 overflow-hidden rounded-full"
      style={{ height: METER_HEIGHT, backgroundColor: theme.sand }}>
      <Animated.View
        style={[
          { height: METER_HEIGHT, borderRadius: METER_HEIGHT / 2, backgroundColor: theme.accentWarm },
          fill,
        ]}
      />
    </View>
  );
}

/**
 * One capacity row — label, figure, meter — as a single VoiceOver node.
 *
 * The figure is the serif stat cut with tabular figures, so a four-digit Pro
 * count does not shift the column against a three-digit one. The label and the
 * figure wrap independently at larger type, the settled row's own rule.
 */
export function CapacityRowView({ row, first }: { row: CapacityRow; first: boolean }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={row.spoken}
      className={first ? '' : 'mt-4'}
      style={{ minHeight: MIN_TAP_TARGET }}>
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text variant="body">{row.label}</Text>
        <Text variant="stat" className="flex-none" style={{ fontVariant: ['tabular-nums'] }}>
          {row.value}
        </Text>
      </View>
      <Meter fraction={row.fraction} />
    </View>
  );
}

/**
 * The counts, still in flight.
 *
 * The card is drawn and the numbers are not. Omitting the whole plate would
 * reflow the page when the count lands; printing a zero would be a claim about
 * somebody's closet. Two skeleton rows in the shape the real ones take is the
 * only arrangement that is neither.
 */
export function CapacityRowsSkeleton() {
  return (
    <View accessibilityLabel="Counting your closet">
      {[0, 1].map((i) => (
        <View key={i} className={i === 0 ? '' : 'mt-4'}>
          <View className="flex-row items-center justify-between">
            <Skeleton className="h-4 w-1/3 rounded-chip" />
            <Skeleton className="h-4 w-1/5 rounded-chip" delay={120} />
          </View>
          <Skeleton
            className="mt-2 w-full rounded-full"
            style={{ height: METER_HEIGHT }}
            delay={60}
          />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The delta table
// ---------------------------------------------------------------------------

/**
 * `label · now → then`, on a blush plate.
 *
 * Lifted out of `upgrade-body` unchanged when the free comparison needed the
 * same table: one plate per paid tier, drawn from `planDelta`, against MB-09's
 * one plate drawn from `upgradeDelta`. A second copy of this markup is a
 * second place for the arrow to stop being read as words.
 *
 * Each row is ONE composed VoiceOver node. A row split into three stops makes
 * a screen-reader user assemble the comparison themselves out of fragments
 * that arrive in whatever order the layout happened to place them.
 */
export function DeltaTable({
  kicker,
  rows,
  toName,
  className = '',
}: {
  kicker: string;
  rows: readonly { label: string; from: string; to: string }[];
  /** The tier the right column is, for the spoken sentence. */
  toName: string;
  className?: string;
}) {
  const theme = useTheme();

  return (
    <MembershipPlate tone="blush" className={className}>
      <View className="px-4 pb-1 pt-4">
        <MembershipKicker title={kicker} />
      </View>
      {rows.map((row, i) => (
        <View key={row.label}>
          {i > 0 ? <Rule tone="hairline" /> : null}
          <View
            accessibilityRole="text"
            accessibilityLabel={deltaSpoken(row, toName)}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="flex-row flex-wrap items-center justify-between gap-x-3 px-4 py-3">
            <Text variant="body">{row.label}</Text>
            <View className="flex-none flex-row items-center gap-2">
              <Text variant="body" style={{ color: theme.muted }}>
                {row.from}
              </Text>
              {/* Drawn, and hidden from VoiceOver: the composed label above
                  already says "Now … On Pro, …". */}
              <Text
                variant="body"
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{ color: theme.muted }}>
                →
              </Text>
              <Text variant="body" style={{ color: theme.accent }}>
                {row.to}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </MembershipPlate>
  );
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

/**
 * A titled block of prose with an optional action under it.
 *
 * Every one of this page's non-row statements is this shape: the near-limit
 * advice, the ending truth, the three restore endings, the failed read, Pro's
 * absence. `tone="blush"` marks the ones that are about something that just
 * HAPPENED; `tray` marks the ones that are about how things are.
 *
 * `accessibilityRole="alert"` only where the block arrived in response to an
 * act the reader took — an advice card that announced itself on every page
 * load would interrupt the masthead it sits under.
 */
export function MembershipNotice({
  title,
  body,
  lines,
  tone = 'tray',
  announce = false,
  spoken,
  action,
  onAction,
  className = '',
}: {
  title: string;
  body?: string;
  /** For the ending truth, which is two paragraphs rather than one. */
  lines?: readonly string[];
  tone?: 'tray' | 'blush';
  announce?: boolean;
  /**
   * Said instead of the drawn text.
   *
   * One caller: the ending-truth block, which stands in for a page-level note
   * whose full traced paragraph (`cancellationConsequence`) must still reach a
   * screen reader verbatim. The rule this program has held is that prose a
   * redesign removes becomes a label — this is the hook for it.
   */
  spoken?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  const paragraphs = lines ?? (body ? [body] : []);

  return (
    <View className={className}>
      <MembershipPlate tone={tone}>
        <View
          accessibilityRole={announce ? 'alert' : 'text'}
          accessibilityLabel={spoken ?? [title, ...paragraphs].join(' ')}
          className="px-4 py-4">
          <Text variant="body">{title}</Text>
          {paragraphs.map((line, i) => (
            <Text key={line} variant="note" className={i === 0 ? 'mt-1.5' : 'mt-3'}>
              {line}
            </Text>
          ))}
        </View>
      </MembershipPlate>
      {action && onAction ? (
        <TintedAction label={action} onPress={onAction} className="mt-2.5" />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** The frames' 56pt filled CTA, and the secondary that sits under it. */
const CTA_MIN_HEIGHT = 56;

/**
 * The tinted secondary — a blush ground with an oxblood label.
 *
 * The directive's own words: "Secondary actions become tinted fills
 * (blush/sand) rather than hairline ghosts." `Button variant="secondary"` is a
 * hairline outline by contract at ~86 call sites, and changing it would repaint
 * the app from a page brief. `plan-week-body`'s `Action` set exactly this
 * precedent — same two colours, same reasoning — and this is that control on
 * this page.
 *
 * `haptics.selection()` comes free from `PressableSurface`'s intent, which
 * also declines to fire it while the control is busy: a tick before an action
 * the press may not take is a promise nobody made.
 */
export function TintedAction({
  label,
  onPress,
  busy = false,
  className = '',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  className?: string;
}) {
  const theme = useTheme();

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      busy={busy}
      haptic="selection"
      onPress={onPress}
      className={className}
      style={{ borderRadius: 12, backgroundColor: theme.blush }}
      contentStyle={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: CTA_MIN_HEIGHT,
        paddingHorizontal: 20,
        paddingVertical: 14,
      }}>
      <Text variant="body" numberOfLines={2} style={{ color: theme.accent, textAlign: 'center' }}>
        {label}
      </Text>
    </PressableSurface>
  );
}
