import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { AVATAR_EDGE } from './avatar';

/**
 * "Move and scale" — the square crop between the picker and the upload.
 *
 * The atlas (E-03) draws this with a Recents grid under the viewport. That
 * grid needs full photo-library access, which this codebase pointedly refuses
 * (see avatar.ts: PHPicker hands over one asset, no permission prompt, no
 * Info.plist key). So selection stays with the system picker and only the
 * crop is ours: pan + pinch inside a screen-width square, a circular mask
 * over it, and "Use photo" rendering the visible square off the ORIGINAL
 * pixels via expo-image-manipulator — never a screenshot of the view.
 *
 * A `Modal` for the same reason the edit sheet is one (see its header
 * comment); it stacks as a page sheet over the edit sheet's own.
 */

export type CropAsset = { uri: string; width: number; height: number };

/** The crop window is the full width of the screen, edge to edge. */
const VIEWPORT = Dimensions.get('window').width;
/** How far the mask circle sits in from each edge of the square (atlas: 36). */
const CIRCLE_INSET = 36;
/** Beyond 5× the source pixels are doing all the work and it only gets softer. */
const MAX_ZOOM = 5;

export function AvatarCropSheet({
  asset,
  onCancel,
  onUse,
}: {
  /** The picked photograph. Null keeps the sheet closed. */
  asset: CropAsset | null;
  onCancel: () => void;
  /** Receives the cropped square, ready for the existing prepare/upload path. */
  onUse: (cropped: CropAsset) => void;
}) {
  return (
    <Modal
      visible={asset !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}>
      {/* Keyed on the uri so a different photograph mounts a fresh stage —
          shared values reset by construction instead of by effect. */}
      {asset ? <CropStage key={asset.uri} asset={asset} onCancel={onCancel} onUse={onUse} /> : null}
    </Modal>
  );
}

