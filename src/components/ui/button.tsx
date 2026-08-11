import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, motion, shadow, useTheme, type ThemeColors } from '@/theme/tokens';

type Variant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'critical' | 'inverse';

/**
 * How a disabled button looks.
 *
 * `dim` is what the app has always done — the whole pill at 40% — and stays
 * the default, so none of the ~86 existing call sites change meaning.
 *
 * `filled` is the New Occasion atlas's disabled Create button (N-07): a `sand`
 * ground with a `byline` label, at full opacity. It exists because that button
 * is disabled *with a reason*, and the reason is a sentence printed underneath
 * it in `muted`. A 40% pill above a fully-opaque explanation reads as two
 * different levels of switched-off; a solid sand slab reads as a control that
 * is simply waiting. The label's contrast is below AA by design — WCAG exempts
 * disabled controls, and the sentence beneath carries the actual information at
 * full strength.
 */
type DisabledTone = 'dim' | 'filled';

/** `rounded-md` in tailwind.config.js — pills belong to the glass chrome layer. */
const RADIUS = 12;

/**
 * The Refacing's §1.2 weight cut, drawn once on reference board A.
 *
 * FILLED variants keep Medium; OUTLINED and TEXT-ONLY variants drop to
 * regular. The reasoning on the board: an outlined button has no ground to
 * carry its emphasis, so setting its label in Medium makes it shout at the
 * same volume as the call to action standing next to it. Weight was the app's
 * only differentiator between "the thing to do" and "the other thing you may
 * do", and it was spent on both.
 *
 * `font-semibold` resolves to HelveticaNeue-Medium — the face carries regular
 * and Medium and nothing between, so this is a two-value switch, not a ramp.
 * `<Text variant="body">` already carries `font-body`, which is the regular
 * cut; the outlined variants therefore add nothing rather than adding a
 * lighter class, and two font utilities never race on one element.
 */
const MEDIUM_LABEL: Record<Variant, boolean> = {
  primary: true,
  ink: true,
  critical: true,
  secondary: false,
  ghost: false,
  inverse: false,
};

/**
 * The control height, per the same board — 52, against a 44 tap floor.
 *
 * `minHeight`, not `height`: at the larger Dynamic Type sizes a label needs
 * more room than 52 and must be allowed to take it, which is the reason this
 * was already a minimum rather than a fixed box.
 *
 * `ghost` is the exception, and stays at the 44 floor. It is the one variant
 * that draws no ground (see `ground()` — it returns the bare base), so it has
 * no box whose height anyone can see; what it does have is ~30 call sites
 * sitting inline inside caption rows and footnotes — `Notice`'s trailing
 * "Undo" among them — where a 52pt minimum would open a gap under a line of
 * 11px text. The board draws ghost as bare words for exactly this reason.
 */
const GROUNDED_HEIGHT = 52;

/**
 * The ground — background and border — as inline styles rather than classes.
 *
 * The accent is SPENT, not sprayed: it lives on the primary action and nowhere
 * else. Secondary buttons are outlined with the structural rule colour, like
 * everything else in the plate grammar; ghost actions are quiet ink.
 *
 * It is drawn on an absolutely-positioned `Animated.View` so the press
 * compression carries the whole pill and not just its label. That layer cannot
 * take a `className` — NativeWind's interop is registered for the React Native
 * primitives, not for Reanimated's wrappers, so a class there would silently do
 * nothing — hence the theme lookup, the same reasoning as `labelKey` below.
 */
