import { Asset } from 'expo-asset';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { selectActiveCount, type UploadJob } from '@/features/ingest/queue-store';
import { useTheme } from '@/theme/tokens';

/**
 * Capture fixture — `cinch://dev-capture`.
 *
 * Renders the two Capture states the handoff shows, signed-out, so the dark
 * stage can be judged without a session, a real camera roll, or a live upload
 * queue. Everything is hardcoded — no `use-capture`, `queue-store`, or consent
 * hooks — so it runs with no auth.
 *
 *   07a · Capturing & processing — the dark viewfinder stage, the Library ·
 *         shutter · spacer control row, and the light progress sheet driven by
 *         a mock queue (2 added, 1 cleaning, 2 queued). The sheet's numbers and
 *         thumbnail row are computed and rendered exactly as capture.tsx does.
 *   07b · First-run consent — a static replica of the consent moment (the real
 *         `ConsentSheet` is a full-screen Modal and cannot be stacked inline).
 *
 * Dev-only, like dev-closet / dev-screens: __DEV__-gated by the `dev-` prefix in
 * the auth gate. Kept visually in step with src/app/capture.tsx.
 */

// The mock queue for 07a: finished pieces sit left, what's still coming reads to
// the right — the same front-to-back order the real queue works in.
const ART = [
  require('@/assets/plates/plate-01-coat.svg'),
  require('@/assets/plates/plate-01-knit.svg'),
  require('@/assets/plates/plate-01-trousers.svg'),
  require('@/assets/plates/plate-01-shoes.svg'),
  require('@/assets/plates/plate-01-scarf.svg'),
];

const STAGES: UploadJob['stage'][] = ['done', 'done', 'cutout', 'queued', 'queued'];

/** One L of the framing guide. Light lines on the dark stage, per the design. */
function Corner({ canvas, pos }: { canvas: string; pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const edges = {
    tl: { top: 20, left: 20, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
    tr: { top: 20, right: 20, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
    bl: { bottom: 20, left: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
    br: { bottom: 20, right: 20, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  } as const;
  return (
    <View
      style={{ position: 'absolute', width: 22, height: 22, borderColor: canvas, opacity: 0.55, ...edges[pos] }}
    />
  );
}

/** A ✧ bullet in a small warm circle — the consent sheet's promise rows. */
function ConsentRow({ accent, children }: { accent: string; children: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-[26px] w-[26px] items-center justify-center rounded-full bg-tray">
        <SymbolView name="sparkle" size={13} tintColor={accent} resizeMode="scaleAspectFit" />
      </View>
      <Text variant="callout" className="flex-1">
        {children}
      </Text>
    </View>
  );
}

export default function DevCaptureScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();

  const jobs = useMemo<UploadJob[]>(
    () =>
      ART.map((mod, i) => ({
        id: `mock-${i}`,
        localUri: Asset.fromModule(mod).uri,
        width: 1200,
        height: 1500,
        stage: STAGES[i],
        attempts: 0,
        progress: STAGES[i] === 'done' ? 1 : 0,
      })),
    [],
  );

  // Progress is derived exactly as capture.tsx derives it, so the fixture is an
  // honest mirror: the bar tracks completed pieces, "N to go" counts everything
  // still queued or in flight.
  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const active = selectActiveCount(jobs);
  const fraction = total ? doneCount / total : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      {/* The stage is the one dark screen in a light-only app; the global dark-
          on-light status bar would vanish here, so force it light. */}
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── 07a · Capturing & processing ─────────────────────────────────── */}
        <View style={{ height: winHeight - insets.top }} className="bg-ink">
          <View className="flex-row items-center justify-between px-gutter pt-1">
            <Text variant="heading" style={{ color: theme.canvas }}>
              Add clothes
            </Text>
            <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
              Close
            </Text>
          </View>

          {/* The framed viewfinder — a frame and a rule of thumb, not a live
              preview: the real capture runs in the system camera/picker. */}
          <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
            <View className="absolute inset-0 bg-surface" style={{ opacity: 0.04 }} />
            <Corner canvas={theme.canvas} pos="tl" />
            <Corner canvas={theme.canvas} pos="tr" />
            <Corner canvas={theme.canvas} pos="bl" />
            <Corner canvas={theme.canvas} pos="br" />
            <View style={{ opacity: 0.5 }}>
              <SymbolView name="tshirt" size={44} tintColor={theme.canvas} />
            </View>
            <Text
              variant="caption"
              className="absolute"
              style={{ bottom: 22, color: theme.canvas, opacity: 0.75 }}>
              One garment, plain background
            </Text>
          </View>

          {/* Library · shutter · spacer. "Flip" has no function without an in-app
              live preview, so the right slot is an empty spacer that keeps the
              shutter centred. */}
          <View className="flex-row items-center justify-between px-8 py-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Choose from library" className="w-16 py-2">
              <Text variant="label" style={{ color: theme.canvas }}>
                Library
              </Text>
            </Pressable>

            <View
              className="items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: theme.canvas }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.canvas }} />
            </View>

            <View className="w-16" />
          </View>

          {/* The progress sheet — bg-surface, rounded top, flush to the bottom. */}
          <View className="rounded-t-plate bg-surface px-5 pt-4" style={{ paddingBottom: insets.bottom + 20 }}>
            <View className="flex-row items-baseline justify-between">
              <Text variant="stat">{`Processing ${Math.min(doneCount + 1, total)} of ${total}`}</Text>
              <Text variant="caption" style={{ color: theme.faint }}>{`${active} to go`}</Text>
            </View>

            <View className="my-3 h-1.5 overflow-hidden rounded-full bg-sand">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </View>

            <UploadQueueList jobs={jobs} />

            <Button title="Review tags" variant="secondary" onPress={() => {}} className="mt-4" />
          </View>
        </View>

        {/* ── 07b · First-run consent ──────────────────────────────────────── */}
        <View style={{ height: winHeight }} className="bg-ink">
          {/* The dark camera scrim behind the sheet. */}
          <View className="flex-1 items-center justify-center">
            <Text variant="caption" style={{ color: theme.canvas, opacity: 0.45 }}>
              First-run consent
            </Text>
          </View>

          <View className="rounded-t-plate bg-canvas px-6 pt-5" style={{ paddingBottom: insets.bottom + 20 }}>
            <View className="mb-5 h-1 w-[38px] self-center rounded-full bg-rule" />

            <Text variant="title">Before Cinch looks</Text>
            <Text variant="body" className="mt-3" style={{ color: theme.muted }}>
              To turn your photos into a wardrobe, Cinch processes each image. Here&apos;s exactly what
              that means.
            </Text>

            <View className="mb-6 mt-5 gap-3.5">
              <ConsentRow accent={theme.accent}>Cleans up the photo — removes the background</ConsentRow>
              <ConsentRow accent={theme.accent}>Identifies the garment, its colours and category</ConsentRow>
              <ConsentRow accent={theme.accent}>Never sold, never shared, never used to advertise</ConsentRow>
            </View>

            {/* The consent CTA is ink here, not oxblood: this first-run moment is
                the one screen where the primary action is the neutral dark
                button the handoff shows. */}
            <Pressable
              accessibilityRole="button"
              className="items-center justify-center rounded-full bg-ink active:opacity-80"
              style={{ paddingVertical: 15 }}>
              <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                Allow processing
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" className="items-center justify-center py-3 active:opacity-60">
              <Text variant="body" className="font-semibold" style={{ color: theme.muted }}>
                Not now
              </Text>
            </Pressable>

            <Text variant="caption" className="mt-2 text-center" style={{ color: theme.faint }}>
              You can turn AI features off anytime in Profile.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
