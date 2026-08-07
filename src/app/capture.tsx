import { useQueryClient } from '@tanstack/react-query';
import { CameraView } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressTrack } from '@/components/ui/progress-track';
import { Text } from '@/components/ui/text';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { GarmentSearchSheet } from '@/components/ingest/garment-search-sheet';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useCapture } from '@/features/ingest/use-capture';
import {
  useQueueStore,
  selectActiveCount,
  selectFailedJobs,
  selectPhaseLabel,
} from '@/features/ingest/queue-store';
import { drainQueue, retryFailedJobs, userFacingFailure } from '@/features/ingest/upload-queue';
import { useTheme } from '@/theme/tokens';

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

/** The three ways a garment gets into the closet from this screen. */
type CaptureAction = 'library' | 'camera' | 'describe';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { pickFromLibrary, takePhoto, addPhoto, selectionLimit } = useCapture();

  /**
   * Camera permission is asked for HERE, on the way in — see `useCameraAccess`.
   * The stage below is a live preview now, so the permission is a precondition
   * of the screen rather than of the shutter.
   */
  const { access, openSettings } = useCameraAccess();
  const cameraRef = useRef<CameraView>(null);
  // `takePictureAsync` before the session is up returns the last frame on iOS,
  // which for a session that never started is nothing at all.
  const [cameraReady, setCameraReady] = useState(false);
  // A device that cannot run the preview — a simulator has no camera at all —
  // falls back to the instructional frame and the system camera, rather than
  // showing a black rectangle and a shutter that does nothing.
  const [previewFailed, setPreviewFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const live = access === 'granted' && !previewFailed;

  /**
   * The preview runs only while this screen is in front. `active={false}` tears
   * the capture session down without unmounting the view, so coming back from
   * /review or from the tab underneath resumes rather than remounts — and a
   * screen sitting in the stack behind another one is not quietly holding the
   * camera open.
   */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const qc = useQueryClient();
  const capacity = useCapacity();
  const gate = useGate();

  const jobs = useQueueStore((s) => s.jobs);
  const hydrate = useQueueStore((s) => s.hydrate);
  const clearFailed = useQueueStore((s) => s.clearFailed);

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  // The third way in: describing a garment rather than photographing it. Passes
  // the same gates as the picker, because it ends in the same INSERT and the
  // same model call.
  const [describeVisible, setDescribeVisible] = useState(false);
  // What to run once consent lands, so the user isn't made to tap twice.
  const [pendingAction, setPendingAction] = useState<null | CaptureAction>(null);
  /**
   * Whether the user has said no to AI processing in THIS sitting.
   *
   * Declining used to be a dead end that looked like a bug: the sheet slid
   * away, the picker never opened, and the screen sat exactly as it had before
   * the tap — no explanation, and no way back to the ask short of guessing that
   * tapping Library again would re-open it. This is the state the progress
   * sheet below turns into a sentence and a way forward.
   *
   * Local to the visit rather than read off `consent`: a user who has never
   * been asked has not declined anything, and the two must not look the same.
   */
  const [declinedConsent, setDeclinedConsent] = useState(false);

  // Rehydrate a batch interrupted by a kill or a crash, and resume it.
  useEffect(() => {
    hydrate();
    void drainQueue();
  }, [hydrate]);

  /**
   * The shutter, on whichever camera this device actually has.
   *
   * In-app when the preview is live: the frame the user composed is the frame
   * that gets taken, with no second camera UI opening over the one they are
   * already looking at. The system camera stays as the fallback for a device
   * that cannot run a preview session, and carries its own permission handling
   * for exactly that case.
   */
  const shoot = useCallback(async () => {
    const camera = cameraRef.current;
    if (!live || !camera || !cameraReady) {
      await takePhoto();
      return;
    }
    setShooting(true);
    try {
      const picture = await camera.takePictureAsync({ quality: 0.9, exif: false });
      if (picture?.uri) addPhoto(picture);
    } catch {
      // Whatever went wrong with the session, the garment in front of the user
      // still has to be photographable. Drop to the system camera and stay
      // there for the rest of this visit.
      setPreviewFailed(true);
      await takePhoto();
    } finally {
      setShooting(false);
    }
  }, [live, cameraReady, addPhoto, takePhoto]);

  // All three ways in dispatch from one place. The gate below reaches for this
  // twice, and inlining a ternary at each site is how the second entry point
  // was written — a third would have made that three copies of one decision.
  const run = useCallback(
    (action: CaptureAction) => {
      if (action === 'library') void pickFromLibrary();
      else if (action === 'camera') void shoot();
      else setDescribeVisible(true);
    },
    [pickFromLibrary, shoot],
  );

  /**
   * Resuming the thing a gate interrupted — on the far side of the dismissal.
   *
   * "Allow processing" used to call `run(next)` in the same tick as
   * `setConsentVisible(false)`, and the picker never opened: iOS refuses to
   * present a view controller while another modal is still animating away, so
   * the library sheet — and the describe sheet, which has the same shape — was
   * dropped on the floor. The user's consent had registered; nothing else had.
   * They tapped Library again and, consent now granted, it worked. That is the
   * "the first tap does nothing" the founder saw, and it is a property of the
   * dismissal rather than of consent, so the paywall grant below goes through
   * the same door.
   *
   * Held in a ref, not state: the firing site is a native callback outside
   * React's update cycle, and it has to be readable and clearable in one go so
   * that an interrupted action runs exactly once.
   */
  const deferredAction = useRef<CaptureAction | null>(null);
  const deferredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `run` changes identity when the camera becomes ready. Resumption is
  // scheduled up to half a second before it fires, so it reads the dispatcher
  // as it stands at that moment rather than the one that existed when the gate
  // was answered — otherwise a grant landing in that window would shoot through
  // a closure that still believed the preview was cold.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const runResume = useCallback(() => {
    if (deferredTimer.current) {
      clearTimeout(deferredTimer.current);
      deferredTimer.current = null;
    }
    const next = deferredAction.current;
    deferredAction.current = null;
    if (next) runRef.current(next);
  }, []);

  /**
   * `onDismiss` is the exact signal, and the consent sheet passes it back — but
   * it is an iOS-only Modal callback and the paywall has no equivalent at all.
   * The timer is the same resumption for both of those gaps; whichever fires
   * first clears the other, so the action runs once either way.
   */
  const deferResume = useCallback(
    (action: CaptureAction) => {
      deferredAction.current = action;
      if (deferredTimer.current) clearTimeout(deferredTimer.current);
      deferredTimer.current = setTimeout(runResume, 450);
    },
    [runResume],
  );

  useEffect(() => {
    return () => {
      if (deferredTimer.current) clearTimeout(deferredTimer.current);
    };
  }, []);

  /**
   * Gate every capture entry point, in the order the user should meet the gates.
   *
   * CAPACITY BEFORE CONSENT, deliberately. A full closet means this garment
   * cannot be added at all, so asking for AI permission first collects a
   * decision we have no use for — and it asks for something invasive
   * (photographs going to a model) moments before refusing the thing they
   * asked for. Whichever gate the user cannot pass should be the only one they
   * are shown.
   *
   * BOTH BEFORE THE PICKER. `items_enforce_limit` refuses the INSERT, which
   * happens after the photograph is taken, cut out and uploaded. Letting the
   * user get that far and then failing is the thing worth avoiding: the server
   * is still the authority, this just moves the "no" to before the work rather
   * than after it.
   */
  const guarded = useCallback(
    (action: CaptureAction) => {
      if (capacity.full) {
        // Superwall decides whether this particular user sees a paywall. On a
        // grant, dispatch the picker DIRECTLY — not back through this guard.
        // The refreshed `capacity` lives in a re-render this callback's closure
        // will never see (the await resumes as a microtask, before React
        // re-renders), so re-entering the gate would read the stale `full` and
        // show a paying user the paywall a second time. Skipping the client
        // check is safe because it was never the authority: the database
        // trigger still refuses the insert if the plan somehow didn't change.
        void gate.present(Placement.AddGarmentOverLimit, async () => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['subscription'] }),
            qc.invalidateQueries({ queryKey: ['closet-count'] }),
          ]);
          // Deferred, not immediate: a paywall is a presented view controller
          // like the consent sheet, and the picker cannot open over one that is
          // still leaving. Superwall gives no dismissal callback to hang this
          // on, so it waits out the animation.
          deferResume(action);
        });
        return;
      }

      if (consent.data?.granted) {
        run(action);
        return;
      }
      setPendingAction(action);
      setConsentVisible(true);
    },
    [capacity.full, gate, qc, consent.data?.granted, run, deferResume],
  );

  const onAcceptConsent = async () => {
    await grantConsent.mutateAsync();
    if (pendingAction) deferResume(pendingAction);
    setPendingAction(null);
    setDeclinedConsent(false);
    setConsentVisible(false);
  };

  /** The declined state's way back in. Nothing pending — this is a fresh ask. */
  const reopenConsent = useCallback(() => {
    setPendingAction(null);
    setConsentVisible(true);
  }, []);

  // A light tap on the two capture controls, matching the Buttons this dark
  // control row replaces. Best-effort only — haptics no-op during a camera
  // session and in Low Power Mode, so the pressed state is the real feedback.
  const start = useCallback(
    (action: CaptureAction) => {
      void Haptics.selectionAsync().catch(() => {
        /* haptics are best-effort; never block the action */
      });
      guarded(action);
    },
    [guarded],
  );

  // Progress is read entirely off the real upload/tag queue — never fabricated.
  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const failed = selectFailedJobs(jobs);
  const failedCount = failed.length;
  const active = selectActiveCount(jobs); // queued + in-flight, i.e. still to process
  const allDone = total > 0 && active === 0;
  // Everything the queue has finished ARGUING about, added or not. The ordinal
  // below counts these rather than the successes alone: a batch where the first
  // four failed was reading "Processing 1 of 5" while it worked on the fifth,
  // which is a count of nothing anybody could see.
  const settledCount = doneCount + failedCount;
  const fraction = total ? doneCount / total : 0;
  // What the batch is actually doing this second — "cleaning up…",
  // "categorising…". Named rather than implied, because a long tagging pass over
  // a slow connection is otherwise indistinguishable from nothing happening.
  const phase = selectPhaseLabel(jobs);
  const canRetry = failed.some((j) => j.retryable !== false);
  const [retrying, setRetrying] = useState(false);

  const retryFailed = useCallback(async () => {
    setRetrying(true);
    try {
      await retryFailedJobs();
    } finally {
      setRetrying(false);
    }
  }, []);

  /**
   * Leaving a finished batch behind clears it.
   *
   * Jobs are persisted so an interrupted import resumes, and the cost of that
   * was permanence: every non-`done` job — including a failure nobody can do
   * anything more about — came back on the next launch and sat in the rail for
   * good. This runs only when nothing is still moving, so backgrounding the app
   * mid-import still resumes exactly as before; a batch that has finished
   * arguing is simply not news any more once its screen has been dismissed.
   */
  useEffect(() => {
    return () => {
      const { jobs: latest, clearSettled: clear } = useQueueStore.getState();
      if (latest.length > 0 && selectActiveCount(latest) === 0) clear();
    };
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      {/* The capture stage is the one dark screen in a light-only app; the
          global status bar is dark-on-light, which would vanish here. */}
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between px-gutter pt-1">
        {/* `plate`, the serif — every other screen title in the app is set in
            it, and this one was the lone Helvetica `heading`. The stage is
            dark, so the colour is canvas; the register is the same as
            everywhere else. */}
        <Text variant="plate" style={{ color: theme.canvas }}>
          Add clothes
        </Text>
        {/* "Done", not "Close" — the guide's own word for this control (07a).
            It is also the truer one: an import keeps running in the queue after
            this screen goes away, so the tap ends the user's session at the
            stage rather than closing anything down. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done adding clothes"
          hitSlop={12}
          onPress={() => router.back()}
          className="py-2">
          <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
            Done
          </Text>
        </Pressable>
      </View>

      {/* The framed stage — a LIVE viewfinder, per 07a. It was an instructional
          frame with a garment glyph in it, which on a dark screen reads as a
          camera that has failed to start; the corner guides and the hint now
          sit over the real preview they were always drawn for. */}
      {access === 'blocked' ? (
        /* Declined, and on iOS that decision is final until Settings — so this
           is a plate rather than a prompt. It is drawn on canvas, not on the
           ink stage: the states kit sets ink type, and ink on ink is the black
           rectangle this whole change exists to remove. The two other doors
           below stay open, so a refused camera narrows the screen instead of
           ending it. */
        <View className="mx-4 my-2 flex-1 overflow-hidden rounded-plate bg-canvas dark:bg-canvas-dark">
          <EmptyState
            symbol="camera.fill"
            tone="blocked"
            title="Camera access is off"
            body="Cinch can't show the viewfinder without it. Turn the camera on in Settings, or add clothes from your library instead."
            actionTitle="Open Settings"
            onAction={openSettings}
          />
        </View>
      ) : (
        <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
          {live ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              active={focused}
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setPreviewFailed(true)}
            />
          ) : (
            /* Still waiting on the permission alert, or a device with no
               preview to give. The old instructional frame is exactly right
               for both: it says what to photograph while there is nothing to
               show. */
            <>
              <View className="absolute inset-0 bg-surface" style={{ opacity: 0.04 }} />
              <View style={{ opacity: 0.5 }}>
                <SymbolView name="tshirt" size={44} tintColor={theme.canvas} />
              </View>
            </>
          )}
          <Corner canvas={theme.canvas} pos="tl" />
          <Corner canvas={theme.canvas} pos="tr" />
          <Corner canvas={theme.canvas} pos="bl" />
          <Corner canvas={theme.canvas} pos="br" />
          <Text
            variant="caption"
            className="absolute"
            style={{
              bottom: 22,
              color: theme.canvas,
              opacity: 0.75,
              // Over a live scene the hint has no fixed backdrop to be legible
              // against — a white shirt fills the frame and the line vanishes.
              // Warm ink at 55%, not pure black: a neutral black shadow reads
              // cold against the warm canvas type it sits under, and the
              // palette has no true black in it anywhere else.
              textShadowColor: 'rgba(28,26,22,0.55)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}>
            One garment, plain background
          </Text>
        </View>
      )}

      {/* Library · shutter · describe. The handoff draws "Flip" in the third
          slot; "Describe" holds it instead, and now that the preview is live
          that is a choice rather than a limitation. A front camera photograph
          of a garment held at arm's length is not a garment photograph, so flip
          would be a control for a shot nobody wants — while describe is the
          door for the pieces somebody will never get round to photographing at
          all. */}
      <View className="flex-row items-center justify-between px-8 py-2">
        {/* `minWidth`, not `w-16`. A fixed 64pt box sliced "Library" to "Libra"
            at AX-1 and above — the label is the only thing that says what the
            control does, so it takes the space it needs and shrinks to fit
            rather than being clipped by a width that never grew. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          hitSlop={12}
          onPress={() => start('library')}
          style={{ minWidth: 64 }}
          className="py-2">
          <Text variant="label" numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.canvas }}>
            Library
          </Text>
        </Pressable>

        {/* Dimmed and inert until the camera is actually GRANTED, rather than
            live over a plate that has just said it cannot open — the Settings
            button in the stage is the one way forward from there, and a shutter
            that fires an alert saying the same thing is a second, worse copy of
            it.

            `!== 'granted'`, not `=== 'blocked'`: `checking` is the state while
            iOS's own permission alert is on screen, and the shutter was live
            underneath it. A tap there fell through to the system-camera
            fallback, which requests the permission AGAIN — a second OS prompt
            stacked on the first, over a question the user is already being
            asked. Nothing here should be pressable while the OS owns the
            screen. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          accessibilityState={{ disabled: access !== 'granted', busy: shooting }}
          accessibilityHint={
            access === 'blocked'
              ? 'Turn on camera access in Settings to use this'
              : access === 'checking'
                ? 'Waiting for camera access'
                : undefined
          }
          disabled={access !== 'granted' || shooting}
          onPress={() => start('camera')}
          className="items-center justify-center active:opacity-80"
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 3,
            borderColor: theme.canvas,
            opacity: access !== 'granted' ? 0.35 : 1,
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
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Describe it instead"
          accessibilityHint="Find a picture of a garment by describing it"
          hitSlop={12}
          onPress={() => start('describe')}
          style={{ minWidth: 64 }}
          className="items-end py-2">
          <Text variant="label" numberOfLines={1} adjustsFontSizeToFit style={{ color: theme.canvas }}>
            Describe
          </Text>
        </Pressable>
      </View>

      {/* The progress sheet — bg-surface, rounded top corners, flush to the
          bottom edge. Everything below is driven by the queue state. */}
      <View
        className="rounded-t-plate bg-surface px-gutter pt-4"
        style={{ paddingBottom: insets.bottom + 20 }}>
        {total === 0 ? (
          <>
            <Text variant="plate">Photograph your closet</Text>
            {declinedConsent ? (
              /*
                The answer to "I tapped Not now and nothing happened."

                A decline is a real answer with a real consequence, so the
                consequence is stated rather than left to be inferred from a
                picker that never opened. Persistent rather than a toast,
                because the condition it describes persists — and paired with
                the way back, since the sheet is one tap away and this is the
                only place in the app that says so.
              */
              <View accessibilityLiveRegion="polite">
                <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
                  AI processing is off, so Cinch can&rsquo;t cut out or tag photos yet.
                </Text>
                <Button
                  title="Turn it on"
                  variant="secondary"
                  onPress={reopenConsent}
                  accessibilityHint="Re-opens the AI processing disclosure"
                  className="mt-3 self-start"
                />
              </View>
            ) : (
              <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
                {`Pick up to ${selectionLimit} photos at a time, or shoot pieces one by one. Cinch cuts out the background and tags everything for you.`}
              </Text>
            )}
          </>
        ) : (
          <>
            <View className="flex-row items-baseline justify-between">
              {/*
                The progress line is DATA, not a headline: Helvetica at body
                size, tabular figures so the count does not jitter as it climbs.
                It was set in the serif `stat` variant, which is the register
                this app reserves for a figure being displayed — a cost per
                wear, a wear count — and reading a status line in the same voice
                as a plate's hero number overstates it.
              */}
              <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>
                {allDone
                  ? failedCount > 0
                    ? `Added ${doneCount} of ${total}`
                    : 'All added'
                  : `Processing ${Math.min(settledCount + 1, total)} of ${total}${phase ? ` · ${phase}` : ''}`}
              </Text>
              {!allDone ? (
                <Text variant="caption" style={{ color: theme.faint }}>{`${active} to go`}</Text>
              ) : failedCount > 0 ? (
                <Text variant="caption" style={{ color: theme.critical }}>
                  {`${failedCount} couldn't be added`}
                </Text>
              ) : null}
            </View>

            {allDone ? (
              <View className="mt-3" />
            ) : (
              <ProgressTrack value={fraction} height={6} className="my-3" />
            )}

            <UploadQueueList jobs={jobs} />

            {/*
              A stopped garment, said out loud.
              Before this, a tagging failure lived only in `job.error` — a field
              nothing rendered — while the job sat counted as in-flight forever.
              That is what "it just continuously loads and loads" was: not a slow
              import, an invisible one. The banner takes the same grammar the
              review deck already uses for a failed save (warning wash, one
              sentence, one action beside it) rather than a new pattern, and the
              retry only appears when there is genuinely something to retry.
            */}
            {failedCount > 0 ? (
              <View
                accessibilityLiveRegion="polite"
                className="mt-3 rounded-plate bg-warning/15 px-3 py-2.5">
                {/* Tone inline: `colophon` carries `text-faint`, which on this
                    warning wash is 3.06:1 — a headline nobody can read over a
                    notice whose whole job is to be read. `muted` clears AA on
                    the same ground, matching the sibling label below it and the
                    review deck's identical banner. */}
                <Text variant="colophon" style={{ color: theme.muted }}>
                  {failedCount === 1 ? '1 piece stopped' : `${failedCount} pieces stopped`}
                </Text>
                {/* The mapped sentence, not the raw `job.error`. The queue's own
                    strings are diagnostic ("Saved, but not tagged — Cinch
                    couldn't verify your account"); `userFacingFailure` reduces
                    them to the three things a person can act on, and
                    `job.error` stays untouched for logging. */}
                <Text variant="label" className="mt-1">
                  {userFacingFailure(failed[0])}
                </Text>
                {/*
                  A way out of the banner, not only a way back in. Some of these
                  failures are final by design — AI processing turned off, a
                  garment that no longer exists — and without a dismissal they
                  were permanent: the queue persists everything unfinished, so
                  the same red line came back on every launch, forever. The
                  garment itself is saved either way; this clears the notice.
                */}
                <View className="mt-2.5 flex-row items-center gap-2">
                  {canRetry ? (
                    <Button
                      title="Try these again"
                      variant="secondary"
                      loading={retrying}
                      onPress={() => void retryFailed()}
                    />
                  ) : null}
                  {/* "Dismiss" named the gesture; this names the OUTCOME, which
                      is what the user is actually deciding. The hint is
                      unchanged — it was already saying the true half. */}
                  <Button
                    title="Leave them untagged"
                    variant="ghost"
                    onPress={clearFailed}
                    accessibilityHint="Clears this notice. The pieces stay in your closet, untagged."
                  />
                </View>
              </View>
            ) : null}

            {doneCount > 0 ? (
              <Button
                title="Review tags"
                variant={allDone ? 'primary' : 'secondary'}
                onPress={() => router.replace('/review')}
                haptic
                className="mt-4"
              />
            ) : null}
          </>
        )}
      </View>

      {/*
        A described garment now joins the same queue a photographed one does
        (`tagImportedGarment`, fired by the import mutation), so the user stays
        here and watches it categorise on the rail like everything else.

        It used to be sent straight to /review on the strength of a row at
        `pending_tag` — a status the review query does not select. The deck
        would say "Nothing to review" while the garment they had just added was
        nowhere on screen at all, and a tag failure on that path had no job to
        attach itself to and so appeared nowhere either. The division the guide
        draws is the fix: capture (07) shows the work, review (08) shows the
        result, and "Review tags" below appears exactly when there IS one.
      */}
      <GarmentSearchSheet visible={describeVisible} onClose={() => setDescribeVisible(false)} />

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAcceptConsent()}
        onDismissed={runResume}
        onDecline={() => {
          setConsentVisible(false);
          setPendingAction(null);
          // Recorded, not swallowed: the progress sheet turns this into a
          // visible sentence and a one-tap way back (see the `total === 0`
          // branch). Without it a decline was indistinguishable from a tap that
          // did nothing at all.
          setDeclinedConsent(true);
          // Nothing to resume: a decline is an answer, not a pause. Clearing
          // it here means a decline can never fire the picker on the way out.
          deferredAction.current = null;
        }}
      />
    </SafeAreaView>
  );
}
