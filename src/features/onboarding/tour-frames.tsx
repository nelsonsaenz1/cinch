import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Button, EditorialFrame, Text } from '@/components/ui';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { formatTemp } from '@/features/context/weather';
import {
  TOUR_FRAMES,
  TOUR_SAMPLE_FEELS_C,
  TOUR_SAMPLE_SKY,
  TOUR_SAMPLE_WEEKDAY,
  type TourFrame,
} from '@/features/onboarding/tour-copy';
import { isLastFrame } from '@/features/onboarding/tour-state';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The three spreads of the first-run tour (TR-01…TR-03), drawn once and used
 * by both the real route (`src/app/tour.tsx`) and the dev route
 * (`src/app/dev-tour.tsx`) — so what a reviewer looks at is the screen, not a
 * redrawing of it.
 *
 * Nothing here raises a permission dialog, reads the camera, or asks for a
 * location. The tour is three pages of print: the camera and the weather are
 * *pictured*, and the real prompts are raised later by the screens that need
 * them. This is the atlas's most absolute rule and the illustrations below are
 * how it is kept.
 */

/** The same bundled, licensed sample garments the Today empty state draws. */
const TROUSERS = require('@/assets/garments/charcoal-tailored-trousers.jpg');
const BLOUSE = require('@/assets/garments/white-linen-blouse.jpg');
const LOAFERS = require('@/assets/garments/brown-leather-loafers.jpg');
const SKIRT = require('@/assets/garments/beige-corduroy-skirt.jpg');

/** The app's units. Same constant, same value, as `stylist.tsx`. */
const UNITS = 'F' as const;

/**
 * A tile of the tray, with a sample garment in it — the atlas's `#F0ECE3`
 * square, which is `tray`.
 */
