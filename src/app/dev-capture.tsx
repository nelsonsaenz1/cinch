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
import { userFacingFailure } from '@/features/ingest/upload-queue';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { DeclineExplainer } from './capture';

/**
 * Capture fixture — `cinch://dev-capture`.
 *
 * The Capture State Atlas as one vertically scrolling screen: every rendering
 * the camera stage can produce, hardcoded, signed-out, with no camera session
 * and no real queue. One full-height page per state, labeled with its atlas ID
 * (C-01 … C-06 for the stage, Q-01 … Q-05 for the queue per the Queue State
 * Atlas, plus the seven-stage rail strip), so the whole atlas can be judged
 * on-device against docs/design/capture-atlas/.
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
  extra?: Partial<Pick<UploadJob, 'label' | 'retryable' | 'error'>>,
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
    bl: {
      bottom: 20,
      left: 20,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderBottomLeftRadius: 4,
    },
    br: {
      bottom: 20,
      right: 20,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderBottomRightRadius: 4,
    },
  } as const;
  return (
    <View
      style={{
        position: 'absolute',
        width: 22,
        height: 22,
        borderColor: canvas,
        opacity: 0.55,
        ...edges[pos],
      }}
    />
  );
}

/** The atlas ID strip above each page's header. Ink on the one light page. */
function AtlasLabel({ id, name, onLight }: { id: string; name: string; onLight?: boolean }) {
  const theme = useTheme();
  const color = onLight ? theme.ink : theme.canvas;
  return (
    <View className="flex-row items-baseline gap-2 px-gutter pt-2">
      <Text variant="caption" style={{ color, opacity: 0.45 }}>
        {id}
      </Text>
      <Text variant="caption" style={{ color, opacity: 0.45 }}>
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
        <Text
          variant="label"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: theme.canvas }}>
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
        <Text
          variant="label"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ color: theme.canvas }}>
          Describe
        </Text>
      </View>
    </View>
  );
}

/** The idle sheet — C-01/C-03's copy, or the honest local-mode line (C-06b). */
function IdleSheet({ local }: { local?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="rounded-t-plate bg-surface px-gutter pt-4"
      style={{ paddingBottom: insets.bottom + 20 }}>
      <Text variant="plate">Photograph your closet</Text>
      <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
        {local
          ? 'Pick up to 60 photos at a time, or shoot pieces one by one. Photos stay on this phone, and the tags are yours to write.'
          : 'Pick up to 60 photos at a time, or shoot pieces one by one. Cinch cuts out the background and tags everything for you.'}
      </Text>
    </View>
  );
}

/**
 * The progress sheet, derived from the mock jobs exactly as capture.tsx
 * derives it from the store — same counts, same headline expression, same
 * mount/unmount rules — so a fixture that reads wrong here would read wrong
 * on the real screen too.
 */
