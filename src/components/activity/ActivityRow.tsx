import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { UnreadDot } from '@/components/activity-center/glyphs';
import { Avatar } from '@/components/ui/avatar';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import type { AnswerState } from '@/features/activity/answers';
import {
  ANSWER_RETRY,
  ANSWER_UNDO,
  answerCopy,
  isUndoable,
  type ActivityAction,
  type ActivityActionId,
  type ActivityLine,
} from '@/features/activity/sentence';
import {
  dotOffset,
  META_GAP,
  META_LEADING,
  META_SIZE,
  ROW_AVATAR,
  ROW_GAP,
  ROW_PAD_Y,
  SENTENCE_LEADING,
  SENTENCE_SIZE,
  UNSEEN_DOT,
} from '@/features/activity-center/activity-spec';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { ActivityGlyphMark } from './glyphs';

/**
 * One row of the Activity page — the atlas's row anatomy, in order: the mark,
 * the sentence, the elapsed label under it, the answer.
 *
 * The elapsed label is ranged left UNDER the sentence rather than floating
 * right, which is the atlas's own note and the reason a two-line sentence never
 * pushes it out of true.
 *
 * ── WHY THIS FILE TOOK REDESIGN 28'S MEASUREMENTS ─────────────────────────
 *
 * These are the LEGACY rows — friend requests, borrows, event invitations,
 * votes, compliments — and they are not drawn on a page of their own. They are
 * interleaved into the Activity Center's one timeline by `merge.ts`, sitting
 * directly above and below the materialised rows. So the mark, the padding, the
 * sentence and the day all read from `activity-center/activity-spec.ts`: a
 * 36pt mark and a 14pt sentence beside a 44pt mark and a 15.5pt sentence would
 * make the seam between the two data sources the most visible thing on the
 * page, and the artifact's own caption for the mixed frame is that "the reader
 * cannot tell which table a row came from, and should not have to."
 *
 * What did NOT come across is the answer machinery. The pending participles,
 * the was-told outcome lines, the retry and the undo are this taxonomy's alone
 * and are untouched.
 */

/** The mark, at redesign 28's 44 — one diameter down the whole merged column. */
const MARK = ROW_AVATAR;

/**
 * The atlas's 34pt control.
 *
 * Not the shared `Button`: that pill is fixed at a 44pt floor, a 12pt radius
 * and a 17px label, and this page draws a page-long column of them at 34/9/13.
 * A request for a `size` on the shared button is filed in
 * `.redesign/primitive-requests/v.md`; until it lands this is the same local
 * composition `explore.tsx` already ships for the Lately atlas — press feedback,
 * haptics and the 44pt hit target (via `hitSlop`) match `Button` exactly.
 *
 * The ground is drawn as an ARRAY of styles on an `Animated.View`. A `Pressable`
 * carrying both a `className` and a *function* `style` renders nothing; this
 * carries neither.
 *
 * **Solid means INK, never oxblood.** A page of rows each spending the accent
 * on its affirmative is precisely how the one-accent-per-screen rule dies. The
 * only oxblood on this page is a failure.
 */
