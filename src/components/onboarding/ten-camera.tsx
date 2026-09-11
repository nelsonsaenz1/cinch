import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// The exact A-04 component capture renders, so the two surfaces cannot drift —
// add-clothes.tsx imports it the same way.
import { DeclineExplainer } from '@/app/capture';
import { CameraAsk } from '@/components/ingest/camera-ask';
import { CloseDisc } from '@/components/ingest/capture-parts';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { DeferredCameraView, type CameraViewHandle } from '@/components/ingest/lazy-camera-view';
import { TenCameraChrome } from '@/components/onboarding/ten-camera-chrome';
import { EmptyState } from '@/components/ui/empty-state';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { DECLINED_KEY, EXPLAINER_SEEN_KEY, readFlag, writeFlag } from '@/features/ingest/consent-mode';
import { useCameraGate } from '@/features/ingest/use-camera-access';
import { useCapture, type CapturedAsset } from '@/features/ingest/use-capture';
// Aliased: `track` below is this screen's job-tracking helper, and the two
// would otherwise shadow each other.
import { track as trackEvent } from '@/lib/posthog';
import { selectPhaseLabel, useQueueStore } from '@/features/ingest/queue-store';
import type { TenSlot } from '@/features/onboarding/ten-slots';

/**
 * T-03, wired to the real pipeline.
 *
 * "Processing never blocks the next photograph — the count moves when the row
 * is written, not when the shutter fires" (The Ten atlas). A job's `itemId`
 * IS that row: `upload-queue.ts` writes it the moment the INSERT lands, well
 * before the tagging pass finishes — so this watches for `itemId`, not for
 * `stage === 'done'`, and reports the slot filled as soon as it appears.
 *
 * ── CONSENT (AC-04 / 5.1.2(i)) ──────────────────────────────────────────────
 *
 * The Ten used to be the one capture surface with no consent ask at all: a
 * fresh account could photograph ten pieces here, every upload would land,
 * and `tag-item` would then refuse each one server-side — leaving the whole
 * closet at `pending_tag`, category `other`, and the Reveal honestly
 * announcing zero. (Not hypothetical: it is what happened to the first
 * walk-in who reached the Reveal without ever being asked.)
 *
 * So this surface now asks at the same moment capture.tsx asks: the first
 * commit, when a photograph exists and something is about to leave the phone.
 * Granted and declined accounts are never interrupted — granted commits
 * upload as before, declined commits ride the local pipeline (`local: true`),
 * the same working mode A-04 promises everywhere else. Only the never-answered
 * account sees the sheet, once, over the shot it is about.
 *
 * ── THE CAMERA PERMISSION ASK (2026-09-02 audit, P1 #33) ────────────────────
 *
 * Also now asks at the moment it is needed rather than on mount: an
 * `access === 'unasked'` reader sees `CameraAsk` — capture.tsx's Frame 01,
 * imported rather than re-described — before the live stage below ever
 * renders, and the system dialog only fires from that card's own button. This
 * component used to call `useCameraAccess`, which fired the system dialog
 * from an effect the instant this component mounted; for `The Ten` that meant
 * the very first photograph slot a brand-new account ever tapped, with no
 * rationale of any kind on screen first. `start === 'library'` is unaffected
 * — it never opens the stage this ask guards.
 */
