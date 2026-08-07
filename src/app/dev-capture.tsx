import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressTrack } from '@/components/ui/progress-track';
import { Text } from '@/components/ui/text';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import {
  selectActiveCount,
  selectFailedJobs,
  selectPhaseLabel,
  type JobStage,
  type UploadJob,
} from '@/features/ingest/queue-store';
import { useTheme } from '@/theme/tokens';

/**
 * Capture fixture — `cinch://dev-capture`.
 *
 * The Capture State Atlas as one vertically scrolling screen: every rendering
 * the camera stage can produce, hardcoded, signed-out, with no camera session
 * and no real queue. One full-height page per state, labeled with its atlas ID
 * (C-01 … C-12, plus the seven-stage rail strip), so the whole atlas can be
 * judged on-device against docs/design/capture-atlas/.
 *
 * The three fixed bands — header, stage, control row — and the progress sheet
 * carry the exact classes capture.tsx draws them with, and every headline,
 * count and banner below is computed by the same derivations over mock
 * `UploadJob` arrays, so the fixture cannot drift from the real screen. The
 * licensed photographs in assets/garments/ stand in for the live viewfinder
 * and the queue's thumbnails — they are the same pictures the atlas itself
 * renders.
 *
 * Dev-only, like dev-closet and dev-screens: __DEV__-gated by the `dev-`
 * prefix in the auth gate.
 */

// The atlas's own cast, by name. Indexes are stable so a job fixture can say
// which garment it is showing.
const GARMENTS = [
  require('@/assets/garments/cognac-shearling-coat.jpg'),
  require('@/assets/garments/cream-mohair-sweater.jpg'),
  require('@/assets/garments/charcoal-tailored-trousers.jpg'),
  require('@/assets/garments/brown-leather-loafers.jpg'),
  require('@/assets/garments/white-linen-blouse.jpg'),
  require('@/assets/garments/beige-corduroy-skirt.jpg'),
  require('@/assets/garments/cognac-leather-tote.jpg'),
];
const [COAT, KNIT, TROUSERS, LOAFERS, BLOUSE, SKIRT, TOTE] = [0, 1, 2, 3, 4, 5, 6];

/** A queue job as the store would hold it, with only what the rail reads. */
function job(
  id: string,
  art: number,
  stage: JobStage,
  extra?: Partial<Pick<UploadJob, 'label' | 'retryable'>>,
): UploadJob {
  return {
    id,
    localUri: Asset.fromModule(GARMENTS[art]).uri,
    width: 1200,
    height: 1500,
    stage,
    attempts: 0,
    tagAttempts: 0,
    progress: stage === 'done' ? 1 : 0,
    ...extra,
  };
}

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

/** The atlas ID strip above each page's header. */
function AtlasLabel({ id, name }: { id: string; name: string }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-baseline gap-2 px-gutter pt-2">
      <Text variant="caption" style={{ color: theme.canvas, opacity: 0.45 }}>
        {id}
      </Text>
      <Text variant="caption" style={{ color: theme.canvas, opacity: 0.45 }}>
        {name}
      </Text>
    </View>
  );
}

/** Serif `plate` + semibold "Done" — the header every state holds. */
function Header() {
  const theme = useTheme();
  return (
    <View className="flex-row items-center justify-between px-gutter pt-1">
      <Text variant="plate" style={{ color: theme.canvas }}>
        Add clothes
      </Text>
      <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
        Done
      </Text>
    </View>
  );
}

/**
 * The framed stage, per fixture.
 *
 * `photo` stands in for the live viewfinder — a fixture has no camera to run,
 * so a bundled garment photograph fills the well the preview would, with the
 * corner guides and hint drawn over it exactly as capture.tsx draws them over
 * the real scene. `photoBare` is the same well without the furniture, for the
 * consent page: the atlas's C-05 stage sits plain under the scrim.
 * `instructional` is the C-02/C-04 frame; `blocked` is the C-03 canvas plate.
 */
