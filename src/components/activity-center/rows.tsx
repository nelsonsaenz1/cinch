import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Avatar } from '@/components/ui/avatar';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  INVITE_ACCEPT,
  INVITE_DECLINE,
  OPEN_HINT,
  ROW_REMOVE,
} from '@/features/activity-center/copy';
import type { ActivityEntry } from '@/features/activity-center/grouping';
import type { ActivityActionId, ActivityLine } from '@/features/activity-center/sentence';
import { haptics } from '@/lib/haptics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { CircleMark, UnreadDot } from './glyphs';

/**
 * AC-02's row anatomy, and AC-08's collapsed summary.
 *
 * In order, left to right: an 8pt presence gutter, the 36pt mark, the sentence
 * with its subtitle and any inline actions, and the trailing stamp. AC-09 turns
 * that horizontal arrangement into a vertical one at accessibility type sizes —
 * nothing is removed and nothing is capped, only the arrangement changes, which
 * is the one thing the accessibility contract allows.
 *
 * ── EMPHASIS IS CARRIED BY COLOUR, NOT WEIGHT ─────────────────────────────
 *
 * The atlas draws the actor's name and the group's name in semibold. This
 * repository removed weight from the product (TY-01) and
 * `components/activity/ActivityRow.tsx` already re-expresses the same emphasis
 * as ink-against-muted for the AV rows. These rows sit in the SAME LIST as
 * those, so they follow it: two dialects of emphasis interleaved down one page
 * would be far more visible than either choice on its own. It also survives at
 * every Dynamic Type size, which a weight difference at 14pt barely does.
 *
 * ── THE WHOLE ROW IS THE TAP TARGET ───────────────────────────────────────
 *
 * One `Pressable`, one composed `accessibilityLabel`, one hint — §11's "each row
 * is one element". The inline Accept/Decline are separate accessible elements
 * inside it, which VoiceOver surfaces as its own actions, so no gesture is
 * required to reach either.
 */

const MARK = 36;

// ---------------------------------------------------------------------------
// The 34pt control
// ---------------------------------------------------------------------------

/**
 * The atlas's 34pt inline action.
 *
 * Not the shared `Button`: that pill is fixed at a 44pt floor, a 12pt radius and
 * a 17px label, and an inline invitation row draws two of them under a sentence
 * at 34/9/13. This is the same local composition `components/activity/
 * ActivityRow.tsx` already ships for the AV rows — press feedback, haptics and
 * the 44pt hit target (via `hitSlop`) match `Button` exactly, and at AX sizes it
 * becomes full-width and stacked rather than clipping.
 *
 * SOLID MEANS INK, NEVER OXBLOOD, in the timeline. A page of rows each spending
 * the accent on its affirmative is precisely how the one-accent-per-screen rule
 * dies; the accent on this page belongs to the presence dot and to a failure.
 * AC-03's detail screen is the exception and says why in its own file: it is one
 * screen with one decision on it.
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
      hitSlop={(MIN_TAP_TARGET - 34) / 2}
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
            // At AX sizes the control grows to hold a wrapped label rather than
            // clipping it, and stretches to the row's width so two of them stack
            // as full-width blocks — AC-09's own drawing.
            minHeight: stacked ? MIN_TAP_TARGET : 34,
            borderRadius: 9,
            paddingHorizontal: solid ? 14 : 2,
            paddingVertical: stacked ? 10 : 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          solid ? { backgroundColor: theme.ink } : null,
        ]}>
        <Text
          variant={solid ? 'body' : 'note'}
          style={{ fontSize: 13, lineHeight: 17, color: solid ? theme.canvas : theme.ink }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** The disclosure chevron on a collapsed group. Rotates a quarter turn when open. */
function Chevron({ open }: { open: boolean }) {
  const theme = useTheme();

  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 22 22"
      fill="none"
      style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <Path
        d="M8.5 4.5 15 11l-6.5 6.5"
        stroke={theme.muted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Edit mode's per-row Remove.
 *
 * §11's gesture rule, made visible: swipe-to-dismiss and long-press each need an
 * equivalent that can be reached without a gesture, and this is it. It is a
 * WORD rather than a minus-in-a-circle, because a glyph here would be the one
 * destructive control on the page identified by shape alone.
 */
function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.commit();
        onPress();
      }}
      hitSlop={10}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
      className="active:opacity-60">
      <Text variant="note" style={{ fontSize: 13, color: theme.accent }}>
        {ROW_REMOVE}
      </Text>
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
  /** Fires with the row's own href. Absent on a row with nowhere to go. */
  onOpen?: () => void;
  /** Fires for the inline Accept/Decline on a live invitation. */
  onAction?: (action: ActivityActionId) => void;
  /** True while an Accept or Decline is in flight — both controls go inert. */
  pending?: boolean;
  /** Edit mode. Reveals Remove and suppresses navigation. */
  editing?: boolean;
  onRemove?: () => void;
  isLast?: boolean;
};

