import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text as RNText, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas, MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/components/auth/chrome';
import { greetingForHour } from '@/features/auth/greeting';
import { supabase } from '@/lib/supabase';

const HANDOFF_PHOTO = require('../../../assets/garments/cream-mohair-sweater.jpg');

/** New accounts get the longer beat — the line is a promise, let it land. */
const NEW_BEAT_MS = 1900;
const RETURNING_BEAT_MS = 1400;
const REDUCED_BEAT_MS = 900;

/**
 * W-14 — session written, then a held beat before the app. The root gate
 * exempts this route (and /name) from its signed-in redirect so the flow can
 * finish here before replacing to the tabs.
 */
export default function HandoffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ isNew?: string; name?: string }>();
  const isNew = params.isNew === '1';

  // The name usually rides in on the route params. When it does not — the
  // root gate routed here on the session write, an Apple sign-in whose
  // metadata is still settling — ask the session once. A signed-in account
  // with NO name at all is a new email account the flow hasn't finished: it
  // belongs on the name screen (W-13), not here, so it is sent there instead
  // of being greeted namelessly. The beat below waits for this to resolve.
  const [name, setName] = useState<string | null>(params.name?.trim() || null);
  const [resolved, setResolved] = useState(Boolean(params.name?.trim()));
  useEffect(() => {
    if (resolved) return;
    let cancelled = false;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled) return;
        const md = (data.user?.user_metadata ?? {}) as {
          given_name?: string | null;
          full_name?: string | null;
        };
        const found = md.given_name ?? md.full_name?.trim().split(/\s+/)[0] ?? null;
        if (found) {
          setName(found);
          setResolved(true);
        } else {
          router.replace('/(auth)/name');
        }
      })
      .catch(() => {
        // Can't read the user — greet namelessly rather than strand the flow.
        if (!cancelled) setResolved(true);
      });
    return () => {
      cancelled = true;
    };
    // Once, on mount — the greeting must not re-render mid-beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The progress sweep: #E2B79C filling left to right, then the app. Under
  // Reduce Motion the bar is simply full and the beat shorter — no sweep.
  // Armed only once the greeting is resolved, so a redirect to the name
  // screen never races the timer.
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!resolved) return;
    const beat = reduced ? REDUCED_BEAT_MS : isNew ? NEW_BEAT_MS : RETURNING_BEAT_MS;
    if (!reduced) progress.value = withTiming(1, { duration: beat - 150 });
    const id = setTimeout(() => router.replace('/(tabs)'), beat);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const greeting = greetingForHour(new Date().getHours());
  const headline = isNew ? greeting : 'Welcome back';

  return (
    <View style={{ flex: 1, backgroundColor: atlas.coverBase }}>
      <StatusBar style="light" />
      <Image
        source={HANDOFF_PHOTO}
        contentFit="cover"
        transition={0}
        blurRadius={14}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: [{ scale: 1.1 }],
        }}
        accessibilityIgnoresInvertColors
      />
      <Canvas pointerEvents="none" style={{ position: 'absolute', width, height }}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={['rgba(23,18,14,0.80)', 'rgba(23,18,14,0.86)']}
          />
        </Rect>
      </Canvas>

      <View
        style={{
          position: 'absolute',
          left: 34,
          right: 34,
          top: insets.top + 96,
          // Until the greeting resolves this frame may yet redirect to the
          // name screen — hold the dark ground, don't flash a nameless line.
          opacity: resolved ? 1 : 0,
        }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 34,
            lineHeight: 34 * 1.12,
            color: atlas.cream,
          }}>
          {headline}
          {name ? (
            <>
              ,{' '}
              <RNText
                style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', color: atlas.warm }}>
                {name}
              </RNText>
            </>
          ) : null}
          .
        </RNText>
        {isNew ? (
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              marginTop: 10,
              fontFamily: 'HelveticaNeue',
              fontSize: 14,
              lineHeight: 21.5,
              color: 'rgba(243,240,233,0.6)',
            }}>
            Your closet is empty for about ninety more seconds.
          </RNText>
        ) : null}
        <View
          style={{
            marginTop: 24,
            height: 2,
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'rgba(243,240,233,0.18)',
          }}>
          <Animated.View style={[{ height: '100%', backgroundColor: atlas.warm }, fillStyle]} />
        </View>
      </View>
    </View>
  );
}