function Stage({ kind }: { kind: 'photo' | 'photoBare' | 'instructional' | 'blocked' }) {
  const theme = useTheme();

  if (kind === 'blocked') {
    return (
      <View className="mx-4 my-2 flex-1 overflow-hidden rounded-plate bg-canvas dark:bg-canvas-dark">
        <EmptyState
          symbol="camera.fill"
          tone="blocked"
          title="Camera access is off"
          body="Cinch can’t show the viewfinder without it. Turn the camera on in Settings, or add clothes from your library instead."
          actionTitle="Open Settings"
          onAction={() => {}}
        />
      </View>
    );
  }

  return (
    <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
      {kind === 'instructional' ? (
        <>
          <View className="absolute inset-0 bg-surface" style={{ opacity: 0.04 }} />
          <View style={{ opacity: 0.5 }}>
            <SymbolView name="tshirt" size={44} tintColor={theme.canvas} />
          </View>
        </>
      ) : (
        <Image
          source={GARMENTS[COAT]}
          contentFit="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityIgnoresInvertColors
        />
      )}
      {kind !== 'photoBare' ? (
        <>
          <Corner canvas={theme.canvas} pos="tl" />
          <Corner canvas={theme.canvas} pos="tr" />
          <Corner canvas={theme.canvas} pos="bl" />
          <Corner canvas={theme.canvas} pos="br" />
          <Text
            variant="label"
            className="absolute"
            style={[
              { bottom: 22, color: theme.canvas, opacity: 0.75 },
              // The warm-ink shadow belongs to the live preview alone; the
              // instructional frame has nothing bright to defend against.
              kind === 'photo'
                ? {
                    textShadowColor: 'rgba(28,26,22,0.55)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                  }
                : null,
            ]}>
            One garment, plain background
          </Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * Library · shutter · Describe. `dimmed` is the not-granted shutter (35%,
 * inert); `shooting` drops the inner disc to 50% — the two states the real
 * row can put the ring in.
 */
function ControlRow({ dimmed, shooting }: { dimmed?: boolean; shooting?: boolean }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center justify-between px-8 py-2">
      <View style={{ minWidth: 64 }} className="py-2">
        <Text variant="label" numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.canvas }}>
          Library
        </Text>
      </View>

      <View
        className="items-center justify-center"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderWidth: 3,
          borderColor: theme.canvas,
          opacity: dimmed ? 0.35 : 1,
        }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: theme.canvas,
            opacity: shooting ? 0.5 : 1,
          }}
        />
      </View>

      <View style={{ minWidth: 64 }} className="items-end py-2">
        <Text variant="label" numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.canvas }}>
          Describe
        </Text>
      </View>
    </View>
  );
}

/** The idle sheet — C-01/C-03's copy, or C-06's declined variant. */
function IdleSheet({ declined }: { declined?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View className="rounded-t-plate bg-surface px-gutter pt-4" style={{ paddingBottom: insets.bottom + 20 }}>
      <Text variant="plate">Photograph your closet</Text>
      {declined ? (
        <View>
          <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
            AI processing is off, so Cinch can&rsquo;t cut out or tag photos yet.
          </Text>
          <Button title="Turn it on" variant="secondary" onPress={() => {}} className="mt-3 self-start" />
        </View>
      ) : (
        <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
          Pick up to 20 photos at a time, or shoot pieces one by one. Cinch cuts out the background
          and tags everything for you.
        </Text>
      )}
    </View>
  );
}

/**
 * The progress sheet, derived from the mock jobs exactly as capture.tsx
 * derives it from the store — same counts, same headline expression, same
 * mount/unmount rules — so a fixture that reads wrong here would read wrong
 * on the real screen too.
 */
