import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/ui/avatar';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import type { AnswerState } from '@/features/activity/answers';
import {
  ANSWER_FAILED,
  ANSWER_RETRY,
  answerCopy,
  type ActivityAction,
  type ActivityActionId,
  type ActivityLine,
} from '@/features/activity/sentence';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { ActivityGlyphMark } from './glyphs';

/**
 * One row of the Activity page — the atlas's row anatomy, in order: the mark,
 * the sentence, the elapsed label under it, the answer.
 *
 * The elapsed label is ranged left UNDER the sentence rather than floating
 * right, which is the atlas's own note and the reason a two-line sentence never
 * pushes it out of true.
 */

const MARK = 36;
const OUTLINE_EDGE = 'rgba(28,26,22,0.22)';

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
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          solid ? { backgroundColor: theme.ink } : { borderWidth: 1, borderColor: OUTLINE_EDGE },
        ]}>
        <Text
          variant={solid ? 'body' : 'label'}
          className={solid ? 'font-semibold' : ''}
          style={{ fontSize: 13, lineHeight: 17, color: solid ? theme.canvas : theme.ink }}>
          {action.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export type ActivityRowProps = {
  line: ActivityLine;
  /** The actor's photograph, when there is one. Initials otherwise. */
  avatarUri?: string | null;
  state: AnswerState;
  /** Fires for the two answering verbs. */
  onAnswer: (actionId: ActivityActionId) => void;
  /** Fires for the three destinations. */
  onNavigate: (actionId: ActivityActionId) => void;
  isLast?: boolean;
};

export function ActivityRow({
  line,
  avatarUri,
  state,
  onAnswer,
  onNavigate,
  isLast = false,
}: ActivityRowProps) {
  const theme = useTheme();

  const copy = state.status === 'idle' ? null : answerCopy(state.actionId);

  return (
    <View>
      <View className="flex-row items-start gap-3" style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        {line.mark.kind === 'person' ? (
          <Avatar name={line.mark.name} size={MARK} imageUri={avatarUri} />
        ) : (
          <ActivityGlyphMark glyph={line.mark.glyph} />
        )}

        <View className="flex-1" style={{ minWidth: 0 }}>
          {/* One `Text` with nested runs, not a row of them: the name has to
              wrap with the rest of the sentence, and a flex row of words
              breaks at the wrong places and loses the space between them. */}
          <Text variant="body" accessibilityLabel={line.spoken} style={{ fontSize: 14, lineHeight: 20 }}>
            {line.segments.map((segment, i) => (
              <Text
                key={i}
                variant="body"
                className={segment.bold ? 'font-semibold' : ''}
                style={{ fontSize: 14, lineHeight: 20 }}>
                {segment.text}
              </Text>
            ))}
          </Text>

          {line.elapsed ? (
            // `colophon` (10px, tracked, uppercase, muted). The atlas sets this
            // at 11px in #A29C90 — lighter even than `faint`, and a contrast
            // failure twice over — so the separation from the day heading above
            // is carried by size instead of by colour.
            <Text variant="colophon" style={{ marginTop: 4 }}>
              {line.elapsed}
            </Text>
          ) : null}

          {state.status === 'pending' ? (
            <View className="flex-row items-center gap-2" style={{ marginTop: 10 }}>
              {/* The atlas's ink ring. Not the shared `Spinner`, whose crown is
                  oxblood — a spinner is not this page's one accent. */}
              <ActivityIndicator size="small" color={theme.ink} />
              <Text variant="note" style={{ fontSize: 13 }}>
                {copy?.pending ?? 'Working…'}
              </Text>
            </View>
          ) : state.status === 'done' ? (
            // The row keeps its place and says what happened, in words. Not a
            // tick: a tick says "it worked", and the reader wants to know what
            // it did — above all whether the other person was told.
            <Text
              variant="note"
              accessibilityLiveRegion="polite"
              style={{ marginTop: 10, fontSize: 13 }}>
              {copy?.done ?? ''}
            </Text>
          ) : state.status === 'failed' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${ANSWER_FAILED} ${ANSWER_RETRY}`}
              onPress={() => onAnswer(state.actionId)}
              hitSlop={8}
              className="active:opacity-60"
              style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, lineHeight: 18, color: theme.accent }}>
                {ANSWER_FAILED}{' '}
                <Text
                  className="font-semibold"
                  style={{ fontSize: 13, lineHeight: 18, color: theme.accent }}>
                  {ANSWER_RETRY}
                </Text>
              </Text>
            </Pressable>
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
      </View>
      {isLast ? null : <Rule tone="hairline" />}
    </View>
  );
}