function ProgressSheet({ jobs }: { jobs: UploadJob[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const failed = selectFailedJobs(jobs);
  const failedCount = failed.length;
  const active = selectActiveCount(jobs);
  const allDone = total > 0 && active === 0;
  // Everything the queue has finished arguing about, added or not — the
  // ordinal counts these rather than the successes alone, exactly as
  // capture.tsx counts them.
  const settledCount = doneCount + failedCount;
  // Filled by settled jobs, floored at a sliver, pinned to full on settle —
  // capture.tsx's fraction, verbatim. The floor must never lie about a
  // finished batch, and an empty track under "Processing 1 of 5" reads as a
  // bar that failed to start.
  const fraction = total ? (allDone ? 1 : Math.max(settledCount / total, 0.04)) : 0;
  const phase = selectPhaseLabel(jobs);
  const canRetry = failed.some((j) => j.retryable !== false);

  return (
    <View
      className="rounded-t-plate bg-surface px-gutter pt-4"
      style={{ paddingBottom: insets.bottom + 20 }}>
      <View className="flex-row items-baseline justify-between">
        {/* Settled reads "Added N of N" even when N is the whole batch — the
            count of what was achieved, never "All added". */}
        <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>
          {allDone
            ? `Added ${doneCount} of ${total}`
            : `Processing ${Math.min(settledCount + 1, total)} of ${total}${phase ? ` · ${phase}` : ''}`}
        </Text>
        {/* Once settled, nothing rides here: a failure count already leads the
            banner below as its eyebrow, and saying it twice is nagging. */}
        {!allDone ? (
          <Text variant="label" style={{ color: theme.faint }}>{`${active} to go`}</Text>
        ) : null}
      </View>

      {/* Stays mounted when the batch settles, pinned to full — the finished
          bar is part of the record, not scaffolding to strike. */}
      <ProgressTrack value={fraction} tone="ink" height={6} className="my-3" />

      <UploadQueueList jobs={jobs} />

      {failedCount > 0 ? (
        <View className="mt-3 rounded-plate bg-warning/15 px-3 py-2.5">
          <Text variant="colophon" style={{ color: theme.muted }}>
            {failedCount === 1 ? '1 piece stopped' : `${failedCount} pieces stopped`}
          </Text>
          {/* The mapped sentence, not the raw `job.error` — the mock job
              carries a diagnostic string and `userFacingFailure` reduces it,
              exactly as the real banner does. */}
          <Text variant="label" className="mt-1" style={{ color: theme.ink }}>
            {userFacingFailure(failed[0])}
          </Text>
          <View className="mt-2.5 flex-row items-center gap-2">
            {canRetry ? <Button title="Try again" variant="ink" onPress={() => {}} /> : null}
            <Button title="Leave them untagged" variant="ghost" onPress={() => {}} />
          </View>
        </View>
      ) : null}

      {/* `ink`, always, and only once the batch has settled — mid-batch the
          sheet shows no button at all, because the way onward is a verdict on
          the whole batch, not a shortcut past it. */}
      {allDone && doneCount > 0 ? (
        <Button title="Review tags" variant="ink" onPress={() => {}} className="mt-4" />
      ) : null}
    </View>
  );
}

/**
 * Inline replica of `ConsentSheet` over the dimmed stage — frame A-01. The
 * real one is a full-screen Modal and cannot be stacked inside a scrolling
 * atlas, so its exact furniture is redrawn here: grabber, eyebrow, serif
 * title, the four hairline-ruled numbered facts, the ink accept over the
 * outlined decline (two equal ways forward, neither ghosted), and the
 * Settings footnote with the policy link. Kept in step with
 * consent-sheet.tsx by hand.
 */
function ConsentReplica() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const facts = [
    {
      lead: 'The photo goes to our AI partner,',
      rest: ' which returns a category, colour and fabric.',
    },
    {
      lead: 'It goes to one AI partner and comes straight back.',
      rest: ' We don’t send your name, your email, your location, or anything else from your closet.',
    },
    {
      lead: 'We keep the photo and the tags',
      rest: ' in your closet. Deleting an item deletes both.',
    },
    { lead: 'We never run face recognition,', rest: ' here or anywhere in Cinch.' },
  ] as const;

  return (
    <View
      className="absolute inset-0 justify-end"
      style={{ backgroundColor: theme.scrim }}
      pointerEvents="none">
      <View className="rounded-t-plate bg-canvas dark:bg-canvas-dark">
        <View className="items-center pb-1 pt-2.5">
          <View className="h-[5px] w-9 rounded-full bg-sand dark:bg-sand-dark" />
        </View>

        <View className="px-gutter pt-4" style={{ paddingBottom: insets.bottom + 16 }}>
          {/* Gap on the eyebrow, not the trimmed title — see consent-sheet. */}
          <Text variant="eyebrow" className="mb-4">
            Before we send anything
          </Text>
          <Text variant="title" trim>
            Cinch can tag your clothes for you.
          </Text>
          <Text variant="callout" className="mt-3" style={{ color: theme.muted }}>
            To do it, the photo has to leave your phone. Here is exactly what that means.
          </Text>

          <View className="mt-4">
            {facts.map(({ lead, rest }, index) => (
              <View
                key={lead}
                className={`flex-row gap-3 border-t border-rule py-2.5 dark:border-rule-dark ${
                  index === facts.length - 1 ? 'border-b' : ''
                }`}>
                <Text variant="statSmall" className="w-4" style={{ color: theme.accent }}>
                  {index + 1}
                </Text>
                <Text variant="label" className="flex-1 font-body">
                  <Text variant="label" className="font-semibold" style={{ color: theme.ink }}>
                    {lead}
                  </Text>
                  {rest}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-5 gap-2.5">
            <Button title="Turn on AI tagging" variant="ink" onPress={() => {}} />
            <Button title="Keep my photos on this phone" variant="secondary" onPress={() => {}} />
          </View>

          <View style={{ minHeight: MIN_TAP_TARGET }} className="mt-2 justify-center">
            <Text variant="label" className="text-center">
              Either way, you can change this in Settings.{' '}
              <Text variant="label" style={{ color: theme.accent }}>
                Read the full policy
              </Text>
            </Text>
          </View>
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
  // the rail's whole point is that a finished piece is named. These are the
  // Queue State Atlas's own casts, Q-01 … Q-05, headline and counts computed
  // from them by the derivations above — never written out by hand.
  const justQueued = useMemo(
    () => [
      job('q01-1', COAT, 'queued'),
      job('q01-2', KNIT, 'queued'),
      job('q01-3', TROUSERS, 'queued'),
      job('q01-4', LOAFERS, 'queued'),
      job('q01-5', BLOUSE, 'queued'),
    ],
    [],
  );
  const midBatch = useMemo(
    () => [
      job('q02-1', COAT, 'done', { label: 'Coat' }),
      job('q02-2', KNIT, 'done', { label: 'Knit' }),
      job('q02-3', TROUSERS, 'tagging'),
      job('q02-4', LOAFERS, 'uploading'),
      job('q02-5', BLOUSE, 'cutout'),
    ],
    [],
  );
  const settled = useMemo(
    () => [
      job('q03-1', COAT, 'done', { label: 'Coat' }),
      job('q03-2', KNIT, 'done', { label: 'Knit' }),
      job('q03-3', TROUSERS, 'done', { label: 'Trousers' }),
      job('q03-4', LOAFERS, 'done', { label: 'Shoes' }),
      job('q03-5', BLOUSE, 'done', { label: 'Blouse' }),
    ],
    [],
  );
  const oneStopped = useMemo(
    () => [
      job('q04-1', COAT, 'done', { label: 'Coat' }),
      job('q04-2', KNIT, 'done', { label: 'Knit' }),
      job('q04-3', TROUSERS, 'done', { label: 'Trousers' }),
      job('q04-4', SKIRT, 'done', { label: 'Skirt' }),
      // A diagnostic string, as the queue would hold it; `userFacingFailure`
      // reduces it to "That upload didn’t finish." in the banner.
      job('q04-5', TOTE, 'failed', { retryable: true, error: 'Upload failed with 500' }),
    ],
    [],
  );
  const reopened = useMemo(
    () => [
      job('q05-1', SKIRT, 'done', { label: 'Skirt' }),
      job('q05-2', BLOUSE, 'tagging'),
      job('q05-3', LOAFERS, 'queued'),
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

        {/* C-06 · declined — frame A-04, full-screen on the capture surface.
            The real exported component, so the fixture cannot drift: eyebrow,
            "Done. Nothing was sent.", the three hairline-ruled consequences,
            the ink pill and the way back. Nothing amber anywhere. */}
        <View style={{ height: pageHeight }} className="bg-canvas dark:bg-canvas-dark">
          <AtlasLabel id="C-06" name="Declined — what changes (A-04)" onLight />
          <DeclineExplainer onAddItem={() => {}} onTurnOnAi={() => {}} />
        </View>

        {/* C-06b · a later visit while declined — the screen just works in
            local mode: same stage, same controls, only the idle line changes.
            A-04 is never re-shown. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="C-06b" name="Local mode — a later visit" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <IdleSheet local />
        </View>

        {/* Q-01 · just queued — no verb yet: "Processing 1 of 5", "5 to go",
            the track nudged off zero at the 4% floor. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="Q-01" name="Just queued — no verb yet" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={justQueued} />
        </View>

        {/* Q-02 · mid-batch, three in flight — the headline counts settled
            jobs and names the furthest-along stage; finished pieces are
            named, in-flight ones show their stage. No button yet. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="Q-02" name="Mid-batch — three in flight" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={midBatch} />
        </View>

        {/* Q-03 · settled — "Added 5 of 5", the track full and still mounted,
            the ink "Review tags" as the way on. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="Q-03" name="Settled — the way on" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={settled} />
        </View>

        {/* Q-04 · one stopped, retryable — warning wash, one mapped sentence,
            ink "Try again" beside the way out, "Review tags" still below. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="Q-04" name="One stopped, retryable" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={oneStopped} />
        </View>

        {/* Q-05 · reopened — the rail comes back as it was: the added piece
            named, the tagger resuming, the queued one starting over. Nothing
            announces the interruption. */}
        <View style={{ height: pageHeight }} className="bg-ink">
          <AtlasLabel id="Q-05" name="Reopened — the rail comes back as it was" />
          <Header />
          <Stage kind="photo" />
          <ControlRow />
          <ProgressSheet jobs={reopened} />
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
