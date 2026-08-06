import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  Text as RNText,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import { sendEmailLink, signInWithApple } from '@/features/auth/actions';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

const PRIVACY_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/privacy';
const TERMS_URL = 'https://cinch-nelsonsaenz1-3579s-projects.vercel.app/terms';

/**
 * Turn a THROWN sign-in failure into a message worth showing.
 *
 * The auth actions return `{ ok: false }` for every failure they can name, so
 * anything that arrives here escaped them — in practice the session-storage
 * layer. Under PKCE, `signInWithOtp` persists the code verifier through the
 * Supabase client's storage adapter BEFORE the request goes out; on a build
 * whose keychain entitlement is missing (a dev build, most commonly),
 * SecureStore rejects, supabase-js rethrows the non-auth error, and without a
 * catch the tap on the send arrow does nothing at all — no alert, busy stuck.
 * The entitlement itself is a build problem fixed elsewhere; the contract HERE
 * is that no storage failure is ever silent.
 */
function describeThrownSignInError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const isStorageFailure = /secure ?store|keychain|entitlement|storage/i.test(message);
  return isStorageFailure
    ? 'Cinch couldn’t store your sign-in securely on this device, so no link was sent. Restart the app and try again — if it keeps happening, this build can’t reach the device’s keychain.'
    : message || 'Please try again.';
}

type Mode = 'choose' | 'email' | 'sent';

/**
 * The Dynamic Type ceilings, matching the shared `Text` component exactly.
 *
 * This screen is drawn in raw `RNText` because every measure on it is the
 * mock's own pixel value scaled by `px()` — but a raw `RNText` scales without
 * a ceiling, and the hero's type is printed over absolutely-positioned
 * geometry that cannot reflow. At AX5 an uncapped wordmark walks into the
 * garment tiles and the caption off the grid. Same numbers as text.tsx: the
 * display-class serif takes the tighter cap, everything else the looser one.
 */
const MAX_DISPLAY_SCALE = 1.4;
const MAX_TEXT_SCALE = 1.8;

/** Every plate-01 SVG is drawn on this shared canvas, in its own corner of it. */
const PLATE_CANVAS = { w: 1040, h: 660 } as const;

/**
 * Where one garment drawing goes inside its tile.
 *
 * The plate SVGs are not centred artwork: each one draws its garment at the
 * position it occupies in the COMPOSED 1040×660 plate (knit top-centre, coat
 * left, derbies bottom-right, trousers centre-right), because the dev fixtures
 * overlay all of them into one flat lay. Rendered whole into a tile with
 * `contain`, that history is exactly what made the first pass read accidental:
 * every garment landed small and off-centre, the derbies drifted into the
 * set's caption, the trousers hugged an edge. So each tile states where the
 * GARMENT goes and the maths below scales/offsets the whole canvas to put it
 * there — a per-tile focus crop, not a canvas dump.
 */
type GarmentPlacement = {
  /**
   * The garment's bounding box in canvas units — measured from the rendered
   * SVG (getBBox over every group, stroke extents and the ground-shadow
   * ellipses included, rotations applied), not read off the path data.
   */
  bbox: readonly [x: number, y: number, w: number, h: number];
  /** Where the garment's centre lands, as fractions of the tile. */
  cx: number;
  cy: number;
  /** The most of the tile's width / height the garment may span. */
  fw: number;
  fh: number;
  /** Rotation about the garment's centre. −90 lays the folded trousers flat. */
  rotate?: number;
};

