import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  dotOffset,
  META_GAP,
  META_LEADING,
  META_SIZE,
  ROW_GAP,
  ROW_PAD_Y,
  rowMetrics,
  UNSEEN_DOT,
} from '@/features/activity-center/activity-spec';
import {
  INVITE_ACCEPT,
  INVITE_DECLINE,
  OPEN_HINT,
  SECTION_HIDE,
  SECTION_SHOW,
} from '@/features/activity-center/copy';
import type { ActivityEntry } from '@/features/activity-center/grouping';
import type { ActivityActionId, ActivityLine } from '@/features/activity-center/sentence';
import { haptics } from '@/lib/haptics';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { ActivityRemoveDisc, removeLabel } from './activity-parts';
import { CircleMark, UnreadDot } from './glyphs';

/**
 * REDESIGN 28's row — a face, one written sentence, the day, and a warm dot.
 *
 * That list is the page brief verbatim, and it is also the whole anatomy. In
 * order, leading to trailing: the 44pt mark, the sentence with the day beneath
 * it, and the unseen dot at the trailing edge. Nothing else is on a row.
 *
 * ── WHAT CAME OFF THE ROW ─────────────────────────────────────────────────
 *
 * · The 8pt LEADING PRESENCE GUTTER, held open on every row so that reading one
 *   did not shift it sideways. The dot moved to the trailing column, which the
 *   stamp vacated, so no gutter has to be reserved for it.
 * · The TRAILING STAMP. It needed a one-line sentence to stay level with, and
 *   most sentences here are two. The day sits under the sentence — where the
 *   legacy half of this same list already put it — and reads as the second line
 *   of the row rather than as a column in a table.
 * · The TINTED GROUND behind an unread row. The frames have none, and it was
 *   never the carrier of the state: "New" is a WORD at the head of the row's
 *   composed accessibility label, which is what actually satisfies the
 *   colour-independence rule.
 * · The AX VERTICAL RECOMPOSITION. `activity-list-ax-xxxl` holds the same
 *   arrangement at accessibility size — the sentence simply wraps further and
 *   the row grows. The recomposition existed to get a trailing stamp out of a
 *   27pt sentence's way, and there is no trailing stamp now. See `rowMetrics`.
 *
 * ── EMPHASIS IS CARRIED BY COLOUR, NOT WEIGHT ─────────────────────────────
 *
 * The frames set the actor's name and the group's name in semibold. This
 * repository removed weight from the product (TY-01, held by
 * `tests/type-weight.test.ts`) and expresses the same emphasis as ink-against-
 * muted. That is unchanged here, and it is not a matter of taste on this
 * surface: these rows sit in the SAME LIST as the legacy ones, which have
 * always drawn emphasis that way, and two dialects of emphasis interleaved down
 * one page would be far more visible than either choice on its own.
 *
 * ── THE WHOLE ROW IS THE TAP TARGET ───────────────────────────────────────
 *
 * One `Pressable`, one composed `accessibilityLabel`, one hint — §11's "each row
 * is one element". The inline Accept/Decline are separate accessible elements
 * inside it, which VoiceOver surfaces as its own actions, so no gesture is
 * required to reach either.
 */

// ---------------------------------------------------------------------------
// The inline control
// ---------------------------------------------------------------------------

/**
 * The invitation's Accept / Decline, at the 44pt floor.
 *
 * Not the shared `Button`: that pill is fixed at a 17px label and a 12pt
 * radius, and an inline invitation row draws two of them under a 15.5pt
 * sentence. Grown from the 34pt the surface shipped to the artifact's "in-row
 * pills 44pt minimum", which also retires the `hitSlop` that used to make up the
 * difference — a control whose visual size is its touch target cannot drift out
 * of compliance when somebody edits its padding.
 *
 * SOLID MEANS INK, NEVER OXBLOOD, in the timeline. A page of rows each spending
 * the accent on its affirmative is precisely how one-accent-per-screen dies; the
 * accent on this page belongs to the unseen dot, the section eyebrows and a
 * failure. AC-03's detail screen is the exception and says why in its own file.
 */