function CropStage({
  asset,
  onCancel,
  onUse,
}: {
  asset: CropAsset;
  onCancel: () => void;
  onUse: (cropped: CropAsset) => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // "Cover" fit: the short edge fills the viewport exactly at scale 1, so the
  // clamp below can never expose canvas inside the crop window.
  const fit = VIEWPORT / Math.min(asset.width, asset.height);
  const fitW = asset.width * fit;
  const fitH = asset.height * fit;

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const panStart = useSharedValue({ x: 0, y: 0 });
  const pinchStart = useSharedValue({ scale: 1, x: 0, y: 0 });

  // Clamped in onUpdate rather than sprung back on release: the image simply
  // never leaves the window, which is the promise the mask is making. The
  // clamp covers the full square, which necessarily covers the circle inside
  // it — and the square is what actually gets cropped.
  const pan = Gesture.Pan()
    .onStart(() => {
      panStart.value = { x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      const maxX = (fitW * scale.value - VIEWPORT) / 2;
      const maxY = (fitH * scale.value - VIEWPORT) / 2;
      tx.value = Math.min(maxX, Math.max(-maxX, panStart.value.x + e.translationX));
      ty.value = Math.min(maxY, Math.max(-maxY, panStart.value.y + e.translationY));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStart.value = { scale: scale.value, x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, pinchStart.value.scale * e.scale));
      // Scaling the translation by the same ratio keeps the image point at
      // the viewport's centre fixed while zooming, which is what a pinch
      // feels like it should do even without focal-point maths.
      const ratio = next / pinchStart.value.scale;
      const maxX = (fitW * next - VIEWPORT) / 2;
      const maxY = (fitH * next - VIEWPORT) / 2;
      scale.value = next;
      tx.value = Math.min(maxX, Math.max(-maxX, pinchStart.value.x * ratio));
      ty.value = Math.min(maxY, Math.max(-maxY, pinchStart.value.y * ratio));
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  /**
   * Map the viewport back onto the original pixels and crop there.
   *
   * `k` is displayed pixels per image pixel, so the square window covers
   * `VIEWPORT / k` image pixels, centred on the image point currently under
   * the viewport's centre (the image centre, shifted back by the translation).
   * Rounded and clamped for float safety — the gesture clamp already keeps
   * the window inside the image.
   */
  const commitCrop = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const k = fit * scale.value;
      const cropSize = Math.min(Math.round(VIEWPORT / k), asset.width, asset.height);
      const originX = Math.round(
        Math.min(Math.max(asset.width / 2 - tx.value / k - cropSize / 2, 0), asset.width - cropSize),
      );
      const originY = Math.round(
        Math.min(Math.max(asset.height / 2 - ty.value / k - cropSize / 2, 0), asset.height - cropSize),
      );

      let context = ImageManipulator.manipulate(asset.uri).crop({
        originX,
        originY,
        width: cropSize,
        height: cropSize,
      });
      // Down to the stored edge here, at full quality; never upscaled. The
      // save pipeline's prepareAvatar then sees a square already at size and
      // applies the one lossy compression.
      if (cropSize > AVATAR_EDGE) {
        context = context.resize({ width: AVATAR_EDGE, height: AVATAR_EDGE });
      }
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });

      const edge = Math.min(cropSize, AVATAR_EDGE);
      onUse({ uri: saved.uri, width: edge, height: edge });
    } catch {
      // The old photo stays — nothing has been picked until onUse fires —
      // and the sheet says so rather than closing over a silent failure.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const radius = VIEWPORT / 2 - CIRCLE_INSET;
  const cx = VIEWPORT / 2;
  // The dim is a full square with the circle subtracted (evenodd): one path,
  // no four-rectangle seams. Ink at 55% per the atlas — derived from the
  // token, not retyped.
  const maskPath =
 `M0 0H${VIEWPORT}V${VIEWPORT}H0Z` +
 `M${cx - radius} ${cx}a${radius} ${radius} 0 1 0 ${radius * 2} 0` +
 `a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Gesture handlers do not see touches inside a nested Modal without
          their own root view. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Back · title · Use photo — the edit sheet's header grammar. */}
        <View className="flex-row items-center px-gutter pb-2 pt-2">
          <View className="flex-1 items-start">
            <Pressable
              onPress={onCancel}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Back"
              accessibilityState={{ disabled: busy }}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className={`active:opacity-60 ${busy ? 'opacity-30' : ''}`}>
              <Text variant="label" style={{ fontSize: 15, lineHeight: 20 }} className="text-muted">
                Back
              </Text>
            </Pressable>
          </View>
          <Text variant="plate" style={{ fontSize: 20, lineHeight: 26 }} accessibilityRole="header">
            Move and scale
          </Text>
          <View className="flex-1 items-end">
            <Pressable
              onPress={() => void commitCrop()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Use photo"
              accessibilityState={{ disabled: busy, busy }}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className={`active:opacity-60 ${busy ? 'opacity-30' : ''}`}>
              <Text variant="label" style={{ fontSize: 15, lineHeight: 20, color: theme.accent }}>
                {busy ? 'Cropping…' : 'Use photo'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* The crop window. VoiceOver cannot pan or pinch, so the default
            framing (centre of the photo, fitted) is a complete answer for it
            and "Use photo" needs no gesture to be pressed. */}
        <View
          accessible
          accessibilityLabel="Photo crop. Drag to reposition, pinch to zoom."
          style={{ width: VIEWPORT, height: VIEWPORT, backgroundColor: theme.ink, overflow: 'hidden' }}>
          <GestureDetector gesture={gesture}>
            <Animated.View
              collapsable={false}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={[{ width: fitW, height: fitH }, imageStyle]}>
                <Image
                  source={{ uri: asset.uri }}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={VIEWPORT} height={VIEWPORT}>
              {/* 8C ≈ 55%, D9 ≈ 85% — alpha suffixes on the theme's own hexes. */}
              <Path d={maskPath} fill={`${theme.ink}8C`} fillRule="evenodd" />
              <Circle cx={cx} cy={cx} r={radius} stroke={`${theme.canvas}D9`} strokeWidth={1.5} fill="none" />
            </Svg>
            <Text
              variant="noteSmall"
              className="absolute bottom-3 left-0 right-0 text-center"
              style={{ color: `${theme.canvas}CC` }}>
              Drag to reposition · pinch to zoom
            </Text>
          </View>
        </View>

        {failed ? (
          <Text
            variant="noteSmall"
            accessibilityLiveRegion="polite"
            className="mt-3 px-gutter"
            style={{ color: theme.accent }}>
            That didn&rsquo;t work. Your old photo is untouched — try again.
          </Text>
        ) : null}
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}