/**
 * The four garments of the welcome set — the same plate artwork the dev
 * fixtures use, bundled so the first screen never waits on a network. Order
 * matches the tile order below: each drawing is picked for contrast against
 * its tile's ground (cream knit on charcoal, navy coat on slate, dark derbies
 * on clay, camel trousers on cream).
 *
 * The placements were chosen by RENDERING, not by arithmetic — the ghosted
 * rail learned the same lesson about blur: values picked in the abstract read
 * wrong on screen. A pixel-accurate HTML mock of this screen (real SVGs, the
 * mock's own 300-unit measurements at iPhone scale) was screenshotted and the
 * numbers below iterated against it until:
 *
 *  - the knit clears the wordmark printed over the first tile's top-left;
 *  - the coat clears the TODAY'S SET label at the second tile's top-right;
 *  - both bottom-row garments sit in one shared band (≈ the top half of the
 *    tile) with the set's caption printed on clear ground beneath them —
 *    the caption crosses BOTH bottom tiles, so anything below ~55% of those
 *    tiles' height collides with it;
 *  - the trousers lie on their side (−90°): upright, a folded trouser is far
 *    taller than the caption-free band and can only render as a clipped leg.
 */
const GARMENT_ART: { source: number; place: GarmentPlacement }[] = [
  {
    source: require('@/assets/plates/plate-01-knit.svg') as number,
    place: { bbox: [436, 89, 260, 261], cx: 0.55, cy: 0.7, fw: 0.6, fh: 0.5 },
  },
  {
    source: require('@/assets/plates/plate-01-coat.svg') as number,
    place: { bbox: [68, 105, 370, 521], cx: 0.5, cy: 0.61, fw: 0.8, fh: 0.72 },
  },
  {
    source: require('@/assets/plates/plate-01-shoes.svg') as number,
    place: { bbox: [752, 405, 240, 221], cx: 0.5, cy: 0.245, fw: 0.62, fh: 0.38 },
  },
  {
    source: require('@/assets/plates/plate-01-trousers.svg') as number,
    place: { bbox: [652, 239, 207, 377], cx: 0.5, cy: 0.25, fw: 0.72, fh: 0.36, rotate: -90 },
  },
];

/**
 * One garment tile of the welcome grid.
 *
 * A vertical Skia gradient under the artwork rather than a solid: a soft
 * top-lit falloff reads as a photographed ground where a flat fill reads as a
 * colour chart. Skia because it is already in the bundle for the plate —
 * adding expo-linear-gradient for four static rectangles would be a dependency
 * for a two-stop gradient.
 *
 * The gradient needs pixel bounds, so the tile measures itself; the canvas
 * draws nothing until the first layout pass, which on a static screen is
 * invisible.
 */
function SwatchTile({
  top,
  bottom,
  radius,
  art,
  place,
}: {
  top: string;
  bottom: string;
  radius: number;
  /** Resolved asset URI for the garment drawing laid over the ground. */
  art?: string;
  /** Where the garment lands in the tile; required whenever `art` is given. */
  place?: GarmentPlacement;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  // The focus crop: scale the whole plate canvas so the garment's bounding
  // box spans at most (fw × tile width, fh × tile height), then offset the
  // canvas so the garment's centre sits at (cx, cy) of the tile. The tile's
  // `overflow: hidden` crops the rest of the canvas away.
  let artStyle = null;
  if (place && size.h > 0) {
    const [bx, by, bw, bh] = place.bbox;
    // A quarter-turned garment's footprint swaps its axes.
    const quarterTurn = place.rotate != null && Math.abs(place.rotate) % 180 === 90;
    const footW = quarterTurn ? bh : bw;
    const footH = quarterTurn ? bw : bh;
    const scale = Math.min((place.fw * size.w) / footW, (place.fh * size.h) / footH);
    // The garment's centre, in scaled canvas points — both the offset target
    // and, when rotating, the pivot (so rotation never moves the garment).
    const gcx = (bx + bw / 2) * scale;
    const gcy = (by + bh / 2) * scale;
    artStyle = {
      position: 'absolute' as const,
      width: PLATE_CANVAS.w * scale,
      height: PLATE_CANVAS.h * scale,
      left: place.cx * size.w - gcx,
      top: place.cy * size.h - gcy,
      ...(place.rotate != null
        ? {
            transformOrigin: [gcx, gcy, 0] as [number, number, number],
            transform: [{ rotate: `${place.rotate}deg` }],
          }
        : null),
    };
  }

  return (
    <View
      style={{ flex: 1, borderRadius: radius, overflow: 'hidden' }}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {size.h > 0 ? (
        <Canvas style={{ position: 'absolute', width: size.w, height: size.h }}>
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <LinearGradient start={vec(0, 0)} end={vec(0, size.h)} colors={[top, bottom]} />
          </Rect>
        </Canvas>
      ) : null}
      {art && artStyle ? (
        <Image
          source={art}
          // The style's width/height keep the canvas aspect exactly, so fill
          // cannot distort — it just makes the sizing explicit.
          contentFit="fill"
          transition={0}
          style={artStyle}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/**
 * The 180° legibility scrim over the hero, per the welcome mock: dark at the
 * top under the wordmark, clear through the middle so the garments stay lit,
 * dark again at the bottom under the set's caption. It sits ABOVE the tiles
 * and BELOW every line of type — which is the whole reason the wordmark and
 * captions render as overlays on the grid rather than inside the tiles.
 */
function HeroScrim() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }>
      {size.h > 0 ? (
        <Canvas style={{ width: size.w, height: size.h }}>
          <Rect x={0} y={0} width={size.w} height={size.h}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, size.h)}
              colors={['rgba(20,19,17,0.5)', 'rgba(20,19,17,0)', 'rgba(20,19,17,0.9)']}
              positions={[0, 0.45, 1]}
            />
          </Rect>
        </Canvas>
      ) : null}
    </View>
  );
}