function ActivityButton({
  action,
  onPress,
  disabled = false,
}: {
  action: ActivityAction;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const press = usePressFeedback(!disabled);
  const solid = action.tone === 'solid';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={(MIN_TAP_TARGET - 34) / 2}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {
          /* haptics are best-effort; never block the action */
        });
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      className={disabled ? 'opacity-40' : ''}>
      <Animated.View
        style={[
          press.style,
          {
            height: 34,
            borderRadius: 9,
            // AUDIT 90 — the action's width is set by its own word. A filled
            // action pads to its label; a quiet one takes only its text plus
            // the two points that keep it off its neighbour. Neither stretches,
            // and there is no `flex: 1` anywhere on this row.
            paddingHorizontal: solid ? 14 : 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          solid ? { backgroundColor: theme.ink } : null,
        ]}>
        <Text
          variant={solid ? 'body' : 'note'}
          style={{ fontSize: 13, lineHeight: 17, color: solid ? theme.canvas : theme.ink }}>
          {action.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * A pending answer — AV-02.
 *
 * A TRAY-FILLED LABEL IN THE PRESENT PARTICIPLE, not a spinner replacing the
 * row. Two reasons, and the second is the one that decided it: a spinner says
 * only "wait" where the participle says which verb is in flight; and a spinner
 * cannot reproduce its own bytes in a capture, so a state drawn with one can
 * never be verified from a screenshot. It holds the same 34pt height the action
 * it replaced had, so nothing on the row moves.
 */
function PendingLabel({ label }: { label: string }) {
  return (
    <View
      className="items-center justify-center rounded-md bg-tray px-3"
      style={{ height: 34, alignSelf: 'flex-start' }}>
      <Text
        variant="note"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
    </View>
  );
}

export type ActivityRowProps = {
  line: ActivityLine;
  /** The actor's photograph, when there is one. Initials otherwise. */
  avatarUri?: string | null;
  /**
   * Whether the row draws the warm dot — redesign 28.
   *
   * Passed in from the section this row landed in, exactly as the materialised
   * rows take it. This taxonomy has no per-row seen state to derive it from
   * (the legacy feed keeps one surface-wide `profiles.activity_seen_at`), and
   * `merge.ts` has already applied that comparison per row to decide the
   * section. Reading it back off the section is what keeps the dot and the
   * heading above it saying the same thing.
   */
  unseen?: boolean;
  state: AnswerState;
  /** Fires for the two answering verbs. */
  onAnswer: (actionId: ActivityActionId) => void;
  /** Fires for the three destinations. */
  onNavigate: (actionId: ActivityActionId) => void;
  /** Fires on the dismissed row's Undo. Absent where no reversal is offered. */
  onUndo?: () => void;
  isLast?: boolean;
};

export function ActivityRow({
  line,
  avatarUri,
  unseen = false,
  state,
  onAnswer,
  onNavigate,
  onUndo,
  isLast = false,
}: ActivityRowProps) {
  const theme = useTheme();

  // The actor's name, so every outcome line can say whether SHE was told
  // rather than "the other person". `mark` already carries it for the rows
  // that have one; the glyph rows are the ones with no person in them.
  const actorName = line.mark.kind === 'person' ? line.mark.name : null;
  const copy = state.status === 'idle' ? null : answerCopy(state.actionId, actorName);

  return (
    <View>
      <View
        className="flex-row items-start"
        style={{ paddingVertical: ROW_PAD_Y, paddingHorizontal: GUTTER, gap: ROW_GAP }}>
        {line.mark.kind === 'person' ? (
          <Avatar name={line.mark.name} size={MARK} imageUri={avatarUri} />
        ) : (
          <ActivityGlyphMark glyph={line.mark.glyph} size={MARK} />
        )}

        <View className="flex-1" style={{ minWidth: 0 }}>
          {/* One `Text` with nested runs, not a row of them: the name has to
              wrap with the rest of the sentence, and a flex row of words
              breaks at the wrong places and loses the space between them. */}
          <Text
            variant="body"
            accessibilityLabel={line.spoken}
            style={{ fontSize: SENTENCE_SIZE, lineHeight: SENTENCE_LEADING }}>
            {line.segments.map((segment, i) => (
              <Text
                key={i}
                variant="body"
                // The actor is the row's one emphasis (audit 91). It used to be
                // carried by Medium; TY-01 removes weight from the product, so
                // it is carried by COLOUR instead — the name in ink, the rest
                // of the sentence in muted. Same single emphasis, same run,
                // and it survives at every Dynamic Type size, which a weight
                // difference at 14 pt barely does.
                className={segment.bold ? 'text-ink' : 'text-muted'}
                style={{ fontSize: SENTENCE_SIZE, lineHeight: SENTENCE_LEADING }}>
                {segment.text}
              </Text>
            ))}
          </Text>

          {line.elapsed ? (
            // AUDIT 91 — REGULAR secondary, on its own line under the sentence,
            // so it never competes with it. Previously `colophon`: 10px tracked
            // uppercase MEDIUM, which is a label's treatment and made a
            // timestamp look like a category. Redesign 28 set it at the same
            // 12.5 the materialised rows use.
            <Text
              variant="note"
              style={{ marginTop: META_GAP, fontSize: META_SIZE, lineHeight: META_LEADING }}>
              {line.elapsed}
            </Text>
          ) : null}

          {state.status === 'pending' ? (
            <View style={{ marginTop: 10 }}>
              <PendingLabel label={copy?.pending ?? 'Working…'} />
            </View>
          ) : state.status === 'done' ? (
            // The row keeps its place and says what happened, in words. Not a
            // tick: a tick says "it worked", and the reader wants to know what
            // it did — above all whether the other person was told.
            <View style={{ marginTop: 10 }}>
              <Text variant="body" accessibilityLiveRegion="polite" style={{ fontSize: 14, lineHeight: 20 }}>
                {copy?.done ?? ''}
              </Text>
              {copy?.doneDetail ? (
                <Text variant="note" style={{ marginTop: 2, fontSize: 13 }}>
                  {copy.doneDetail}
                </Text>
              ) : null}
              {/* The undo is drawn only where a real reversal exists — see
                  `isUndoable`. Nothing that reached another person gets one. */}
              {onUndo && isUndoable(state.actionId) ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${ANSWER_UNDO} — put this request back`}
                  onPress={onUndo}
                  hitSlop={8}
                  style={{ minHeight: MIN_TAP_TARGET, alignSelf: 'flex-start' }}
                  className="justify-center active:opacity-60">
                  <Text variant="note" style={{ fontSize: 13, color: theme.accent }}>
                    {ANSWER_UNDO}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : state.status === 'failed' ? (
            // AV-02 — the failure names what did NOT happen, and retries in
            // place. The row, its avatar and its position are all unchanged.
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, lineHeight: 18, color: theme.accent }}>
                {copy?.failed ?? ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ANSWER_RETRY}
                onPress={() => onAnswer(state.actionId)}
                hitSlop={8}
                style={{ minHeight: MIN_TAP_TARGET, alignSelf: 'flex-start' }}
                className="justify-center active:opacity-60">
                <Text
                  style={{ fontSize: 13, lineHeight: 18, color: theme.accent }}>
                  {ANSWER_RETRY}
                </Text>
              </Pressable>
            </View>
          ) : line.actions.length > 0 ? (
            <View className="flex-row gap-2" style={{ marginTop: 10 }}>
              {line.actions.map((action) => (
                <ActivityButton
                  key={action.id}
                  action={action}
                  onPress={() =>
                    action.role === 'answer' ? onAnswer(action.id) : onNavigate(action.id)
                  }
                />
              ))}
            </View>
          ) : null}
        </View>

        {/* The trailing column — the same warm dot, at the same nine points and
            on the same first line, as the materialised rows beside it. */}
        {unseen ? (
          <View style={{ width: UNSEEN_DOT, paddingTop: dotOffset(SENTENCE_LEADING) }}>
            <UnreadDot />
          </View>
        ) : null}
      </View>
      {isLast ? null : (
        <View className="px-gutter">
          <Rule tone="hairline" />
        </View>
      )}
    </View>
  );
}