function InlineAction({
  label,
  solid,
  stacked,
  disabled = false,
  onPress,
}: {
  label: string;
  solid: boolean;
  stacked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={stacked ? { alignSelf: 'stretch' } : undefined}
      className={disabled ? 'opacity-40' : ''}>
      <Animated.View
        style={[
          press.style,
          {
            // At AX sizes the pair stretches to the row's width and stacks, so
            // a wrapped label grows the control rather than clipping inside it.
            minHeight: MIN_TAP_TARGET,
            borderRadius: 12,
            paddingHorizontal: solid ? 18 : 6,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          solid ? { backgroundColor: theme.ink } : null,
        ]}>
        <Text
          variant={solid ? 'body' : 'note'}
          style={{ fontSize: 15, lineHeight: 20, color: solid ? theme.canvas : theme.ink }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

export type ActivityCenterRowProps = {
  line: ActivityLine;
  /** The actor's photograph, when the reader is related to them. Initials otherwise. */
  avatarUri?: string | null;
  /**
   * Whether the row draws the warm dot.
   *
   * Passed IN rather than derived from `line.event.seenAt`, so that both halves
   * of the merged list answer to the same authority: the section a row landed
   * in. `sectionOf` already decides unseen for these rows and `legacySection`
   * decides it for the other kind, and a row drawing a dot its section
   * disagreed with is the one way "New" could stop meaning what the heading
   * above it says.
   */
  unseen?: boolean;
  /** Fires with the row's own href. Absent on a row with nowhere to go. */
  onOpen?: () => void;
  /** Fires for the inline Accept/Decline on a live invitation. */
  onAction?: (action: ActivityActionId) => void;
  /** True while an Accept or Decline is in flight — both controls go inert. */
  pending?: boolean;
  /** Edit mode. Reveals the Remove disc and suppresses navigation. */
  editing?: boolean;
  onRemove?: () => void;
  isLast?: boolean;
};

export function ActivityCenterRow({
  line,
  avatarUri,
  unseen = false,
  onOpen,
  onAction,
  pending = false,
  editing = false,
  onRemove,
  isLast = false,
}: ActivityCenterRowProps) {
  const { fontScale } = useWindowDimensions();
  const metrics = rowMetrics(fontScale);

  const openable = Boolean(onOpen && line.href) && !editing;
  // The day, and in Edit mode nothing: `edit-mode-visible-row-removal` drops
  // every stamp, because the question in that mode is which row to remove and
  // the age of a notice is not part of it.
  const meta = editing ? null : line.stamp;

  const body = (
    <View
      className="flex-row items-start"
      style={{ paddingVertical: ROW_PAD_Y, paddingHorizontal: GUTTER, gap: ROW_GAP }}>
      {editing && onRemove ? (
        <View style={{ paddingTop: (metrics.avatar - 28) / 2 }}>
          <ActivityRemoveDisc onPress={onRemove} label={removeLabel(line.spoken)} />
        </View>
      ) : null}

      {line.mark.kind === 'person' ? (
        <Avatar name={line.mark.name} size={metrics.avatar} imageUri={avatarUri ?? null} />
      ) : (
        <CircleMark size={metrics.avatar} />
      )}

      <View className="flex-1" style={{ minWidth: 0 }}>
        {/* One `Text` with nested runs, not a row of them: the names have to
            wrap with the rest of the sentence, and a flex row of words breaks in
            the wrong places and loses the spaces between them. */}
        <Text variant="body" style={{ fontSize: metrics.size, lineHeight: metrics.leading }}>
          {line.segments.map((segment, i) => (
            <Text
              key={i}
              variant="body"
              className={segment.bold ? 'text-ink' : 'text-muted'}
              style={{ fontSize: metrics.size, lineHeight: metrics.leading }}>
              {segment.text}
            </Text>
          ))}
        </Text>

        {line.subtitle && !editing ? (
          <Text
            variant="note"
            style={{ marginTop: META_GAP, fontSize: META_SIZE, lineHeight: META_LEADING }}>
            {line.subtitle}
          </Text>
        ) : null}

        {meta ? (
          <Text
            variant="note"
            style={{ marginTop: META_GAP, fontSize: META_SIZE, lineHeight: META_LEADING }}>
            {meta}
          </Text>
        ) : null}

        {!editing && line.actions.length > 0 && onAction ? (
          <View
            className={metrics.stacksActions ? '' : 'flex-row'}
            style={{ marginTop: 10, gap: 8 }}>
            {line.actions.map((action) => (
              <InlineAction
                key={action}
                label={action === 'accept' ? INVITE_ACCEPT : INVITE_DECLINE}
                solid={action === 'accept'}
                stacked={metrics.stacksActions}
                disabled={pending}
                onPress={() => onAction(action)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* The trailing column. It holds the dot on the sentence's FIRST LINE, so
          a two-line sentence never drags it down the row. */}
      {unseen ? (
        <View style={{ width: UNSEEN_DOT, paddingTop: dotOffset(metrics.leading) }}>
          <UnreadDot />
        </View>
      ) : null}
    </View>
  );

  return (
    <View>
      {openable ? (
        <Pressable
          accessibilityRole="button"
          // §11 — one element, one composed label, one hint. The label already
          // carries "unread" as a WORD, so the dot is never the only carrier.
          accessibilityLabel={line.label}
          accessibilityHint={OPEN_HINT}
          onPress={onOpen}
          className="active:opacity-70">
          {body}
        </Pressable>
      ) : (
        <View accessible={!editing} accessibilityLabel={editing ? undefined : line.label}>
          {body}
        </View>
      )}
      {isLast ? null : (
        <View className="px-gutter">
          <Rule tone="hairline" />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AC-08's collapsed summary
// ---------------------------------------------------------------------------

/**
 * A run of old, interchangeable rows, standing in one line.
 *
 * EXPANDS IN PLACE rather than pushing to a screen of its own. The rows it
 * stands for are the least consequential things on the page — arrivals and
 * reactions from three weeks ago — and sending somebody to a new screen to read
 * them would spend a navigation on the cheapest content in the inbox.
 *
 * REDESIGN 28 replaced the chevron with the WORD, for the same reason the
 * oldest section's heading carries one: `activity-list-older-month-collapsed`
 * draws `Show`, and a word states the affordance where a rotating glyph asks
 * the reader to infer it. The header is still one button with
 * `accessibilityState.expanded`, so VoiceOver announces the state either way.
 */
export function ActivityGroupRow({
  entry,
  avatarFor,
  editing = false,
  onOpenLine,
  onRemoveLine,
  isLast = false,
}: {
  entry: Extract<ActivityEntry, { kind: 'group' }>;
  /** Actor id → photograph, for the expanded rows. */
  avatarFor?: (line: ActivityLine) => string | null;
  editing?: boolean;
  onOpenLine?: (line: ActivityLine) => void;
  onRemoveLine?: (line: ActivityLine) => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { fontScale } = useWindowDimensions();
  const metrics = rowMetrics(fontScale);
  const word = open ? SECTION_HIDE : SECTION_SHOW;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}. ${entry.subtitle}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? 'Double-tap to collapse' : 'Double-tap to expand'}
        onPress={() => {
          haptics.selection();
          setOpen((was) => !was);
        }}
        className="active:opacity-70">
        <View
          className="flex-row items-center"
          style={{
            paddingVertical: ROW_PAD_Y,
            paddingHorizontal: GUTTER,
            gap: ROW_GAP,
            minHeight: MIN_TAP_TARGET,
          }}>
          {/* The gutter is never unread here: `sectionOf` files unseen rows
              into `New` and only the oldest section collapses. */}
          <CircleMark size={metrics.avatar} />

          <View className="flex-1" style={{ minWidth: 0 }}>
            <Text
              variant="body"
              className="text-ink"
              style={{ fontSize: metrics.size, lineHeight: metrics.leading }}>
              {entry.title}
            </Text>
            {entry.subtitle ? (
              <Text
                variant="note"
                style={{ marginTop: META_GAP, fontSize: META_SIZE, lineHeight: META_LEADING }}>
                {entry.subtitle}
              </Text>
            ) : null}
          </View>

          <Text style={{ fontSize: 17, color: theme.accent }}>{word}</Text>
        </View>
      </Pressable>

      {open
        ? entry.lines.map((line, i) => (
            <View key={line.key} style={{ paddingLeft: GUTTER }}>
              <ActivityCenterRow
                line={line}
                avatarUri={avatarFor?.(line) ?? null}
                editing={editing}
                onOpen={onOpenLine ? () => onOpenLine(line) : undefined}
                onRemove={onRemoveLine ? () => onRemoveLine(line) : undefined}
                isLast={i === entry.lines.length - 1}
              />
            </View>
          ))
        : null}

      {isLast ? null : (
        <View className="px-gutter">
          <Rule tone="hairline" />
        </View>
      )}
    </View>
  );
}