function ground(variant: Variant, theme: ThemeColors): ViewStyle {
  const base: ViewStyle = { borderRadius: RADIUS };
  // The contact shadow — the app's one elevation — on the primary action ALONE,
  // per reference board A. It is what separates the single oxblood call to
  // action from the outlined controls beside it now that weight no longer
  // does; spending it on a second button on the same screen would flatten the
  // distinction again. Safe on this layer: it paints the ground and clips
  // nothing, and on iOS a view that clips its children clips its own shadow
  // away (the same note stands over `components/today/plate.tsx`).
  if (variant === 'primary')
    return {
      ...base,
      backgroundColor: theme.accent,
      // The recipe is "0 / 5 / 11 · ink at 16%", and it is spelled out as a
      // colour plus an opacity rather than passed as `shadow.contact.color`'s
      // rgba string: iOS multiplies `shadowOpacity` by the colour's own alpha,
      // so an rgba shadow colour is applied twice. `plate.tsx` decomposes it
      // the same way, and this must match the elevation the plates already draw.
      shadowColor: theme.ink,
      shadowOpacity: 0.16,
      shadowRadius: shadow.contact.blur,
      shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy },
    };
  // The ink fill — the atlases' workhorse action ("Add clothes", "New event",
  // "Going"). Louder than an outline, but it does NOT spend the accent: a
  // screen keeps its one oxblood action even with an ink button on it.
  if (variant === 'ink') return { ...base, backgroundColor: theme.ink };
  if (variant === 'secondary') return { ...base, borderWidth: 1, borderColor: theme.rule };
  // Undoing something other people can already see: cancelling an occasion,
  // leaving one, removing a guest, taking a look off the board. Oxblood is the
  // accent and already means "the one thing to do here", so a destructive
  // action wearing it reads as the recommendation — which is why `critical` is
  // a distinct, deeper brick rather than a shade of the accent.
  //
  // NOT for every irreversible act. Discarding a half-written occasion stays
  // `primary`, because nobody else has seen it; the line is whether the thing
  // being undone was ever public. Two units hand-built this fill independently
  // before it lived here.
  if (variant === 'critical') return { ...base, backgroundColor: theme.critical };
  // The action on an ink ground — a canvas pill with an ink label.
  //
  // Every other variant fails there and fails silently: `ink` disappears into
  // the ground, `secondary`'s `rule` outline is invisible on it, `ghost` is
  // unreadable, and `primary` would be oxblood-on-ink AND spend the screen's
  // one accent on a "Next". The tour built this by hand before it lived here,
  // which is the signal that it belonged in the kit.
  //
  // Rationed like the ground it sits on: the ink ground appears on the tour's
  // first frame and nowhere else, so this variant has exactly as many correct
  // uses as there are dark grounds in the app.
  if (variant === 'inverse') return { ...base, backgroundColor: theme.canvas };
  return base;
}

/**
 * Label colour is applied as an inline STYLE, not a className.
 *
 * `<Text variant="body">` already carries `text-ink`, and NativeWind gives no
 * guaranteed precedence between two `text-*` utilities on one element — so a
 * `text-canvas` class here lost, and every primary button rendered ink-on-
 * oxblood: legible enough to survive review, wrong everywhere it shipped. An
 * inline style always wins. `labelKey` names the theme colour per variant.
 */