/**
 * One legal link, as a SPAN inside the sentence rather than its own Pressable.
 *
 * The line used to be five sibling `Text`s inside a wrapping flex row, so the
 * wrap points fell between the fragments — "By continuing you agree to our"
 * could break away from "Terms", and at a large Dynamic Type setting the row
 * broke mid-phrase in places no typesetter would choose. Nested text keeps it
 * one string and lets the layout break it between words.
 *
 * Two consequences of being a span, both deliberate:
 *  - RN's `Text` has no `hitSlop` (it is not a touchable), so the retention
 *    box is `pressRetentionOffset` instead — the finger may stray this far
 *    before the press is cancelled.
 *  - `opacity` is not an attribute nested text carries, so the pressed state
 *    is a colour step (muted → ink) rather than the app's usual fade. Same
 *    grammar, the medium's own version of it.
 */
function LegalLink({
  label,
  url,
  color,
  pressedColor,
}: {
  label: string;
  url: string;
  color: string;
  pressedColor: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Text
      variant="caption"
      className="underline"
      accessibilityRole="link"
      suppressHighlighting
      pressRetentionOffset={{ top: 8, left: 8, right: 8, bottom: 8 }}
      onPress={() => void Linking.openURL(url)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{ color: pressed ? pressedColor : color }}>
      {label}
    </Text>
  );
}

