import { forwardRef, type ReactNode } from 'react';
import { Pressable, Text as RNText, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { atlas, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import {
  BACK_RADIUS,
  BACK_SIZE,
  BOX_GAP,
  BOX_HEIGHT,
  BOX_MAX_WIDTH,
  BOX_RADIUS,
  CARD_BODY_SIZE,
  CARD_PAD,
  CARD_RADIUS,
  CTA_HEIGHT,
  CTA_HEIGHT_AX,
  CTA_LABEL_SIZE,
  DOT_GAP,
  DOT_SIZE,
  EYEBROW_SIZE,
  FIELD_BORDER,
  FIELD_HEIGHT,
  FIELD_RADIUS,
  FIELD_TEXT_SIZE,
  HEADER_PAD,
  HEADLINE_SIZE,
  PAD,
  RUN,
  STATUS_SIZE,
  STEP_GAP,
  STEP_HEIGHT,
  STEP_WIDTH,
  SUBLINE_SIZE,
  progressTones,
  type RunStep,
  type StepTone,
  type Trouble,
} from '@/features/auth/auth-run-spec';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * Redesign 19 — the parts the four auth-run screens are assembled from.
 *
 * The screens hold state and call `actions.ts`; everything drawn is here, so a
 * dev fixture can pose any frame without reaching a network. Copy, colour and
 * geometry all come from `features/auth/auth-run-spec.ts` — nothing in this
 * file types a hex or a sentence.
 *
 * The welcome / sign-in screen does not import this module and is untouched by
 * the redesign.
 */

/**
 * ── ONE SANS CUT, INCLUDING WHERE THE FRAME DREW TWO ───────────────────────
 *
 * The approved frames set the CTA labels, the eyebrows, "Change email" and
 * "Resend code" in a bold face. The app has no bold cut and no Medium one —
 * TY-01 deleted every weight from product code and `tests/type-weight.test.ts`
 * enforces it through three separate doors, because a weight that ships
 * renders perfectly and can only be caught in the source.
 *
 * So the emphasis those labels carry is rebuilt from the tools the rule leaves:
 * SIZE (the CTA label is 17 against the 15 around it), COLOUR (oxblood on
 * paper for an action, cream on oxblood inside a button), CASE and SPACE (the
 * eyebrow is uppercase at 11 with 14% tracking). Recorded as a deviation from
 * frame; the alternative is one screen carrying a weight the other thirty
 * cannot.
 */

/** Instrument Serif needs its own line box or iOS slices the ascenders. */
const HEADLINE_LEADING = leading('instrument', HEADLINE_SIZE, 1.12);

const STEP_COLOR: Record<StepTone, string> = {
  done: RUN.stepDone,
  current: atlas.oxblood,
  upcoming: RUN.stepUpcoming,
};

// ---------------------------------------------------------------------------

/**
 * The header: a back well, then the three-step bar.
 *
 * The wordmark is gone from these three screens on purpose. It sat centred over
 * every step of the run saying the same thing each time, and the space it took
 * is what the progress bar now uses to say something that changes. The mark
 * still opens the run — it is on the welcome screen, which this redesign does
 * not touch.
 *
 * `onBack` absent draws no well and no reserved gap: the name screen has
 * nothing behind it (the account already exists), and an empty 44pt hole would
 * be a control that is missing rather than one that was never offered.
 */
export function RunHeader({
  step,
  onBack,
  backDisabled = false,
}: {
  step: RunStep;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: onBack ? HEADER_PAD : PAD,
        paddingTop: 10,
        gap: 13,
      }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          disabled={backDisabled}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled: backDisabled }}
          style={({ pressed }) => ({
            width: BACK_SIZE,
            height: BACK_SIZE,
            borderRadius: BACK_RADIUS,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: RUN.well,
            opacity: pressed ? 0.7 : 1,
          })}>
          <RNText
            // The chevron is a glyph doing an icon's job, so it must not grow
            // with body text — the well is a fixed 44 and a scaled ‹ would
            // simply overflow it.
            maxFontSizeMultiplier={1}
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: 26,
              lineHeight: 30,
              color: backDisabled ? RUN.quiet : atlas.ink,
            }}>
            {'‹'}
          </RNText>
        </Pressable>
      ) : null}
      <View
        // One element to VoiceOver, not three anonymous bars.
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${progressTones(step).length}`}
        style={{ flexDirection: 'row', gap: STEP_GAP }}>
        {progressTones(step).map((tone, i) => (
          <View
            key={i}
            style={{
              width: STEP_WIDTH,
              height: STEP_HEIGHT,
              borderRadius: STEP_HEIGHT / 2,
              backgroundColor: STEP_COLOR[tone],
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * The prompt — one large serif question, at most one supporting line.
 *
 * The same size and rhythm on all three screens, which is the brief's
 * "consistent large serif prompts": the run should feel like one conversation
 * asking three things, not three screens that happen to follow each other.
 */
export function RunPrompt({ headline, children }: { headline: string; children?: ReactNode }) {
  return (
    <View>
      <RNText
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
        style={{
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: HEADLINE_SIZE,
          lineHeight: HEADLINE_LEADING,
          color: atlas.ink,
        }}>
        {headline}
      </RNText>
      {children}
    </View>
  );
}

export function RunSubline({ children }: { children: ReactNode }) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_TEXT_SCALE}
      style={{
        marginTop: 8,
        fontFamily: 'HelveticaNeue',
        fontSize: SUBLINE_SIZE,
        lineHeight: 24,
        color: atlas.muted,
      }}>
      {children}
    </RNText>
  );
}

// ---------------------------------------------------------------------------

/**
 * The boxed field.
 *
 * Three grounds, and each is a statement: white with an oxblood edge means
 * "you are here and this is where you type", white with a pale edge means "this
 * is filled in and something else needs you", and the busy ground means "this
 * is locked while I work". The refusal edge is `RUN.refusal`, not oxblood, so
 * the field's border and the button beneath it never argue.
 */
export const RunField = forwardRef<TextInput, TextInputProps & { tone: 'active' | 'rest' | 'busy' | 'refused' }>(
  function RunField({ tone, style, ...props }, ref) {
    const busy = tone === 'busy';
    return (
      <TextInput
        ref={ref}
        editable={!busy}
        placeholderTextColor={RUN.quiet}
        selectionColor={atlas.oxblood}
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={[
          {
            minHeight: FIELD_HEIGHT,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: FIELD_RADIUS,
            borderWidth: FIELD_BORDER,
            borderColor:
              tone === 'refused'
                ? RUN.refusal
                : tone === 'active'
                  ? atlas.oxblood
                  : RUN.stepUpcoming,
            backgroundColor: busy ? RUN.fieldBusy : RUN.fieldGround,
            fontFamily: 'HelveticaNeue',
            fontSize: FIELD_TEXT_SIZE,
            color: busy ? RUN.quiet : atlas.ink,
          },
          style,
        ]}
        {...props}
      />
    );
  },
);

/** The refusal under a field. Its own line, so nothing below it jumps. */
export function RunFieldError({ children }: { children: ReactNode }) {
  return (
    <RNText
      accessibilityLiveRegion="polite"
      maxFontSizeMultiplier={MAX_TEXT_SCALE}
      style={{
        marginTop: 10,
        fontFamily: 'HelveticaNeue',
        fontSize: STATUS_SIZE,
        lineHeight: 22,
        color: RUN.refusal,
      }}>
      {children}
    </RNText>
  );
}

// ---------------------------------------------------------------------------

/**
 * Three dots that carry a busy label — inside the CTA, beside "Checking…".
 *
 * They reuse the progress bar's own three-step ramp (oxblood → tan → pale) on
 * paper, and cream at three alphas on a filled button, so the app has one
 * vocabulary for "something is advancing" rather than a ring here and a bar
 * there. Under Reduce Motion they hold still at full strength: a frozen ring
 * says "stuck", but three dots at rest are simply a mark, which is why this
 * replaces `PillSpinner` on these screens rather than sitting beside it.
 */
export function RunDots({ onFill = false }: { onFill?: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(3, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [reduced, t]);

  const rest = onFill
    ? ['rgba(243,240,233,1)', 'rgba(243,240,233,0.55)', 'rgba(243,240,233,0.3)']
    : [atlas.oxblood, RUN.stepDone, RUN.stepUpcoming];

  return (
    <View accessibilityElementsHidden style={{ flexDirection: 'row', gap: DOT_GAP }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} progress={t} restColor={rest[i]} reduced={reduced} onFill={onFill} />
      ))}
    </View>
  );
}

function Dot({
  index,
  progress,
  restColor,
  reduced,
  onFill,
}: {
  index: number;
  progress: { value: number };
  restColor: string;
  reduced: boolean;
  onFill: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1 };
    // Which dot is "lit" walks 0→1→2 and repeats. Opacity only: nothing here
    // moves, which is what keeps it legal to run at all under a setting that
    // governs movement rather than change.
    const lit = Math.floor(progress.value) % 3;
    return { opacity: lit === index ? 1 : 0.45 };
  });
  return (
    <Animated.View
      style={[
        {
          width: DOT_SIZE * 2,
          height: DOT_SIZE * 2,
          borderRadius: DOT_SIZE,
          backgroundColor: onFill ? restColor : restColor,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------

/**
 * The one filled CTA. Full width, capsule, oxblood — or the disabled ground,
 * which is a shape rather than a hole so the screen still shows what it is for.
 */
export function RunButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  large = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  large?: boolean;
  accessibilityLabel?: string;
}) {
  const height = large ? CTA_HEIGHT_AX : CTA_HEIGHT;
  const filled = !disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled && !busy, busy }}
      style={({ pressed }) => ({
        minHeight: Math.max(MIN_TAP_TARGET, height),
        borderRadius: height / 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 20,
        backgroundColor: filled ? atlas.oxblood : RUN.stepUpcoming,
        // The directive's pressed depression, on the one control that commits.
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.92 : 1,
      })}>
      {busy ? <RunDots onFill /> : null}
      <RNText
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          fontFamily: 'HelveticaNeue',
          fontSize: CTA_LABEL_SIZE,
          color: filled ? atlas.cream : RUN.quiet,
        }}>
        {label}
      </RNText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

/**
 * The trouble card — the tray callout, grown up.
 *
 * An eyebrow that names the failure, one sentence that says what did NOT
 * happen, and (when there is something to press) the recovery button inside the
 * card rather than below it. Putting the button in the card is what keeps the
 * "one filled CTA per screen" rule true while a failure is on screen: the card
 * takes the screen's action over for as long as it is the thing to do.
 */
export function TroubleCard({
  trouble,
  onAction,
  busy = false,
  large = false,
}: {
  trouble: Trouble;
  onAction?: () => void;
  busy?: boolean;
  large?: boolean;
}) {
  const amber = trouble.tone === 'amber';
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        borderRadius: CARD_RADIUS,
        padding: CARD_PAD,
        backgroundColor: amber ? RUN.troubleAmber : RUN.well,
      }}>
      <RNText
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          fontFamily: 'HelveticaNeue',
          fontSize: EYEBROW_SIZE,
          letterSpacing: EYEBROW_SIZE * 0.14,
          color: amber ? RUN.troubleAmberEyebrow : RUN.troubleNeutralEyebrow,
        }}>
        {trouble.eyebrow}
      </RNText>
      <RNText
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          marginTop: 12,
          fontFamily: 'HelveticaNeue',
          fontSize: CARD_BODY_SIZE,
          lineHeight: 24,
          color: atlas.ink,
        }}>
        {trouble.body}
      </RNText>
      {trouble.action && onAction ? (
        <View style={{ marginTop: 16 }}>
          <RunButton label={trouble.action} onPress={onAction} busy={busy} large={large} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

export type BoxTone = 'active' | 'filled' | 'empty' | 'busy' | 'refused';

/**
 * The six code boxes.
 *
 * Generous, per the brief — 66 tall against the shipped 62, and a 16 radius
 * that matches the field above them so the run reads as one family of controls.
 * At the accessibility threshold they wrap to three-by-two rather than shrink;
 * see `codeColumns`.
 *
 * They are drawn by ONE hidden `TextInput`, exactly as shipped: that is what
 * makes iOS one-time-code autofill land, and it is the keyboard handling the
 * brief calls out as already correct. Nothing about it changed.
 */
export function CodeBoxes({
  digits,
  tone,
  activeIndex,
  columns,
  onPress,
}: {
  digits: readonly (string | undefined)[];
  tone: BoxTone;
  activeIndex: number;
  columns: number;
  onPress: () => void;
}) {
  const wrapped = columns < digits.length;
  return (
    <Pressable accessible={false} onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: wrapped ? 'wrap' : 'nowrap',
          gap: BOX_GAP,
        }}>
        {digits.map((digit, i) => {
          const active = i === activeIndex;
          const refused = tone === 'refused' && digit != null;
          const busy = tone === 'busy';
          return (
            <View
              key={i}
              accessible
              accessibilityLabel={`Digit ${i + 1} of ${digits.length}${digit ? `, ${digit}` : ', empty'}`}
              style={{
                // The two rows need two divisions, and conflating them is what
                // pushed the sixth box off the screen.
                //
                // A percentage basis is a share of the CONTAINER, and the gaps
                // are not in the container's share — six boxes at 1/6 plus five
                // 9pt gaps is 100% + 45pt, so the row overflowed by exactly the
                // gutter it was supposed to respect. A zero basis with `flex: 1`
                // divides what is left AFTER the gaps, which is the only
                // arithmetic that cannot overflow.
                //
                // The wrapped row still needs a percentage, because `flex: 1`
                // with `flexWrap` puts everything on one line. 30% leaves the
                // 10% the two gaps need and `flexGrow` reclaims the remainder.
                ...(wrapped
                  ? { flexGrow: 1, flexBasis: '30%' as const }
                  : { flex: 1, flexBasis: 0, maxWidth: BOX_MAX_WIDTH }),
                minWidth: 0,
                height: BOX_HEIGHT,
                borderRadius: BOX_RADIUS,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: active || refused ? 2 : 1,
                borderColor: refused
                  ? RUN.refusal
                  : active
                    ? atlas.oxblood
                    : busy
                      ? RUN.fieldBusy
                      : RUN.stepUpcoming,
                backgroundColor: busy
                  ? RUN.fieldBusy
                  : digit || active
                    ? RUN.fieldGround
                    : atlas.paper,
              }}>
              {digit ? (
                <RNText
                  maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
                  style={{
                    fontFamily: 'HelveticaNeue',
                    fontSize: 28,
                    color: refused ? RUN.refusal : busy ? RUN.quiet : atlas.ink,
                  }}>
                  {digit}
                </RNText>
              ) : active ? (
                <View style={{ width: 2, height: 26, backgroundColor: atlas.oxblood }} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/** A quiet status line under the boxes — the cooldown, or "Sending a new code…". */
export function RunStatus({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'refused' }) {
  return (
    <RNText
      accessibilityLiveRegion="polite"
      maxFontSizeMultiplier={MAX_TEXT_SCALE}
      style={{
        fontFamily: 'HelveticaNeue',
        fontSize: STATUS_SIZE,
        lineHeight: 22,
        color: tone === 'refused' ? RUN.refusal : atlas.muted,
      }}>
      {children}
    </RNText>
  );
}

/**
 * The busy row the code screen draws while a code is being checked: dots, then
 * the word. The one place a busy state is not inside a button, because this
 * screen has no button — the sixth digit submits on its own, as shipped.
 */
export function RunBusyRow({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: MIN_TAP_TARGET }}>
      <RunDots />
      <RNText
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{
          fontFamily: 'HelveticaNeue',
          fontSize: STATUS_SIZE,
          lineHeight: 22,
          color: atlas.muted,
        }}>
        {label}
      </RNText>
    </View>
  );
}

/**
 * An inline oxblood action inside a sentence — "Didn't get it? Resend code",
 * "Change email".
 *
 * A `Pressable` rather than a pressable `Text` span so the 44pt floor is a real
 * box rather than a line-height coincidence, which is what the shipped screen
 * had to apologise for with a `minHeight` on the paragraph.
 */
export function RunInlineAction({
  prompt,
  label,
  onPress,
  disabled = false,
}: {
  prompt?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      {prompt ? (
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: STATUS_SIZE,
            lineHeight: 22,
            color: atlas.muted,
          }}>
          {prompt}{' '}
        </RNText>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={12}
        style={({ pressed }) => ({
          minHeight: MIN_TAP_TARGET,
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}>
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            fontFamily: 'HelveticaNeue',
            fontSize: STATUS_SIZE,
            lineHeight: 22,
            color: disabled ? RUN.quiet : atlas.oxblood,
          }}>
          {label}
        </RNText>
      </Pressable>
    </View>
  );
}