function ProgressSheet({
  jobs,
  failureSentence,
}: {
  jobs: UploadJob[];
  /**
   * The banner's one sentence, pinned to the atlas string. The real screen
   * maps `job.error` through `userFacingFailure`; a fixture has no real error
   * to map, and the atlas's sentences are the contract being checked.
   */
  failureSentence?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const failed = selectFailedJobs(jobs);
  const failedCount = failed.length;
  const active = selectActiveCount(jobs);
  const allDone = total > 0 && active === 0;
  const settledCount = doneCount + failedCount;
  // Floored at a sliver, exactly as capture.tsx floors it: an empty track
  // under "Processing 1 of 1" reads as a bar that failed to start.
  const fraction = total ? Math.max(doneCount / total, 0.08) : 0;
  const phase = selectPhaseLabel(jobs);
  const canRetry = failed.some((j) => j.retryable !== false);

  return (
    <View className="rounded-t-plate bg-surface px-gutter pt-4" style={{ paddingBottom: insets.bottom + 20 }}>
      <View className="flex-row items-baseline justify-between">
        <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>
          {allDone
            ? failedCount > 0
              ? `Added ${doneCount} of ${total}`
              : 'All added'
            : `Processing ${Math.min(settledCount + 1, total)} of ${total}${phase ? ` · ${phase}` : ''}`}
        </Text>
        {!allDone ? (
          <Text variant="label" style={{ color: theme.faint }}>{`${active} to go`}</Text>
        ) : failedCount > 0 ? (
          <Text variant="label" style={{ color: theme.critical }}>
            {`${failedCount} couldn’t be added`}
          </Text>
        ) : null}
      </View>

      {allDone ? (
        <View className="mt-3" />
      ) : (
        <ProgressTrack value={fraction} tone="ink" height={6} className="my-3" />
      )}

      <UploadQueueList jobs={jobs} />

      {failedCount > 0 ? (
        <View className="mt-3 rounded-plate bg-warning/15 px-3 py-2.5">
          <Text variant="colophon" style={{ color: theme.muted }}>
            {failedCount === 1 ? '1 piece stopped' : `${failedCount} pieces stopped`}
          </Text>
          <Text variant="label" className="mt-1" style={{ color: theme.ink }}>
            {failureSentence}
          </Text>
          <View className="mt-2.5 flex-row items-center gap-2">
            {canRetry ? <Button title="Try these again" variant="secondary" onPress={() => {}} /> : null}
            <Button title="Leave them untagged" variant="ghost" onPress={() => {}} />
          </View>
        </View>
      ) : null}

      {doneCount > 0 ? (
        <Button
          title="Review tags"
          variant={allDone && !(failedCount > 0 && canRetry) ? 'ink' : 'secondary'}
          onPress={() => {}}
          className="mt-4"
        />
      ) : null}
    </View>
  );
}

/**
 * Inline replica of `ConsentSheet` over the dimmed stage. The real one is a
 * full-screen Modal and cannot be stacked inside a scrolling atlas, so its
 * exact furniture is redrawn here — grabber, title, the three ✦ promise rows,
 * the ink primary at `rounded-md`, the ghost decline, the Profile footnote.
 * Kept in step with consent-sheet.tsx by hand.
 */
function ConsentReplica() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const promises = [
    'Cleans up the photo — removes the background',
    'Identifies the garment, its colours and category',
    'Never sold, never shared, never used to advertise',
  ];

  return (
    <View
      className="absolute inset-0 justify-end"
      style={{ backgroundColor: theme.scrim }}
      pointerEvents="none">
      <View className="rounded-t-plate bg-canvas dark:bg-canvas-dark">
        <View className="items-center pb-1 pt-2.5">
          <View className="h-[5px] w-9 rounded-full bg-sand dark:bg-sand-dark" />
        </View>

        <View className="px-gutter pt-5" style={{ paddingBottom: insets.bottom + 16 }}>
          <Text variant="title" trim>
            Before Cinch looks
          </Text>
          <Text variant="body" className="mt-3" style={{ color: theme.muted }}>
            To turn your photos into a wardrobe, Cinch processes each image. Here&apos;s exactly what
            that means.
          </Text>

          <View className="mt-7 gap-4">
            {promises.map((line) => (
              <View key={line} className="flex-row items-center gap-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-light">
                  <SymbolView name="sparkle" size={14} tintColor={theme.accent} resizeMode="scaleAspectFit" />
                </View>
                <Text variant="callout" className="flex-1">
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-8 gap-2">
            <View
              style={{ minHeight: 52 }}
              className="items-center justify-center rounded-md bg-ink px-5 py-3 dark:bg-ink-dark">
              <Text variant="callout" className="font-semibold" style={{ color: theme.canvas }}>
                Allow processing
              </Text>
            </View>
            <Button title="Not now" variant="ghost" onPress={() => {}} />
          </View>

          <Text variant="label" className="mt-3 text-center">
            You can turn AI features off anytime in Profile.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function DevCaptureScreen() {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const pageHeight = winHeight - insets.top;

  // The batch fixtures, front-to-back as the queue works: finished pieces on
  // the left, what is still coming to the right. Named exactly as the atlas
  // names them, because a `done` job with no label would render "Added ✓" and
  // the rail's whole point is that a finished piece is named.
  const firstShot = useMemo(() => [job('c08-1', COAT, 'cutout')], []);
  const midBatch = useMemo(
    () => [
      job('c09-1', COAT, 'done', { label: 'Coat' }),
      job('c09-2', KNIT, 'done', { label: 'Knit' }),
      job('c09-3', TROUSERS, 'tagging'),
      job('c09-4', LOAFERS, 'queued'),
      job('c09-5', BLOUSE, 'queued'),
    ],
    [],
  );
  const allAdded = useMemo(
    () => [
      job('c10-1', COAT, 'done', { label: 'Coat' }),
      job('c10-2', KNIT, 'done', { label: 'Knit' }),
      job('c10-3', TROUSERS, 'done', { label: 'Trousers' }),
      job('c10-4', LOAFERS, 'done', { label: 'Loafers' }),
      job('c10-5', BLOUSE, 'done', { label: 'Blouse' }),
    ],
    [],
  );
  const someStopped = useMemo(
    () => [
      job('c11-1', COAT, 'done', { label: 'Coat' }),
      job('c11-2', KNIT, 'done', { label: 'Knit' }),
      job('c11-3', TROUSERS, 'done', { label: 'Trousers' }),
      job('c11-4', LOAFERS, 'failed', { retryable: true }),
      job('c11-5', BLOUSE, 'failed', { retryable: true }),
    ],
    [],
  );
  const stoppedForGood = useMemo(
    () => [
      job('c12-1', SKIRT, 'done', { label: 'Skirt' }),
      job('c12-2', TOTE, 'failed', { retryable: false }),
    ],
    [],
  );
  // Every caption the rail can put under one thumbnail, in stage order.
  const railStrip = useMemo(
    () => [
      job('rail-1', BLOUSE, 'queued'),
      job('rail-2', BLOUSE, 'preparing'),
      job('rail-3', BLOUSE, 'cutout'),
      job('rail-4', BLOUSE, 'uploading'),
      job('rail-5', BLOUSE, 'tagging'),
      job('rail-6', BLOUSE, 'done', { label: 'Blouse' }),
      job('rail-7', BLOUSE, 'failed', { retryable: true }),
    ],
    [],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      {/* The stage is the one dark screen in a light-only app; the global dark-
          on-light status bar would vanish here, so force it light. */}
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* C-01 · granted, nothing shot — the photo well stands in for the
            live viewfinder a fixture cannot run. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-01" name="Granted — live viewfinder, nothing shot yet" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <IdleSheet />
        </View>

        {/* C-03 · blocked — a plate with a route out, not a second prompt.
            Library and Describe stay live; only the shutter dims. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-03" name="Blocked — the path to Settings" />
          <Header />
          <Stage kind="blocked" />
          <ControlRow dimmed />
          <IdleSheet />
        </View>

        {/* C-04 · no preview — the instructional frame, with the shutter LIVE:
            it hands off to the system camera. The atlas crops this state at
            the control row, so no sheet renders below it. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-04" name="No preview — simulator / mount error" />
          <Header />
          <Stage kind="instructional" />
          <ControlRow />
        </View>

        {/* C-05 · first-run consent, over the dimmed stage. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-05" name="First-run consent, over the dimmed stage" />
          <Header />
          <Stage kind="photoBare" />
          <ControlRow />
          <IdleSheet />
          <ConsentReplica />
        </View>

        {/* C-06 · declined this sitting — the consequence stated, with the one
            tap back to the sheet. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-06" name="Declined this sitting" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <IdleSheet declined />
        </View>

        {/* C-08 · first shot — inner disc at 50% while `shooting`. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-08" name="First shot — one on the rail" />
          <Header />
          <Stage kind="photo" />
          <ControlRow shooting />
          <ProgressSheet jobs={firstShot} />
        </View>

        {/* C-09 · mid-batch — the headline counts settled jobs; finished
            pieces are named, in-flight ones show their stage. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-09" name="Mid-batch — five in sequence" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={midBatch} />
        </View>

        {/* C-10 · all added — the track unmounts, "Review tags" is primary. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-10" name="All added — the way on" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={allAdded} />
        </View>

        {/* C-11 · some stopped, retryable — warning wash, one sentence, the
            retry beside the way out. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-11" name="Some stopped — retryable" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet
            jobs={someStopped}
            failureSentence="Saved, but not tagged — the connection dropped."
          />
        </View>

        {/* C-12 · stopped for good — no retry that is guaranteed to
            disappoint; the dismissal alone. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-12" name="Stopped for good — no retry offered" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet
            jobs={stoppedForGood}
            failureSentence="Saved, but not tagged — AI processing is turned off."
          />
        </View>

        {/* The rail — all seven captions one thumbnail can carry, side by
            side on a surface card. */}
        <View style={{ height: pageHeight }} className="justify-center bg-ink">
          <AtlasLabel id="Rail" name="Seven stages, one thumbnail" />
          <View className="mx-4 mt-3 rounded-plate bg-surface p-4">
            <UploadQueueList jobs={railStrip} />
          </View>
          <View style={{ paddingBottom: insets.bottom + 20 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
