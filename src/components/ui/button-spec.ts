// Value imports come from `@/theme/metrics`, NOT `@/theme/tokens`: tokens
// imports react-native, whose Flow source the node test runner's bundler
// cannot parse, and one value import would drag the whole graph in. The two
// TYPE imports below are erased before bundling, so they cost nothing.
import { MIN_TAP_TARGET, shadow } from '@/theme/metrics';

import type { ThemeColors } from '@/theme/tokens';
import type { ViewStyle } from 'react-native';

/**
 * Button's visual contract, as data.
 *
 * Audit item 49. These five declarations used to live inside `button.tsx`,
 * where nothing could import them and nothing did test them — and the comments
 * on them record three bugs that shipped anyway: every primary button rendering
 * ink-on-oxblood because two `text-*` utilities raced, `ghost` inheriting a
 * 52pt minimum that opened a gap under 11px captions, and the contact shadow
 * spreading to a second button and flattening the very distinction it draws.
 *
 * All three are facts about a TABLE, not about a rendered tree: which colour,
 * which weight, which height, which ground, per variant. So the testable
 * surface is the table, and moving it here is what makes it one.
 *
 * Nothing about the rendering changed — `button.tsx` imports these and uses
 * them exactly as before. `ground()` was already pure (it takes the theme as a
 * parameter rather than calling the hook), which is what let it move at all.
 */

export type Variant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'critical' | 'inverse';

/** Every variant, in one place, so a test can iterate the whole matrix. */
export const VARIANTS: readonly Variant[] = [
  'primary',
  'ink',
  'secondary',
  'ghost',
  'critical',
  'inverse',
] as const;

/** `rounded-md` in tailwind.config.js — pills belong to the glass chrome layer. */
export const RADIUS = 12;

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
export const MEDIUM_LABEL: Record<Variant, boolean> = {
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
export const GROUNDED_HEIGHT = 52;

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
export function ground(variant: Variant, theme: ThemeColors): ViewStyle {
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
export const labelKey: Record<Variant, 'canvas' | 'ink' | 'muted'> = {
  primary: 'canvas',
  ink: 'canvas',
  secondary: 'ink',
  ghost: 'muted',
  critical: 'canvas',
  inverse: 'ink',
};

/**
 * The minimum height a variant draws at.
 *
 * `ghost` is the exception and stays at the tap floor — see GROUNDED_HEIGHT.
 * Named rather than inlined at the call site so the exception is testable
 * rather than a condition buried in JSX.
 */
export function minHeightFor(variant: Variant): number {
  return variant === 'ghost' ? MIN_TAP_TARGET : GROUNDED_HEIGHT;
}

/** Whether a variant's label is set in the Medium cut. */
export function labelWeightFor(variant: Variant): 'font-semibold' | '' {
  return MEDIUM_LABEL[variant] ? 'font-semibold' : '';
}