/**
 * The one screen a signed-out user ever sees.
 *
 * Composition per the welcome mock: the top of the page is a 2×2 grid of
 * garment swatches on ink — a styled set presented like a contact sheet, the
 * wordmark printed on the first tile and the set's caption along the bottom —
 * and a canvas sheet rises over its lower edge carrying the promise and the
 * two ways in. The product's whole grammar (a look as a set of plates, cost
 * per wear as a headline fact) is on screen before a single word of pitch.
 *
 * Sign in with Apple leads because it is genuinely the least friction — and
 * because the App Store requires it once any other social login is offered
 * (Guideline 4.8). Email is the second path deliberately: a link to an inbox
 * covers Gmail, Yahoo, Outlook and every work address without binding the
 * product to one company's OAuth.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Every entrance on this screen is a fade or a fade-up; with Reduce Motion
  // on, each one is simply skipped and the element mounts at its end state.
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);

  /**
   * Whether Sign in with Apple can actually run in THIS build.
   *
   * `Platform.OS === 'ios'` is not enough. The capability needs the
   * `com.apple.developer.applesignin` entitlement, which a free Apple personal
   * team is not allowed to sign — so a device build made for a personal team
   * (see scripts/free-signing.sh) ships without it, and tapping the button
   * would throw. Ask the framework instead of assuming, and simply do not
   * offer the option when it cannot work.
   */
  const builtWithAppleSignIn =
    (Constants.expoConfig?.extra as { appleSignInEnabled?: boolean } | undefined)
      ?.appleSignInEnabled !== false;

  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (!builtWithAppleSignIn) return; // free-team build: the capability is absent
    let cancelled = false;
    void AppleAuthentication.isAvailableAsync()
      .then((ok) => {
        if (!cancelled) setAppleAvailable(ok);
      })
      .catch(() => {
        if (!cancelled) setAppleAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [builtWithAppleSignIn]);

  /**
   * Every measurement is the mock's own pixel value scaled by one factor. The
   * mock draws the page in a 300-unit-wide frame; `s` converts its units to
   * points so the proportions land as drawn on any width.
   */
  const { width: screenW } = useWindowDimensions();
  const s = screenW / 300;
  const px = (mock: number) => mock * s;

  // The grounds under the four garments. Literal rather than tokenized: these
  // are the mock's tile colours — charcoal, slate, clay, cream — and exist
  // nowhere else in the app. Each pair is a soft top-lit falloff.
  const TILES = [
    { top: '#37342F', bottom: '#282623' }, // charcoal
    { top: '#A9B2C0', bottom: '#5E6874' }, // slate
    { top: '#BB9179', bottom: '#754C3C' }, // clay
    { top: '#F0EADE', bottom: '#A49E90' }, // cream
  ];
  const cream = theme.canvas;
  const warmTan = '#D8B7A6'; // the set caption's eyebrow, on ink — the mock's own value
  const captionLight = 'rgba(251,250,246,0.82)';

  // Bundled SVGs resolve synchronously to a file URI — no loading state needed.
  const artUris = useMemo(() => GARMENT_ART.map((m) => Asset.fromModule(m.source).uri), []);

  const onApple = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // `signInWithApple` catches everything and answers in results — the
      // try/catch is a firebreak for the same class of escape `onSendEmail`
      // genuinely has: if the action ever leaks a storage rejection, the user
      // still gets an alert instead of a dead button and a stuck spinner.
      const result = await signInWithApple();
      if (result.ok) return; // Root layout redirects as soon as the session lands.

      switch (result.reason) {
        case 'canceled':
          break; // The user chose to back out. Do not shame them for it.
        case 'unavailable':
          Alert.alert(
            'Sign in with Apple is unavailable',
            'This device does not support it. You can continue with your email instead.',
          );
          setMode('email');
          break;
        case 'failed':
          Alert.alert('Could not sign you in', result.message ?? 'Please try again in a moment.');
          break;
      }
    } catch (err) {
      Alert.alert('Could not sign you in', describeThrownSignInError(err));
    } finally {
      // `finally`, not a line after the await: if the await throws, an inline
      // reset never runs, `busy` sticks true, and every button on the screen
      // is disabled forever — the "tap does nothing" failure all over again.
      setBusy(false);
    }
  }, [busy]);

  const onSendEmail = useCallback(async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      const result = await sendEmailLink(email);
      if (result.ok) setMode('sent');
      else Alert.alert('Could not send the link', result.message ?? 'Please try again.');
    } catch (err) {
      // Without this catch, a SecureStore rejection out of the PKCE verifier
      // persist inside `signInWithOtp` is an unhandled rejection: the send
      // arrow does nothing, silently. See `describeThrownSignInError`.
      Alert.alert('Could not send the link', describeThrownSignInError(err));
    } finally {
      setBusy(false);
    }
  }, [busy, email]);

  return (
    <View className="flex-1 bg-ink">
      {/* The grid half is ink; the global status bar is dark-on-light and
          would vanish over it. */}
      <StatusBar style="light" />
      <KeyboardAvoidingScreen className="flex-1">
        {/* ── The set: a 2×2 contact sheet of garment swatches ── */}
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + px(6),
            paddingHorizontal: px(16),
            gap: px(7),
          }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: px(7) }}>
            <SwatchTile
              top={TILES[0].top}
              bottom={TILES[0].bottom}
              radius={px(14)}
              art={artUris[0]}
              place={GARMENT_ART[0].place}
            />
            <SwatchTile
              top={TILES[1].top}
              bottom={TILES[1].bottom}
              radius={px(14)}
              art={artUris[1]}
              place={GARMENT_ART[1].place}
            />
          </View>

          <View style={{ flex: 1, flexDirection: 'row', gap: px(7) }}>
            <SwatchTile
              top={TILES[2].top}
              bottom={TILES[2].bottom}
              radius={px(14)}
              art={artUris[2]}
              place={GARMENT_ART[2].place}
            />
            <SwatchTile
              top={TILES[3].top}
              bottom={TILES[3].bottom}
              radius={px(14)}
              art={artUris[3]}
              place={GARMENT_ART[3].place}
            />
          </View>

          {/* The legibility scrim, above the artwork and below every line of
              type — with real garment drawings in the tiles, the wordmark and
              captions need it to stay readable over any image. */}
          <HeroScrim />

          {/* The wordmark and the set label, printed over the scrim at the
              positions the mock draws them inside the first two tiles. They
              moved out of the tiles when the scrim arrived: a tile clips its
              children, and type under the scrim would dim with the artwork. */}
          <RNText
            pointerEvents="none"
            maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
            style={{
              position: 'absolute',
              left: px(16 + 15),
              top: insets.top + px(6 + 12),
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: px(34),
              color: cream,
            }}>
            Cinch
          </RNText>
          <RNText
            pointerEvents="none"
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            // The label is pinned to the tile's top-right corner and the
            // wordmark to the top-left; a scaled label that wraps to three
            // lines would otherwise run down into the coat.
            numberOfLines={2}
            style={{
              position: 'absolute',
              right: px(16 + 15),
              top: insets.top + px(6 + 16),
              fontFamily: 'HelveticaNeue-Medium',
              fontSize: px(9.5),
              letterSpacing: px(1.7),
              textTransform: 'uppercase',
              color: captionLight,
              textAlign: 'right',
            }}>
            Today&apos;s set
          </RNText>

          {/* The set's caption, printed over the grid's lower edge — the same
              two facts every plate in the app carries: the look's name, its
              palette, what it costs to wear. Absolute so the sheet can rise
              over the tiles without pushing the caption off them. */}
          <Animated.View
            entering={reduced ? undefined : FadeIn.delay(150).duration(500)}
            pointerEvents="none"
            // Bottom-anchored, so scaled type grows UP into the scrim's dark
            // band rather than down off the grid. The right margin mirrors the
            // left so a wrapped caption never runs under the sheet's corner.
            style={{ position: 'absolute', left: px(31), right: px(31), bottom: px(34) }}>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue-Medium',
                fontSize: px(10.5),
                letterSpacing: px(1.6),
                textTransform: 'uppercase',
                color: warmTan,
              }}>
              The Quiet Monday
            </RNText>
            <RNText
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              style={{
                fontFamily: 'HelveticaNeue',
                fontSize: px(13),
                color: captionLight,
                marginTop: px(4),
              }}>
              Charcoal · cream · slate — $1.20 to wear
            </RNText>
          </Animated.View>
        </View>

        {/* ── The sheet: the promise and the two ways in ── */}
        <Animated.View
          entering={reduced ? undefined : FadeInDown.delay(120).duration(600)}
          style={{
            backgroundColor: cream,
            borderTopLeftRadius: px(24),
            borderTopRightRadius: px(24),
            marginTop: -px(22),
            paddingHorizontal: px(31),
            paddingTop: px(28),
            paddingBottom: Math.max(insets.bottom, px(10)) + px(8),
          }}>
          <RNText
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
            style={{
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: px(29),
              lineHeight: px(34),
              letterSpacing: -0.3,
              color: theme.ink,
            }}>
            Dressed from your{' '}
            <RNText
              style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: theme.accent }}>
              own closet
            </RNText>
            , every morning.
          </RNText>

          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'HelveticaNeue',
              fontSize: px(14),
              lineHeight: px(21),
              color: theme.muted,
              marginTop: px(9),
            }}>
            Weather, your plans, and what you actually wear — Cinch reads all three.
          </RNText>

          <View style={{ marginTop: px(19) }}>
            {mode === 'choose' ? (
              <Animated.View
                entering={reduced ? undefined : FadeIn.duration(220)}
                exiting={reduced ? undefined : FadeOut.duration(140)}>
                {/* Apple's OWN button, not a look-alike. The mock draws an ink
                    pill reading "Continue with Apple" — exactly the BLACK style
                    of AppleAuthenticationButton, so the design is satisfied
                    without a custom control, which Guideline 4.8 / the Sign in
                    with Apple HIG do not permit. */}
                {appleAvailable ? (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={px(26)}
                    // The capsule stays HERE and only here: this is Apple's own
                    // control, drawn to Apple's spec, and the app's labelled
                    // buttons no longer wear the shape. `minHeight` so the
                    // native label — which scales with Dynamic Type and takes
                    // no cap from us — is never clipped by a fixed box.
                    style={{ width: '100%', minHeight: px(50), opacity: busy ? 0.6 : 1 }}
                    onPress={() => {
                      if (!busy) void onApple();
                    }}
                  />
                ) : null}

                <Pressable
                  onPress={() => {
                    setMode('email');
                    setTimeout(() => emailRef.current?.focus(), 260);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with email"
                  style={{
                    // `minHeight`: at a large Dynamic Type setting the label
                    // needs more than the mock's 50 units, and a fixed height
                    // clips it rather than growing.
                    minHeight: px(50),
                    // The 12px button/field radius, carried through the same
                    // `px()` scale as everything else on the screen. A labelled
                    // control is not a capsule — the capsule is reserved for
                    // circles and for Apple's own button above it.
                    borderRadius: px(12),
                    borderWidth: 1,
                    borderColor: theme.rule,
                    marginTop: appleAvailable ? px(11) : 0,
                    paddingHorizontal: px(16),
                    paddingVertical: px(8),
                  }}
                  className="w-full items-center justify-center active:opacity-60">
                  <RNText
                    maxFontSizeMultiplier={MAX_TEXT_SCALE}
                    style={{
                      fontFamily: 'HelveticaNeue-Medium',
                      fontSize: px(14.5),
                      color: theme.ink,
                      textAlign: 'center',
                    }}>
                    Continue with email
                  </RNText>
                </Pressable>
              </Animated.View>
            ) : mode === 'email' ? (
              <Animated.View
                entering={reduced ? undefined : FadeIn.duration(260)}
                exiting={reduced ? undefined : FadeOut.duration(140)}>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={() => void onSendEmail()}
                    placeholder="you@example.com"
                    placeholderTextColor={theme.faint}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    // `emailAddress` scopes iOS AutoFill to email addresses from
                    // the user's own contact card — nothing else. The generic
                    // Passwords / Credit Cards / Addresses key is summoned by
                    // textContentType="username" (defined as "login field") or by
                    // a secureTextEntry sibling on the same screen; neither exists
                    // here, and if a password field is ever added it goes on its
                    // own route. `autoComplete` is inert on iOS when
                    // textContentType is set (RN passes it to Android only) and is
                    // kept for the Android build.
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    accessibilityLabel="Email address"
                    // `minHeight`, not `height`: a fixed height doesn't grow
                    // past its own ceiling, so a larger Dynamic Type setting
                    // (this field carries no `maxFontSizeMultiplier`, unlike
                    // `Text`) renders a taller line than the box allows and
                    // the field's own bounds clip it. `minHeight` keeps the
                    // field exactly px(50) tall at the system default and lets
                    // it grow, never clip, past that.
                    className="flex-1 px-4 font-body text-callout"
                    style={{
                      minHeight: px(50),
                      // The field takes the button's 12px radius, not the
                      // capsule: same control family, same shape.
                      borderRadius: px(12),
                      paddingVertical: px(8),
                      borderWidth: 1,
                      borderColor: theme.rule,
                      color: theme.ink,
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      // The one send on this screen: a selection tick, the same
                      // grain every other commit in the app carries.
                      void Haptics.selectionAsync().catch(() => {});
                      void onSendEmail();
                    }}
                    disabled={busy || !email.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send sign-in link"
                    style={{
                      // A disc, so it keeps its full radius — the shape rule
                      // bans the capsule on LABELLED controls, not on circles.
                      // `minHeight` for the same reason the field has it.
                      minHeight: px(50),
                      width: px(50),
                      borderRadius: px(26),
                      backgroundColor: email.trim() && !busy ? theme.ink : theme.tray,
                    }}
                    className="items-center justify-center active:opacity-60">
                    <SymbolView
                      name="arrow.right"
                      size={18}
                      tintColor={email.trim() && !busy ? theme.canvas : theme.faint}
                      resizeMode="scaleAspectFit"
                    />
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setMode('choose')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="mt-1 items-start justify-center active:opacity-60">
                  <Text variant="label" style={{ color: theme.accent }}>
                    Back
                  </Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(300)}>
                <View className="flex-row items-center gap-2">
                  <SymbolView
                    name="envelope"
                    size={20}
                    tintColor={theme.ink}
                    resizeMode="scaleAspectFit"
                  />
                  <Text variant="heading">Check your email</Text>
                </View>
                <Text variant="callout" style={{ color: theme.muted, marginTop: 6 }}>
                  We sent a sign-in link to {email.trim().toLowerCase()}. Open it on this device
                  to finish signing in.
                </Text>
                {/*
                  The wait state's real failure mode is a link that went to
                  spam, and the old screen's only exit was "use a different
                  address" — which re-types an address that was correct. Name
                  the likely cause, then offer the action that actually fixes
                  it.
                */}
                <Text variant="caption" style={{ color: theme.muted, marginTop: px(8) }}>
                  Nothing yet? Check the spam folder, or send it again.
                </Text>
                <Pressable
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => {});
                    void onSendEmail();
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Send the sign-in link again"
                  style={{
                    minHeight: px(50),
                    borderRadius: px(12),
                    backgroundColor: theme.ink,
                    marginTop: px(14),
                    paddingHorizontal: px(16),
                    paddingVertical: px(8),
                    opacity: busy ? 0.6 : 1,
                  }}
                  className="w-full items-center justify-center active:opacity-60">
                  <RNText
                    maxFontSizeMultiplier={MAX_TEXT_SCALE}
                    style={{
                      fontFamily: 'HelveticaNeue-Medium',
                      fontSize: px(14.5),
                      color: theme.canvas,
                      textAlign: 'center',
                    }}>
                    {busy ? 'Sending…' : 'Send it again'}
                  </RNText>
                </Pressable>
                <Pressable
                  onPress={() => setMode('email')}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="items-center justify-center active:opacity-60">
                  <Text variant="label" style={{ color: theme.accent }}>
                    Use a different address
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Required legal furniture — the mock crops below the buttons, but a
              sign-in screen without Terms and Privacy is a 1.1.6 conversation
              with App Review. Kept quiet, but in `muted`: it is 11px, it is the
              agreement the user is entering, and `faint` on canvas is 3.52:1.
              One sentence, two spans — see LegalLink. */}
          <Text variant="caption" className="mt-3 text-center" style={{ color: theme.muted }}>
            By continuing you agree to our{' '}
            <LegalLink
              label="Terms"
              url={TERMS_URL}
              color={theme.ink}
              pressedColor={theme.accent}
            />{' '}
            and{' '}
            <LegalLink
              label="Privacy Policy"
              url={PRIVACY_URL}
              color={theme.ink}
              pressedColor={theme.accent}
            />
            .
          </Text>
        </Animated.View>
      </KeyboardAvoidingScreen>
    </View>
  );
}