export function TenCamera({
  slot,
  slots,
  start,
  onFilled,
  onCancel,
}: {
  slot: TenSlot;
  slots: readonly TenSlot[];
  /**
   * `'library'` opens the picker on mount — the slot card's Library action and
   * T-05's "Choose from your camera roll" both land here rather than running a
   * second picker of their own, because the queue tracking that turns a chosen
   * photograph into a filled slot lives in this component and nowhere else.
   */
  start?: 'camera' | 'library';
  /** Fires once with the new row's id — the slot's `garmentId`. */
  onFilled: (itemId: string) => void;
  onCancel: () => void;
}) {
  const { access, request: askForCamera, openSettings } = useCameraGate();
  /**
   * Acquiring and committing are two steps (see the header of use-capture.ts).
   * The Ten commits immediately: the tenth slot IS the free ceiling, so a
   * guided capture can never be the piece that overflows it — the eleventh is
   * T-06's stop, which happens after this screen, not inside it.
   */
  const { pickFromLibrary, takePhoto, commit } = useCapture();
  const cameraRef = useRef<CameraViewHandle>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const live = access === 'granted' && !previewFailed;

  // The one job this shot belongs to — set the instant it is enqueued, so a
  // slow tagging pass never blocks the flow from moving on to slot N+1. State,
  // not a ref: `phase` below reads it during render, and a ref read there
  // would go stale between renders instead of driving one.
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const filledRef = useRef(false);
  const jobs = useQueueStore((s) => s.jobs);
  const phase = trackedJobId ? selectPhaseLabel(jobs) : null;

  useEffect(() => {
    if (!trackedJobId || filledRef.current) return;
    const job = jobs.find((j) => j.id === trackedJobId);
    if (job?.itemId) {
      filledRef.current = true;
      onFilled(job.itemId);
    }
  }, [jobs, trackedJobId, onFilled]);

  const track = useCallback(() => {
    // The newest job in the store the instant after an enqueue — synchronous
    // with the zustand push, so this is reliable without a returned id.
    const latest = useQueueStore.getState().jobs;
    const job = latest[latest.length - 1];
    if (job) setTrackedJobId(job.id);
  }, []);

  // ── The consent gate, mirroring capture.tsx's `guarded` ──────────────────
  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [declinedLocally, setDeclinedLocally] = useState(() => readFlag(DECLINED_KEY));
  // The shot (or picked batch) waiting behind the sheet. A ref, not state:
  // nothing renders it, and the accept path reads it synchronously.
  const pendingAssets = useRef<CapturedAsset[] | null>(null);

  const granted = consent.data?.granted === true;
  const declinedMode = !granted && (declinedLocally || consent.data?.revokedAt != null);

  /**
   * Every commit on this surface goes through here. Granted uploads, declined
   * runs the local pipeline, and never-answered holds the assets and raises
   * the ask — over the shot it is about, exactly as capture.tsx does. While
   * the consent query is still in flight both verdicts read false and the
   * sheet is raised: the same edge capture.tsx accepts, and the answer that
   * follows is simply recorded a moment earlier than it needed to be.
   */
  const commitGuarded = useCallback(
    (assets: CapturedAsset[]) => {
      if (assets.length === 0) return;
      if (granted) {
        if (commit(assets) > 0) track();
        return;
      }
      if (declinedMode) {
        if (commit(assets, { local: true }) > 0) track();
        return;
      }
      pendingAssets.current = assets;
      setConsentVisible(true);
    },
    [granted, declinedMode, commit, track],
  );

  const onAcceptConsent = useCallback(async () => {
    await grantConsent.mutateAsync();
    // Synchronously, ahead of the consent query's refetch — the held shot
    // must already know it is cleared to travel. A grant also ends declined
    // mode, the same order capture.tsx writes these.
    setDeclinedLocally(false);
    writeFlag(DECLINED_KEY, false);
    setConsentVisible(false);
    setExplainerVisible(false);
    const held = pendingAssets.current;
    pendingAssets.current = null;
    // A queue push, not an iOS presentation — nothing here needs to wait for
    // the sheet's dismissal animation the way capture's pickers do.
    if (held && commit(held) > 0) track();
  }, [grantConsent, commit, track]);

  const onDeclineConsent = useCallback(() => {
    setConsentVisible(false);
    // Recorded synchronously, ahead of any refetch, so the very next shutter
    // reads local mode rather than asking a second time.
    setDeclinedLocally(true);
    writeFlag(DECLINED_KEY, true);
    if (!readFlag(EXPLAINER_SEEN_KEY)) {
      // First-ever decline gets the one full account of what changes (A-04),
      // marked seen immediately — shown at the moment of decline, never again.
      // The held shot stays with `pendingAssets`; A-04's "Add the item myself"
      // is what carries it through the local pipeline.
      writeFlag(EXPLAINER_SEEN_KEY, true);
      setExplainerVisible(true);
      return;
    }
    const held = pendingAssets.current;
    pendingAssets.current = null;
    if (held && commit(held, { local: true }) > 0) track();
  }, [commit, track]);

  const shoot = useCallback(async () => {
    // ONE SHOT PER MOUNT — CMO ledger A28 (2026-09-11). This component closes
    // itself the moment its job's row lands (`onFilled`), but the row takes a
    // second or so to land and the shutter stayed live for that second. Read
    // back from production on 2026-09-10: a reader tapped it twice, 1.2 s
    // apart, three times in one run — six rows into three wells — and the
    // grid then offered open wells the account had no room for. A tracked
    // job means the shot is taken; the second tap is a no-op.
    if (trackedJobId) return;
    const camera = cameraRef.current;
    // No in-app preview to shoot from — a simulator, or a mount that failed.
    // The system camera is the same fallback capture.tsx uses.
    if (!live || !camera || !cameraReady) {
      // `takePhoto` fires the analytics event itself, on its way through the
      // system camera.
      commitGuarded(await takePhoto());
      return;
    }
    setShooting(true);
    try {
      const picture = await camera.takePictureAsync({ quality: 0.9, exif: false });
      if (picture?.uri) {
        // The in-app preview never goes through `takePhoto`, so nothing has
        // counted this shot yet. Reported with the same name and source as the
        // system-camera path, or The Ten would look like a flow nobody uses.
        trackEvent('clothes_import_selected', { source: 'camera', count: 1 });
        commitGuarded([{ uri: picture.uri, width: picture.width, height: picture.height }]);
      }
    } catch {
      setPreviewFailed(true);
    } finally {
      setShooting(false);
    }
  }, [live, cameraReady, commitGuarded, takePhoto, trackedJobId]);

  // A Library entry that came back with nothing. Until then the ask is
  // skipped for that door (the picker needs no permission); after it the
  // reader would be looking at a viewfinder with a dead shutter and no route
  // to the system prompt (verification, UX-22) — so the ask card takes over.
  const [libraryDismissed, setLibraryDismissed] = useState(false);
  const library = useCallback(() => {
    // The same one-shot rule as the shutter — see `shoot`.
    if (trackedJobId) return;
    void pickFromLibrary().then((assets) => {
      if (assets.length === 0) setLibraryDismissed(true);
      commitGuarded(assets);
    });
  }, [pickFromLibrary, commitGuarded, trackedJobId]);

  /**
   * One picker per mount. `start` is read through a ref rather than listed as a
   * dependency: re-firing the picker because `library` was recreated would put
   * a second sheet over the one the reader is already looking at.
   */
  const autoPicked = useRef(false);
  useEffect(() => {
    if (start !== 'library' || autoPicked.current) return;
    autoPicked.current = true;
    library();
  }, [start, library]);

  // A-04 replaces the stage, exactly as it replaces the chooser on
  // add-clothes: the decision is made, and this page only explains it. Its ink
  // pill files the shot that was waiting behind the sheet through the local
  // pipeline — "Done. Nothing was sent." is literally true here, because the
  // gate held the photograph before any upload began.
  if (explainerVisible) {
    return (
      <DeclineExplainer
        onAddItem={() => {
          setExplainerVisible(false);
          const held = pendingAssets.current;
          pendingAssets.current = null;
          if (held && commit(held, { local: true }) > 0) track();
        }}
        onTurnOnAi={() => {
          // The sheet lives in the main return, so the explainer steps aside
          // before re-presenting the ask — the same order add-clothes uses.
          setExplainerVisible(false);
          setConsentVisible(true);
        }}
      />
    );
  }

  // ── CP-02 inside The Ten (2026-09-02 audit, P1 #33) ───────────────────────
  //
  // The exact ask capture.tsx's Frame 01 raises, over the exact same live
  // stage this component is a beat away from opening: the shared component so
  // the sentence a reader gets here cannot drift from the one they would get
  // on any other capture surface. On canvas, not the ink stage below — there
  // is no preview yet to float an ask over, and a dark rectangle behind a
  // permission ask is the black viewfinder this fix exists to stop showing.
  //
  // `start === 'library'` never reaches here: the effect above auto-picks the
  // library on mount and this component never opens a viewfinder for that
  // door, so there is nothing to ask permission for.
  if (access === 'unasked' && (start !== 'library' || libraryDismissed)) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
        <StatusBar style="dark" />
        <View className="flex-row items-center justify-start px-gutter pt-2">
          <CloseDisc tone="canvas" onPress={onCancel} />
        </View>
        <CameraAsk onAsk={askForCamera} onLibrary={library} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <TenCameraChrome
        slot={slot}
        slots={slots}
        phase={phase}
        onCancel={onCancel}
        stage={
          access === 'blocked' ? (
            <View className="flex-1 items-center justify-center bg-canvas">
              <EmptyState
                symbol="camera.fill"
                tone="blocked"
                title="Camera access is off"
                body="Turn the camera on in Settings, or add this piece from your library instead."
                actionTitle="Open Settings"
                onAction={openSettings}
              />
            </View>
          ) : live ? (
            <DeferredCameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              active
              onCameraReady={() => setCameraReady(true)}
              onMountError={() => setPreviewFailed(true)}
            />
          ) : null
        }
        onLibrary={library}
        onShoot={() => void shoot()}
        shooting={shooting}
        shutterEnabled={live && !trackedJobId}
      />
      {/* The ask, over the dimmed stage and the shot it is about. A
          transparent Modal, so a sibling render reaches the front without
          touching the chrome's own layering. */}
      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAcceptConsent()}
        onDecline={onDeclineConsent}
      />
    </>
  );
}