function SampleTile({ source, size, radius }: { source: number; size?: number; radius: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        flex: size == null ? 1 : undefined,
        aspectRatio: size == null ? 1 : undefined,
        borderRadius: radius,
        backgroundColor: theme.tray,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Image
        source={source}
        contentFit="contain"
        transition={0}
        style={{ width: '84%', height: '84%' }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** TR-01 — three pieces of a closet, side by side under the promise. */
function ClosetPlate() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Sample closet: tailored trousers, a linen blouse and penny loafers. Sample data."
      style={{ marginTop: 28, flexDirection: 'row', gap: 10 }}>
      <SampleTile source={TROUSERS} radius={10} />
      <SampleTile source={BLOUSE} radius={10} />
      <SampleTile source={LOAFERS} radius={10} />
    </View>
  );
}

/**
 * TR-02 — the transformation, photograph to plate. A picture of a shutter,
 * not a viewfinder: the tour never opens the camera and never asks for it.
 */
function TransformationPlate() {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="One photograph becomes one filed piece. Sample data."
      style={{ marginTop: 30, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      <View
        style={{
          width: 120,
          height: 150,
          borderRadius: 12,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.rule,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: 74,
            height: 74,
            borderRadius: 37,
            borderWidth: 2,
            borderColor: theme.rule,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.ink }} />
        </View>
      </View>

      {/* The pointing arrow is a graphic, not text — `byline` is exactly the
          token for it (see tokens.ts: "pointing chevrons"). It carries no
          content, so the contrast floor that governs `faint`/`byline` as TEXT
          does not apply; the sentence it illustrates is in the body above. */}
      <Svg width={26} height={14} viewBox="0 0 26 14" fill="none">
        <Path
          d="M1 7h22"
          stroke={theme.byline}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Path
          d="M18 2.5 23.5 7 18 11.5"
          stroke={theme.byline}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>

      <SampleTile source={BLOUSE} size={120} radius={8} />
    </View>
  );
}

/** TR-03 — the page the habit produces, in miniature. */
function MorningPlate() {
  const theme = useTheme();
  const line = `${TOUR_SAMPLE_WEEKDAY} · ${formatTemp(TOUR_SAMPLE_FEELS_C, UNITS)} ${TOUR_SAMPLE_SKY}`;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`A sample morning page: ${line}, with a linen blouse, a corduroy skirt and penny loafers. Sample data.`}
      style={{
        marginTop: 30,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.rule,
        borderRadius: 16,
        padding: 16,
      }}>
      {/* The atlas sets this caption in #A29C90 — `byline`, which is ~2.4:1 on
          white and an AA failure the moment it carries words. It carries the
          weather, so it is `colophon`'s `muted`. Same standing refusal that
          keeps `faint` out of text, one step further down the same ladder. */}
      <Text variant="colophon" maxFontSizeMultiplier={1}>
        {line}
      </Text>
      <View
        style={{ marginTop: 12, flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
        <SampleTile source={BLOUSE} size={78} radius={8} />
        <SampleTile source={SKIRT} size={78} radius={8} />
        <SampleTile source={LOAFERS} size={78} radius={8} />
      </View>
    </View>
  );
}

function Plate({ frame }: { frame: TourFrame }) {
  if (frame.plate === 'closet') return <ClosetPlate />;
  if (frame.plate === 'transformation') return <TransformationPlate />;
  return <MorningPlate />;
}

/**
 * The primary action on the ink ground — canvas pill, ink label.
 *
 * The shared `Button` has no inverse variant: `primary` is oxblood (which
 * would also spend this screen's one accent on a "Next"), `ink` disappears
 * into the ground, and `secondary`'s rule-coloured outline is invisible on it.
 * Filed as a primitive request; this is the work-around, and it is built the
 * way the Today empty state's inline pill is — a `Pressable` carrying only
 * OBJECT styles. Never a `className` plus a function `style`: that combination
 * renders nothing at all.
 */
function InversePill({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  const press = usePressFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Animated.View
        style={[
          {
            minHeight: MIN_TAP_TARGET,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 20,
            backgroundColor: theme.canvas,
          },
          press.style,
        ]}>
        <Text variant="body" className="font-semibold" style={{ color: theme.ink }}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Skip — quiet, top-right, on every frame but the last. */
function SkipAction({ onPress, dark }: { onPress: () => void; dark: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip the tour"
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', paddingHorizontal: 4 }}>
      <Text
        variant="callout"
        style={{ color: dark ? 'rgba(251,250,246,0.62)' : theme.muted }}>
        Skip
      </Text>
    </Pressable>
  );
}

/**
 * The three-dot length indicator. Three frames, and the reader can see where
 * they are — the same job the spelled-out eyebrow does, said again in a glance.
 */
function Dots({ index, dark }: { index: number; dark: boolean }) {
  const theme = useTheme();
  const on = dark ? theme.canvas : theme.ink;
  const off = dark ? 'rgba(251,250,246,0.3)' : 'rgba(28,26,22,0.22)';
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Frame ${index + 1} of ${TOUR_FRAMES.length}`}
      style={{ flexDirection: 'row', gap: 5, justifyContent: 'center', paddingTop: 2 }}>
      {TOUR_FRAMES.map((f, i) => (
        <View
          key={f.id}
          style={{
            width: i === index ? 18 : 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: i === index ? on : off,
          }}
        />
      ))}
    </View>
  );
}

/** The text secondary. Text, never a second button — the atlas is explicit. */
function SecondaryAction({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', paddingHorizontal: 8 }}>
      <Text variant="callout" style={{ color: theme.muted }}>
        {title}
      </Text>
    </Pressable>
  );
}

export type TourFrameHandlers = {
  /** TR-01/TR-02's "Next". */
  onNext: () => void;
  /** Skip, from either of the first two frames. Lands on TR-04. */
  onSkip: () => void;
  /** TR-03's "Start with the camera". */
  onCamera: () => void;
  /** TR-03's "I'll look around first". Lands on TR-04. */
  onLookAround: () => void;
};

/**
 * One spread of the tour, by index.
 *
 * Everything about a frame that differs — ground, plate, whether Skip is
 * there, which pair of exits the foot carries — is read from `tour-copy.ts`,
 * so a change to the deck is a change to one array and not to this file.
 */
export function TourFrameView({
  frame,
  index,
  onNext,
  onSkip,
  onCamera,
  onLookAround,
}: { frame: TourFrame; index: number } & TourFrameHandlers) {
  const dark = frame.ground === 'ink';
  const last = isLastFrame(index);

  return (
    <EditorialFrame
      eyebrow={frame.eyebrow}
      headline={frame.headline}
      body={frame.body}
      ground={frame.ground}
      corner={frame.skippable ? <SkipAction onPress={onSkip} dark={dark} /> : undefined}
      action={
        dark ? (
          <InversePill title={frame.action} onPress={onNext} />
        ) : (
          // `ink`, not `primary`: the workhorse fill. The tour's one oxblood is
          // spent nowhere — there is no accent action on any of the three
          // frames, which is what the atlas draws.
          <Button
            title={frame.action}
            variant="ink"
            onPress={last ? onCamera : onNext}
            className="self-stretch"
          />
        )
      }
      secondary={
        <View style={{ alignSelf: 'stretch' }}>
          {frame.secondary ? (
            <View style={{ alignItems: 'center' }}>
              <SecondaryAction title={frame.secondary} onPress={onLookAround} />
            </View>
          ) : null}
          <Dots index={index} dark={dark} />
        </View>
      }
    >
      <Plate frame={frame} />
    </EditorialFrame>
  );
}