export function ActivityCenterRow({
  line,
  avatarUri,
  onOpen,
  onAction,
  pending = false,
  editing = false,
  onRemove,
  isLast = false,
}: ActivityCenterRowProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= AX_FONT_SCALE;

  const unread = line.event.seenAt === null && !line.event.revokedAt;
  const openable = Boolean(onOpen && line.href) && !editing;

  const body = (
    <View
      className={stacked ? '' : 'flex-row items-start gap-3'}
      style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
      {/* The presence gutter. It holds its 8pt whether or not there is a dot in
          it, so nothing on the row shifts sideways when a row is read. */}
      <View
        className={stacked ? 'flex-row items-center gap-3' : 'flex-row items-start gap-3'}
        style={stacked ? { marginBottom: 10 } : undefined}>
        <View style={{ width: 8, paddingTop: stacked ? 0 : 14 }}>{unread ? <UnreadDot /> : null}</View>

        {line.mark.kind === 'person' ? (
          <Avatar name={line.mark.name} size={MARK} imageUri={avatarUri ?? null} />
        ) : (
          <CircleMark />
        )}

        {/* At AX sizes the stamp joins the mark on its own line rather than
            competing with a 27pt sentence for the right-hand edge. */}
        {stacked && line.stamp ? (
          <Text variant="note" style={{ fontSize: 13 }}>
            {line.stamp}
          </Text>
        ) : null}
      </View>

      <View className={stacked ? '' : 'flex-1'} style={{ minWidth: 0 }}>
        {/* One `Text` with nested runs, not a row of them: the names have to
            wrap with the rest of the sentence, and a flex row of words breaks in
            the wrong places and loses the spaces between them. */}
        <Text variant="body" style={{ fontSize: 15, lineHeight: 21 }}>
          {line.segments.map((segment, i) => (
            <Text
              key={i}
              variant="body"
              className={segment.bold ? 'text-ink' : 'text-muted'}
              style={{ fontSize: 15, lineHeight: 21 }}>
              {segment.text}
            </Text>
          ))}
        </Text>

        {line.subtitle ? (
          <Text variant="note" style={{ marginTop: 3, fontSize: 13 }}>
            {line.subtitle}
          </Text>
        ) : null}

        {editing && onRemove ? (
          <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
            <RemoveButton onPress={onRemove} label={`${ROW_REMOVE} — ${line.spoken}`} />
          </View>
        ) : line.actions.length > 0 && onAction ? (
          <View
            className={stacked ? '' : 'flex-row gap-2'}
            style={{ marginTop: 8, gap: stacked ? 10 : undefined }}>
            {line.actions.map((action) => (
              <InlineAction
                key={action}
                label={action === 'accept' ? INVITE_ACCEPT : INVITE_DECLINE}
                solid={action === 'accept'}
                stacked={stacked}
                disabled={pending}
                onPress={() => onAction(action)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {!stacked && line.stamp ? (
        <Text variant="note" style={{ fontSize: 13, paddingTop: 2 }}>
          {line.stamp}
        </Text>
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
          // The tinted ground AC-02 draws behind an unread row. A second,
          // non-colour channel for the same fact, which is what makes the tint
          // safe to use at all.
          style={unread ? { backgroundColor: theme.tray } : undefined}
          className="active:opacity-70">
          {body}
        </Pressable>
      ) : (
        <View
          accessible
          accessibilityLabel={line.label}
          style={unread ? { backgroundColor: theme.tray } : undefined}>
          {body}
        </View>
      )}
      {isLast ? null : <Rule tone="hairline" />}
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
 * them would spend a navigation on the cheapest content in the inbox. Expanding
 * also means the summary stays visible above what it summarises, so the reader
 * can see what they opened.
 *
 * The chevron is `accessibilityState.expanded`, and the whole header is one
 * button, so VoiceOver announces "expanded"/"collapsed" without a gesture.
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
  const [open, setOpen] = useState(false);
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= AX_FONT_SCALE;

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
          className={stacked ? '' : 'flex-row items-center gap-3'}
          style={{ paddingVertical: 12, paddingHorizontal: 16, minHeight: MIN_TAP_TARGET }}>
          <View className="flex-row items-center gap-3" style={stacked ? { marginBottom: 8 } : undefined}>
            {/* The gutter is held empty: a collapsed run is never unread,
                because `sectionOf` files unseen rows into `New` and only the
                oldest section collapses. */}
            <View style={{ width: 8 }} />
            <CircleMark />
            {stacked ? <Chevron open={open} /> : null}
          </View>

          <View className={stacked ? '' : 'flex-1'} style={{ minWidth: 0 }}>
            <Text variant="body" className="text-ink" style={{ fontSize: 15, lineHeight: 21 }}>
              {entry.title}
            </Text>
            {entry.subtitle ? (
              <Text variant="note" style={{ marginTop: 3, fontSize: 13 }}>
                {entry.subtitle}
              </Text>
            ) : null}
          </View>

          {stacked ? null : <Chevron open={open} />}
        </View>
      </Pressable>

      {open
        ? entry.lines.map((line, i) => (
            <View key={line.key} style={{ paddingLeft: 16 }}>
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

      {isLast ? null : <Rule tone="hairline" />}
    </View>
  );
}