const labelKey: Record<Variant, 'canvas' | 'ink' | 'muted'> = {
  primary: 'canvas',
  ink: 'canvas',
  secondary: 'ink',
  ghost: 'muted',
  critical: 'canvas',
  inverse: 'ink',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /**
   * Fires a selection tap on press. Defaults ON: a Button is a discrete
   * commitment, and 30 of the app's call sites — every destructive and every
   * commit action among them — simply omitted the prop and shipped silent. The
   * handful of places that must stay quiet pass `haptic={false}`.
   *
   * Note haptics silently no-op in Low Power Mode, when Taptic is disabled, and
   * while a camera session is active — so the visual pressed state below is the
   * real feedback, never the haptic.
   */
  haptic?: boolean;
  /** See {@link DisabledTone}. Defaults to `dim` — today's behaviour exactly. */
  disabledTone?: DisabledTone;
  className?: string;
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  haptic = true,
  disabledTone = 'dim',
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  className = '',
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const press = usePressFeedback(!isDisabled);
  // Empty string, not `font-body`: `variant="body"` already carries it, and a
  // second font utility on one element is resolved by key order in the
  // generated stylesheet rather than by intent — the hazard `labelKey` above
  // exists to avoid.
  const weight = MEDIUM_LABEL[variant] ? 'font-semibold' : '';

  // `loading` is deliberately NOT part of this: an in-flight button keeps its
  // variant ground and shows a spinner on it (N-07's third state), so only a
  // genuinely unavailable action goes sand.
  const filled = disabledTone === 'filled' && Boolean(disabled) && !loading;

  /**
   * The cross-fade between the variant's ground and the sand one.
   *
   * 220ms is `motion.duration.base`, and it is also the duration the atlas's
   * own script animates this at — the fill and the sentence beneath it are
   * meant to arrive as a single event, so the form becoming available reads as
   * one change rather than two.
   *
   * `withTiming` carries `ReduceMotion.System` by construction in this project
   * (see use-press-feedback.ts), so the state still arrives with the
   * accessibility setting on; it simply arrives without the tween.
   */
  const toneProgress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    toneProgress.value = withTiming(filled ? 1 : 0, { duration: motion.duration.base });
  }, [filled, toneProgress]);

  // Two layers cross-fading, rather than one layer interpolating its colour:
  // the label is a `<Text>` carrying real variant classes, and NativeWind's
  // interop is not registered for Reanimated's `Animated.Text` — animating the
  // colour would mean re-typing the type scale inline. Opacity on two honest
  // Texts costs one extra view and keeps the scale where it belongs.
  const fadeIn = useAnimatedStyle(() => ({ opacity: toneProgress.value }));
  const fadeOut = useAnimatedStyle(() => ({ opacity: 1 - toneProgress.value }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={(event) => {
        if (haptic) {
          void Haptics.selectionAsync().catch(() => {
            /* haptics are best-effort; never block the action */
          });
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      style={{ minHeight: variant === 'ghost' ? MIN_TAP_TARGET : GROUNDED_HEIGHT }}
      // Layout, padding and the caller's own classes stay here so `px-0`,
      // `px-6`, `flex-1` and `self-*` keep behaving exactly as they always did.
      // Only the paint moved onto the animated layers below.
      className={[
        'flex-row items-center justify-center rounded-md px-5',
        // The sand tone IS the disabled treatment, so it must not also be
        // dimmed — 40% of #EAE5DB on canvas is not a control, it is a smudge.
        isDisabled && disabledTone === 'dim' ? 'opacity-40' : '',
        className,
      ].join(' ')}
      {...rest}>
      {/* The press compression sits on the outer layer and the two grounds
          cross-fade inside it: both effects want `opacity`, and the later
          animated style would otherwise simply overwrite the earlier one. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, press.style]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            ground(variant, theme),
            disabledTone === 'filled' ? fadeOut : null,
          ]}
        />
        {disabledTone === 'filled' ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: RADIUS, backgroundColor: theme.sand },
              fadeIn,
            ]}
          />
        ) : null}
      </Animated.View>
      {/* The label rides the same shared value as the ground, so the pill and
          what is written on it compress as one object rather than sliding
          against each other. */}
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, press.style]}>
        {loading ? (
          <ActivityIndicator size="small" color={theme[labelKey[variant]]} />
        ) : disabledTone === 'filled' ? (
          // The sand label is drawn over the variant one and sized by it, so
          // the pill's width never jumps as the tone changes.
          <View>
            <Animated.View style={fadeOut}>
              <Text
                variant="body"
                className={weight}
                style={{ color: theme[labelKey[variant]] }}>
                {title}
              </Text>
            </Animated.View>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center' },
                fadeIn,
              ]}>
              {/* Inline colour, never a second `text-*` class — `variant="body"`
                  already carries `text-ink`, and NativeWind resolves two colour
                  utilities on one element by key order, not by intent. */}
              <Text variant="body" className={weight} style={{ color: theme.byline }}>
                {title}
              </Text>
            </Animated.View>
          </View>
        ) : (
          <Text
            variant="body"
            className={weight}
            style={{ color: theme[labelKey[variant]] }}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
