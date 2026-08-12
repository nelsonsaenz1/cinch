import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PHOTO } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/** The 55% ink scrim CP-01 sets every piece of chrome on. */
const CHROME_SCRIM = 'rgba(28,26,22,0.55)';

/**
 * CP-01 — camera ready.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · AUDIT 68 — "Close, Done and Describe are regular weight, paper ink on a 55%
 *   scrim rather than filled buttons, so the live garment is the brightest
 *   region of the frame; the only filled element is the shutter, which is the
 *   one thing the screen is for." The serif "Add clothes" title that used to
 *   lead the row is gone.
 * · AUDIT 69 — "the instruction panel is a 132 pt foot holding one sentence and
 *   the control row — a 48 pt library thumb, a 72 pt shutter, a 48 pt Describe
 *   target — instead of a sheet climbing a third of the way up the preview."
 *   The standing sheet under the controls is retired with it.
 * · "Preview 20 r, guide 16 r" — the framing guide is one dashed rectangle at
 *   r16, not four corner marks.
 * · "the progress claim is a count and never a bar" — the session count sits at
 *   the top of the preview, and ZERO IS QUIET: it is absent until something has
 *   actually been filed. This route poses it at the frame's own 3.
 *
 * ── WHY THIS ROUTE POSES THE STAGE INSTEAD OF MOUNTING IT ─────────────────
 *
 * `capture.tsx` mounts a LIVE `CameraView`. A live viewfinder produces different
 * bytes on every frame, which is the one thing a canonical fixture may not do,
 * and in a simulator it produces no bytes at all. So the chrome and the foot are
 * posed here at the shipping geometry, and the preview is filled with the repo's
 * own licensed garment photograph standing in for the scene — the same asset the
 * atlas frame uses. Nothing here is generated or fetched.
 *
 * ONE CONTROL, NOT TWO. The frame draws Close on the left and Done on the right;
 * both leave the stage with the same outcome, so the shipping screen draws one
 * and so does this. Recorded as a deviation in the lane report.
 *
 * DETERMINISM: the count is a literal, the photograph is a bundled asset, and
 * there is no camera session, no clock, no random source and no animation.
 */
export default function DevW3G3Cp01() {
  const theme = useTheme();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const filed = 3;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      <StatusBar style="light" />

      <View className="flex-row items-center justify-end px-gutter pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done adding clothes"
          style={{ minHeight: 44, backgroundColor: CHROME_SCRIM }}
          className="items-center justify-center rounded-md px-3">
          <Text variant="body" style={{ fontSize: 16, color: theme.canvas }}>
            Done
          </Text>
        </Pressable>
      </View>

      {/* The preview, at r20. */}
      <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
        <Image
          source={{ uri: PHOTO.blouse }}
          contentFit="cover"
          style={{ position: 'absolute', inset: 0 }}
          accessibilityIgnoresInvertColors
        />
        {/* The framing guide, at r16 — one dashed rectangle, never four Ls. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            top: 70,
            bottom: 70,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.canvas,
            opacity: 0.42,
          }}
        />
        <View
          className="absolute self-center rounded-md px-3 py-1.5"
          style={{ top: 16, backgroundColor: CHROME_SCRIM }}>
          <Text variant="note" style={{ fontSize: 13, color: theme.canvas }}>
            {`${filed} pieces filed just now`}
          </Text>
        </View>
      </View>

      {/* The 132pt instruction foot. */}
      <View className="justify-center px-gutter" style={{ minHeight: 132 }}>
        <Text
          variant="note"
          className="mb-3.5 text-center"
          style={{ fontSize: 15, lineHeight: 22, color: theme.canvas, opacity: 0.86 }}>
          One piece, laid flat or on a hanger. Any wall will do.
        </Text>
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose from library"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${theme.canvas}4D`,
            }}
            className="items-center justify-center">
            <SymbolView
              name="photo.on.rectangle"
              size={22}
              tintColor={theme.canvas}
              resizeMode="scaleAspectFit"
            />
          </Pressable>

          {/* The only filled element on the stage. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a photograph"
            accessibilityHint="Files this piece and stays open"
            className="items-center justify-center"
            style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.canvas }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                borderWidth: 2,
                borderColor: theme.ink,
              }}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Describe it instead"
            style={{ minWidth: 48, minHeight: 48 }}
            className="items-end justify-center">
            <Text variant="note" style={{ fontSize: 15, color: theme.canvas, opacity: 0.86 }}>
              Describe
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
