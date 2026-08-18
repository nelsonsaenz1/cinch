import { useLocalSearchParams } from 'expo-router';
import { Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraDenied } from '@/components/onboarding/camera-denied';
import { TenBody } from '@/components/onboarding/ten-body';
import { TenMasthead, TroublePlate } from '@/components/onboarding/ten-parts';
import { TenNoRoomNotice } from '@/components/onboarding/ten-no-room-notice';
import { TenRepair } from '@/components/onboarding/ten-repair';
import {
  fixtureT01,
  fixtureT02,
  fixtureT05,
  fixtureT06,
  fixtureT07Repair,
  type TenFixture,
} from '@/components/dev/ten-fixtures';
import { TEN_TITLE } from '@/features/onboarding/ten-copy';
import { PAD, TEN, WELL_RADIUS, tenMeasure } from '@/features/onboarding/ten-spec';

/**
 * DEV ONLY — the one page the redesign-21 fixtures each pose.
 *
 * Deliberately NOT named `dev-*`: everything matching that pattern in this
 * directory is a route, and `tests/dev-route-index.test.ts` requires every one
 * of them to appear in the fixture index. This is a component the routes
 * import, not a frame anybody opens. It is still reached through the `@/` alias
 * — as is every fixture it reads — so a fixture copied alone into `src/app/`
 * for a simulator pass keeps working.
 *
 * Every handler is a no-op on purpose. The real screen's exits open a camera,
 * replace the route and present a paywall placement; a fixture that did any of
 * those would be a frame you can look at exactly once.
 *
 * `?scale=` and `?height=` drive the two recompositions without the OS, which
 * is what makes the accessibility and short-device frames photographable on one
 * simulator.
 */
export const TEN_POSES = [
  'empty',
  'partial',
  'near',
  'complete',
  'settling',
  'swapped',
  'unready',
  'no-room',
  'denied',
  'offline',
  'error',
  'loading',
] as const;

export type TenPose = (typeof TEN_POSES)[number];

const FIXTURE: Record<string, () => TenFixture> = {
  empty: fixtureT01,
  partial: fixtureT02,
  near: fixtureT05,
  complete: fixtureT06,
  settling: fixtureT02,
  swapped: fixtureT06,
  unready: fixtureT07Repair,
  'no-room': fixtureT06,
  denied: fixtureT02,
  offline: fixtureT02,
};

export function TenPoseScreen({ pose }: { pose: TenPose }) {
  const params = useLocalSearchParams<{ scale?: string; height?: string }>();
  const fontScale = Number(params.scale) || 1;
  const height = Number(params.height) || 852;
  const measure = tenMeasure({ fontScale, height });

  if (!__DEV__) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <RNText>Not available.</RNText>
      </SafeAreaView>
    );
  }

  // The two states with no tray behind them are the two the route draws before
  // `slots` exists, so they are posed the same way the route draws them rather
  // than through `TenBody`, which requires a slot list to exist.
  if (pose === 'error' || pose === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View style={{ paddingHorizontal: PAD, paddingTop: 4 }}>
          <TenMasthead title={TEN_TITLE} subtitle={null} measure={measure} />
          {pose === 'error' ? (
            <View style={{ marginTop: 16 }}>
              <TroublePlate
                measure={measure}
                eyebrow="Couldn’t open your tray"
                body="Something went wrong reading what you’ve filed. Your pieces are safe — this is only the read."
                primary={{ label: 'Try again', onPress: () => {} }}
                secondary={{ label: 'Back to Today', onPress: () => {} }}
              />
            </View>
          ) : (
            <View
              style={{
                height: 54,
                marginTop: 16,
                borderRadius: 18,
                backgroundColor: TEN.wellEmpty,
              }}
            />
          )}
          {[0, 1, 2].map((row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 118,
                    borderRadius: WELL_RADIUS,
                    backgroundColor: TEN.wellEmpty,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const { slots, names, images, readiness } = (FIXTURE[pose] ?? fixtureT02)();

  const phase =
    pose === 'settling'
      ? ('settling' as const)
      : pose === 'swapped'
        ? ('swapped' as const)
        : pose === 'unready'
          ? ('unready' as const)
          : pose === 'complete' || pose === 'no-room'
            ? ('ready' as const)
            : ('filling' as const);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <TenBody
        slots={slots}
        phase={phase}
        garmentNames={names}
        imageUris={images}
        // The fourth well is the one being read on the settling pose — the
        // frame's own cell, so the blush ground and the clay rule are checked
        // where they actually appear rather than on a corner.
        settlingId={pose === 'settling' ? 4 : null}
        settlingName={pose === 'settling' ? (names[4] ?? null) : null}
        fontScale={fontScale}
        screenHeight={height}
        banner={
          pose === 'offline' ? (
            <TroublePlate
              measure={measure}
              eyebrow="You’re offline"
              body="Filing a piece needs a connection. What you’ve already filed is here and unchanged; nothing is waiting to send."
              primary={{ label: 'Try again', onPress: () => {} }}
            />
          ) : null
        }
        plates={
          <>
            {pose === 'unready' ? (
              <TenRepair readiness={readiness} measure={measure} onCheckPiece={() => {}} />
            ) : null}
            {pose === 'no-room' ? (
              <TenNoRoomNotice
                slotId={3}
                measure={measure}
                onOpenStorage={() => {}}
                onSeePlans={() => {}}
              />
            ) : null}
          </>
        }>
        {pose === 'denied' ? (
          <View style={{ marginTop: 24 }}>
            <CameraDenied
              filled={4}
              onLibrary={() => {}}
              onSettings={() => {}}
              onVoice={() => {}}
            />
          </View>
        ) : undefined}
      </TenBody>
    </SafeAreaView>
  );
}
