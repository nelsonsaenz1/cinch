import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CameraAsk } from '@/components/ingest/camera-ask';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { CutoutFailedNotice } from '@/components/ingest/cutout-failed-notice';
import {
  DeferredCameraView,
  type CameraViewHandle,
} from '@/components/ingest/lazy-camera-view';
import {
  AmberPlate,
  CloseDisc,
  DescribeDoor,
  FilingRowView,
  FramingCorners,
  HeldStrip,
  InviteLine,
  LibraryDoor,
  PageActions,
  PageMasthead,
  ReviewPill,
  SettledGrid,
  Shutter,
  StagePill,
} from '@/components/ingest/capture-parts';
import { ListingOffer } from '@/components/match/listing-offer';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { useConnectivity } from '@/features/auth/use-connectivity';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { useCloset } from '@/features/closet/queries';
import { countOutfits, rankGaps, tallyOf } from '@/features/closet/outfit-count';
import { Placement } from '@/features/billing/placements';
import { PLANS } from '@/features/billing/plans';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { useCameraGate } from '@/features/ingest/use-camera-access';
import {
  DECLINED_KEY,
  EXPLAINER_SEEN_KEY,
  readFlag,
  writeFlag,
} from '@/features/ingest/consent-mode';
import {
  CELEBRATION_BODY,
  CELEBRATION_CTA,
  CELEBRATION_SECONDARY,
  ERROR_BACK,
  ERROR_EYEBROW,
  FILING_FOOT,
  OFFLINE_BODY,
  OFFLINE_EYEBROW,
  PAGE,
  STAGE_ALPHA,
  PHOTOGRAPH_MORE,
  RESUME_CTA,
  RESUME_NEW,
  RESUME_TITLE,
  SETTLED_SUB,
  CAPTURE,
  celebrationFor,
  celebrationTitle,
  filingRows,
  filingSubline,
  filingTitle,
  heldPill,
  resumeBody,
  resumeDiscard,
  reviewCta,
  reviewPill,
  settledTitle,
  waitingTitle,
} from '@/features/ingest/capture-spec';
import { useCapture, type CapturedAsset } from '@/features/ingest/use-capture';
import { useWardrobe } from '@/features/styling/queries';
import { CAMERA_AVAILABLE } from '@/features/ingest/camera-availability';
import { cutoutFailures } from '@/features/ingest/cutout-failure';
import {
  useQueueStore,
  selectActiveCount,
  selectFailedJobs,
} from '@/features/ingest/queue-store';
import { drainQueue, retryFailedJobs, userFacingFailure } from '@/features/ingest/upload-queue';
import { haptics } from '@/lib/haptics';
import { canvasAlpha, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Redesign 22 — capture, as the twenty-two approved frames draw it.
 *
 * The decisions are `features/ingest/capture-spec.ts` and the drawing is
 * `components/ingest/capture-parts.tsx`; this file is the route, and its job is
 * to own the machinery the frames restyle but must never remove:
 *
 *   · the camera CAPABILITY guard (`CAMERA_AVAILABLE`), which is a wrapper
 *     above the screen so the screen's hooks stay unconditional;
 *   · the permission gate (`useCameraGate`) and its three fallbacks;
 *   · the deferred `CameraView`, which is the only way a stale binary reaches
 *     this route without throwing at import;
 *   · the consent sheet, local mode and A-04's explainer;
 *   · the closet-full hold (W-02) and its resume;
 *   · the listing offer's trigger and routing, and the invite line's condition,
 *     both carried below with their conditions BYTE-IDENTICAL to the shipped
 *     ones and pinned by `tests/capture-layout.test.ts`.
 *
 * ── THE TWO SURFACES ────────────────────────────────────────────────────────
 *
 * The frames divide this route in two, and the division is what replaced CP-03's
 * sheet-climbing-the-preview:
 *
 *   'stage'  — the dark viewfinder (frames 04/05/06/21). Chrome is a close
 *              disc, one pill, four corner marks, the shutter, the library door
 *              with its count, the describe door and — once something is held —
 *              the strip and the Review pill. No sentence floats on the frame.
 *   'batch'  — the canvas page (frames 07/08/09/17/18/19). One row per piece,
 *              honest counts, the amber plates, and the way onward.
 *
 * Shooting keeps you on the stage, which is what "you can keep photographing"
 * has always meant here. Closing the stage with a batch in flight lands on the
 * batch page rather than dismissing the route, because a batch is a thing you
 * leave rather than a thing you abandon; "Photograph more" is the way back.
 */

/**
 * M-03's card is dismissible FOREVER, so the dismissal is persisted in the same
 * kv-store the consent flags use — one read on mount, one write on the tap,
 * no server round trip for a preference the server has no opinion about. Like
 * those flags this is per install rather than truly per account; the item
 * detail row is the permanent way in either way, so the worst case of a
 * reinstall is one more offer, never a lost door.
 */
const LISTING_OFFER_DISMISSED_KEY = 'cinch.listing-offer.dismissed.v1';

/** The three consequences, verbatim from frame A-04. */
const DECLINE_ROWS = [
 'You’ll type the category, colour and fabric yourself. Four taps an item, roughly.',
 'Search still works, on the words you wrote. “Something warm for Thursday” won’t.',
 'Outfits, wear counts, cost per wear and lending to friends are unaffected.',
] as const;

/**
 * Frame A-04 — "Declined: what changes". Shown full-screen on the capture
 * surface at the moment of decline, once per account. A clear account of what
 * is different, not a warning: no amber, no icon, no "are you sure". Exported
 * so dev-capture's atlas fixture renders this exact component and cannot
 * drift from it.
 */
export function DeclineExplainer({
  onAddItem,
  onTurnOnAi,
}: {
  /** The ink pill — proceed with the waiting item (or open the picker) in local mode. */
  onAddItem: () => void;
  /** The footnote link — re-present the consent sheet. */
  onTurnOnAi: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      {/* Centered serif wordmark — A-04's header carries no controls at all:
          the decision is made, and this page only explains it. */}
      <View className="items-center pt-1">
        <Text variant="plate">Cinch</Text>
      </View>
      <ScrollView
        contentContainerClassName="px-gutter pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* The whole page is the announcement of a state change the user just
            made — read it out once, politely. */}
        <View accessibilityLiveRegion="polite">
          {/* Gap lives on the eyebrow: a `mt-*` stacked on the trimmed title
              resolves against trim's negative margins by merge order. */}
          <Text variant="eyebrow" className="mb-4">
            Photos stay on this phone
          </Text>
          <Text variant="title" trim>
            Done. Nothing was sent.
          </Text>
          <Text variant="callout" className="mt-3" style={{ color: theme.muted }}>
            Here’s what’s different for you, so nothing surprises you later.
          </Text>

          {/* Three hairline-ruled rows — the same ledger grammar as the consent
 sheet's facts, with the oxblood em-dash where its numerals sat. */}
          <View className="mt-6">
            {DECLINE_ROWS.map((row, index) => (
              <View
                key={row}
                className={`flex-row gap-3 border-t border-rule py-3 ${
                  index === DECLINE_ROWS.length - 1 ? 'border-b' : ''
                }`}>
                <Text
                  variant="label"
                  style={{ color: theme.accent }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  —
                </Text>
                <Text variant="label" className="flex-1 font-body">
                  {row}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Button
          title="Add the item myself"
          variant="ink"
          className="mt-6"
          onPress={onAddItem}
          accessibilityHint="Adds the photo without sending it anywhere. You type the tags."
        />

        {/* The way back, stated plainly rather than buried. The whole footnote
            is the tap target — an inline 13px link alone is under the 44pt
            floor, same reasoning as the consent sheet's policy link. */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Turn AI tagging on"
          accessibilityHint="Re-opens the AI tagging disclosure"
          onPress={onTurnOnAi}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-3 justify-center active:opacity-60">
          <Text variant="label" className="text-center">
            Changed your mind?{' '}
            <Text variant="label" style={{ color: theme.accent }}>
              Turn AI tagging on
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The three ways a garment gets into the closet from this screen. */
type CaptureAction = 'library' | 'camera' | 'describe';

/** Which of the two surfaces the route is showing. See the header. */
type Surface = 'stage' | 'batch';

/**
 * The route's guard, and the only thing expo-router mounts.
 *
 * A wrapper rather than an early return inside `CaptureScreen`: that component
 * opens with a long run of hooks, and a return above them would make every one
 * of them conditional. `CAMERA_AVAILABLE` is a module constant that cannot
 * change during a session, so this branch is stable for the life of the process
 * and the screen below keeps its hook order exactly as it was.
 */
export default function CaptureRoute() {
  const router = useRouter();
  if (!CAMERA_AVAILABLE) {
    // Frame 03, drawn here rather than redirected to `/camera-unavailable`:
    // this route was reached directly — a deep link, a notification, a restored
    // session — and bouncing somebody to a second route would lose the close
    // that takes them back where they came from.
    //
    // The COPY is `camera-copy.ts`'s and is pinned verbatim by
    // `tests/camera-availability.test.ts`, so the frame's own wording is not
    // adopted here: this state is a capability, not a device fault, and the
    // shipped sentence is the one that says so without naming a module. The
    // frame's LAYOUT is adopted — a 44pt close square on canvas, then the
    // plate.
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-row justify-start px-gutter pt-2">
          <CloseDisc tone="canvas" onPress={() => router.back()} />
        </View>
        <View className="mt-6">
          <CameraUnavailable
            onLibrary={() => router.replace('/add-clothes?door=library' as Href)}
            onDescribe={() => router.replace('/add-clothes?door=describe' as Href)}
            onHelp={() => router.replace('/help' as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }
  return <CaptureScreen />;
}

function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { pickFromLibrary, takePhoto, commit, selectionLimit } = useCapture();

  /**
   * Camera permission is asked for HERE, on the way in — but frame 01 puts a
   * sentence in front of the system alert rather than raising it from an
   * effect, so `useCameraGate` asks for nothing on mount and hands the request
   * back as a function. The stage below is a live preview, so the permission is
   * still a precondition of the screen rather than of the shutter; what changed
   * is that the user is told what the next prompt is before it appears.
   */
  const { access, request: askForCamera, openSettings } = useCameraGate();
  const cameraRef = useRef<CameraViewHandle>(null);
  // `takePictureAsync` before the session is up returns the last frame on iOS,
  // which for a session that never started is nothing at all.
  const [sessionReady, setSessionReady] = useState(false);
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
  const wardrobe = useWardrobe();

  /** Frame 17's fact. One HEAD every four seconds while this screen is open. */
  const online = useConnectivity();

  /** The preview's measured height, so frame 21's guide can shrink into it. */
  const [previewHeight, setPreviewHeight] = useState(0);

  /**
   * W-02 — the closet-full sheet.
   *
   * THE SHUTTER IS NEVER DISABLED AND THE PHOTOGRAPH IS NEVER DISCARDED — the
   * atlas states both plainly, and "the limit applies to the closet, not the
   * camera" is the whole shape of this state. So the camera and library doors
   * open unconditionally (see `guarded`, which no longer reads `capacity` at
   * all): a full closet only changes what happens to the picture ONCE IT
   * EXISTS. `heldCapture` is that picture, kept in plain component state —
   * deliberately not persisted, so a dropped hold on backgrounding is an
   * accepted, disclosed delta rather than a reason to invent a second
   * storage layer for a photo that may never be added. `closetFullVisible`
   * is a separate flag from "is something held": "Make room for it" hides
   * the sheet to navigate to the swap screen while KEEPING the hold, so the
   * user who stores a piece and comes back is resumed with the photograph
   * they already took rather than sent to shoot the same coat twice.
   */
  type HeldCapture = { assets: CapturedAsset[]; local: boolean };
  const [heldCapture, setHeldCapture] = useState<HeldCapture | null>(null);
  const [closetFullVisible, setClosetFullVisible] = useState(false);
  const [gatePresenting, setGatePresenting] = useState(false);

  // The stage's live session is torn down while a photo is held behind W-02, so
  // readiness must not survive the hold. A shutter tap in the instant the view
  // remounts has to wait for a real `onCameraReady` rather than trusting a flag
  // left over from before.
  //
  // DERIVED, not reset in an effect. The effect version was a synchronous
  // setState that ran after the frame holding the stale `true` had already been
  // handed to React — a one-frame window in which the shutter believed a
  // torn-down camera was live. Deriving closes the window entirely, because
  // there is no frame in which both `heldCapture` and readiness are true.
  const cameraReady = heldCapture ? false : sessionReady;

  const jobs = useQueueStore((s) => s.jobs);
  const hydrate = useQueueStore((s) => s.hydrate);
  const clearFailed = useQueueStore((s) => s.clearFailed);
  const clearSettled = useQueueStore((s) => s.clearSettled);

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  // The third way in: describing a garment rather than photographing it. Passes
  // the same gates as the picker, because it ends in the same INSERT and the
  // same model call.
  // What to run once consent lands, so the user isn't made to tap twice.
  const [pendingAction, setPendingAction] = useState<null | CaptureAction>(null);

  /**
   * Local mode — declining is a WORKING mode, not a dead end (frames A-04/05).
   *
   * Declining used to refuse the picker outright and leave a small banner
   * explaining why nothing happened. Now the screen keeps working: the picker
   * opens, the pipeline runs on-device, and the photos never leave the phone.
   * `declinedLocally` is the persisted "this account answered the sheet with
   * decline" flag (see DECLINED_KEY); `revokedAt` corroborates a decline made
   * on another device or through Settings. A fresh account — never asked,
   * never answered — matches neither, and still meets the sheet first.
   */
  const [declinedLocally, setDeclinedLocally] = useState(() => readFlag(DECLINED_KEY));
  const [explainerSeen, setExplainerSeen] = useState(() => readFlag(EXPLAINER_SEEN_KEY));
  const [explainerVisible, setExplainerVisible] = useState(false);

  const granted = consent.data?.granted === true;
  const declinedMode = !granted && (declinedLocally || consent.data?.revokedAt != null);

  /**
   * Whether the NEXT enqueue is local, readable from callbacks that fire
   * outside React's render cycle (the shutter, the deferred resume). Kept as a
   * ref because the accept path must flip it synchronously: the consent query
   * refetches on its own schedule, and the resumed action fires ~450ms after
   * the grant — reading stale query data there would send an accepted user's
   * first photo through the local path.
   */
  const localModeRef = useRef(declinedMode);
  useEffect(() => {
    localModeRef.current = declinedMode;
  }, [declinedMode]);

  /**
   * Frame 18 — the interrupted batch, and the one place the shipped auto-resume
   * is put behind a person.
   *
   * `hydrate()` restores whatever a crash or a kill left unfinished; the shipped
   * screen then called `drainQueue()` immediately and the user found a batch
   * already moving that they had no memory of starting. The frame answers that
   * with three explicit outcomes — carry on, start a new batch, discard — so the
   * drain is deferred until one is chosen. Nothing else about the queue moved:
   * `use-capture`'s own `commit` still drains on every enqueue, so a batch
   * started in this session is unaffected, and a user who taps "Carry on" gets
   * exactly the behaviour that used to be automatic.
   */
  const [resumeVisible, setResumeVisible] = useState(() => {
    // In a lazy initialiser rather than an effect, and it is safe there because
    // `hydrate` is SYNCHRONOUS (kv-store, no await) and idempotent — it returns
    // immediately once the store's own `hydrated` flag is set, so a double
    // invocation under StrictMode restores the same jobs and answers the same
    // question. The alternative was a mount effect that called setState twice,
    // which is a cascading render for a fact that is already knowable.
    hydrate();
    return selectActiveCount(useQueueStore.getState().jobs) > 0;
  });

  /**
   * Which surface is in front. See the file header.
   *
   * Declared after `resumeVisible` and seeded from it: an interrupted batch is
   * a batch, and putting the viewfinder in front of somebody who has four
   * photographs waiting is how the shipped screen silently resumed them.
   */
  const [surface, setSurface] = useState<Surface>(resumeVisible ? 'batch' : 'stage');

  /**
   * The drain, on the far side of the decision.
   *
   * Fires immediately when there was nothing to decide, and again the moment
   * any of frame 18's three outcomes is taken — "carry on" wants exactly this,
   * and a drain over a queue that was just cleared or discarded is a loop over
   * an empty array.
   */
  useEffect(() => {
    if (resumeVisible) return;
    void drainQueue();
  }, [resumeVisible]);

  /**
   * Decide whether newly acquired photos go straight to the queue or wait
   * behind W-02.
   *
   * Capacity is read fresh HERE — after the photograph already exists —
   * rather than at the moment the shutter is tapped, which is the entire
   * point: the only thing worth avoiding is the paid upload and tagging
   * call, never the shot itself.
   */
  const settleCapture = useCallback(
    (assets: CapturedAsset[], local: boolean) => {
      if (assets.length === 0) return;
      if (capacity.full) {
        setHeldCapture({ assets, local });
        setClosetFullVisible(true);
        return;
      }
      commit(assets, { local });
    },
    [capacity.full, commit],
  );

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
    // The mode is read at the moment of the shot, not closed over: the same
    // shutter serves both modes, and only the settlement differs.
    const local = localModeRef.current;
    if (!live || !camera || !cameraReady) {
      settleCapture(await takePhoto(), local);
      return;
    }
    setShooting(true);
    try {
      const picture = await camera.takePictureAsync({ quality: 0.9, exif: false });
      if (picture?.uri) settleCapture([picture], local);
    } catch {
      // Whatever went wrong with the session, the garment in front of the user
      // still has to be photographable. Drop to the system camera and stay
      // there for the rest of this visit.
      setPreviewFailed(true);
      settleCapture(await takePhoto(), local);
    } finally {
      setShooting(false);
    }
  }, [live, cameraReady, takePhoto, settleCapture]);

  // All three ways in dispatch from one place. The gate below reaches for this
  // twice, and inlining a ternary at each site is how the second entry point
  // was written — a third would have made that three copies of one decision.
  const run = useCallback(
    (action: CaptureAction) => {
      if (action === 'library') {
        void pickFromLibrary().then((assets) => settleCapture(assets, localModeRef.current));
      } else if (action === 'camera') {
        void shoot();
      } else {
        // THE CATALOGUE ROUTE, and it leaves this screen.
        //
        // It used to raise `GarmentSearchSheet` over the live camera. That
        // sheet is the old listing-tile flow; the catalogue matcher is now a
        // route of its own (`/find-photo`) with a family list, a colourway
        // detail and a batch import, none of which fits in a sheet over a
        // viewfinder. Pushing also stops the camera session sitting live behind
        // a modal somebody may spend a minute typing into.
        router.push('/find-photo');
      }
    },
    [pickFromLibrary, shoot, settleCapture, router],
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
   * Gate every capture entry point on consent alone. Capacity is NOT checked
   * here any more — Camera and Library both open unconditionally, at any
   * capacity, per the Wall's W-02: the limit is decided once a photograph
   * exists (`settleCapture`), never at the door.
   */
  const guarded = useCallback(
    (action: CaptureAction) => {
      if (granted) {
        run(action);
        return;
      }

      // Declined is a working mode: the flow continues on-device rather than
      // refusing. A-04 is NOT re-shown here — it belongs to the moment of
      // decline alone, and after that the screen simply works in local mode.
      if (declinedMode) {
        run(action);
        return;
      }

      // Never answered — the sheet still gates the first upload.
      setPendingAction(action);
      setConsentVisible(true);
    },
    [granted, declinedMode, run],
  );

  /**
   * Arriving from a door on the Add Clothes chooser (AC-01).
   *
   * `?start=library` and `?start=describe` open the picker and the describe
   * sheet respectively; the Camera door sends no parameter, because the live
   * stage IS this screen and there is nothing to open over it.
   *
   * THROUGH `guarded`, NEVER `run`. The chooser is a menu, not a gate — the
   * consent sheet still fires on the door the user actually tapped, which is
   * the whole of AC-04.
   *
   * The wait on `consent.data` is the load, not politeness: `granted` and
   * `declinedMode` are both false while the query is in flight, so firing at
   * mount would put the consent sheet in front of somebody who answered it
   * months ago. The delay after that is the same 450ms `deferResume` uses and
   * exists for the same reason — iOS refuses to present a view controller
   * while another modal is still animating, and this screen arrives as one.
   */
  const params = useLocalSearchParams<{ start?: string; from?: string }>();
  const autoStart = params.start;
  const autoStarted = useRef(false);
  const guardedRef = useRef(guarded);
  useEffect(() => {
    guardedRef.current = guarded;
  }, [guarded]);
  useEffect(() => {
    if (autoStarted.current) return;
    if (consent.data === undefined) return;
    if (autoStart !== 'library' && autoStart !== 'describe') return;
    autoStarted.current = true;
    const timer = setTimeout(() => guardedRef.current(autoStart), 450);
    return () => clearTimeout(timer);
  }, [autoStart, consent.data]);

  /**
   * W-02's "See plans" — the sheet's own tap-through to Superwall. On a
   * grant, commits the SAME held photograph rather than sending the user
   * back to shoot again: "resume with that photograph" is the whole point of
   * holding it in the first place.
   */
  const seePlansForHeldCapture = useCallback(() => {
    setGatePresenting(true);
    void gate
      .present(Placement.AddGarmentOverLimit, async () => {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['subscription'] }),
          qc.invalidateQueries({ queryKey: ['closet-count'] }),
        ]);
        if (heldCapture) commit(heldCapture.assets, { local: heldCapture.local });
        setHeldCapture(null);
        setClosetFullVisible(false);
      })
      .finally(() => setGatePresenting(false));
  }, [gate, qc, commit, heldCapture]);

  /**
   * W-02's "Make room for it" — the real, working swap flow, not a token
   * link. Hides the sheet to navigate but deliberately does NOT clear
   * `heldCapture`: the photograph is still held, and the focus effect below
   * resumes with it the moment the user comes back with room made.
   *
   * The kind offered to the swap screen is a heuristic — whichever the real
   * wardrobe's own ranking says gains the most (`rankGaps`) — because the
   * photograph in hand is not tagged yet and genuinely cannot be identified
   * for free at this point (see the same reasoning in the sheet's body copy
   * below).
   */
  const makeRoomForHeldCapture = useCallback(() => {
    setClosetFullVisible(false);
    const tally = tallyOf(wardrobe.data ?? []);
    const best = rankGaps(tally)[0]?.kind ?? 'tops';
    router.push(`/wall-swap?add=${best}`);
  }, [wardrobe.data, router]);

  /**
   * The resume, on the far side of a swap.
   *
   * `wall-swap.tsx` calls `router.back()` after storing, which returns focus
   * here without unmounting `CaptureScreen` — `heldCapture` was never lost.
   * Capacity is re-checked FRESH rather than assumed freed: storing a piece
   * does not by itself change what `items_enforce_limit` counts (it counts
   * every row regardless of `is_archived` — see the escalation in
   * `.redesign/escalations.md`), so this only commits when the closet
   * genuinely has room, and simply re-opens the sheet otherwise rather than
   * attempting a commit the server would refuse anyway.
   */
  useFocusEffect(
    useCallback(() => {
      if (!heldCapture || capacity.loading) return;
      if (!capacity.full) {
        commit(heldCapture.assets, { local: heldCapture.local });
        setHeldCapture(null);
        setClosetFullVisible(false);
      } else {
        setClosetFullVisible(true);
      }
    }, [heldCapture, capacity.loading, capacity.full, commit]),
  );

  const onAcceptConsent = async () => {
    await grantConsent.mutateAsync();
    // Synchronously, before the resumed action fires: the consent query's
    // refetch will land later, and the deferred picker must already know the
    // photos are cleared to travel. A grant also ends declined mode.
    localModeRef.current = false;
    setDeclinedLocally(false);
    writeFlag(DECLINED_KEY, false);
    setExplainerVisible(false);
    if (pendingAction) deferResume(pendingAction);
    setPendingAction(null);
    setConsentVisible(false);
  };

  /**
   * A-04's footnote — "Turn AI tagging on" re-presents the ask in full.
   * `pendingAction` is left alone: an accept resumes the item that was
   * waiting behind the sheet the first time round.
   */
  const reopenConsent = useCallback(() => {
    setConsentVisible(true);
  }, []);

  /**
   * A-04's ink pill. The shot that was blocking the sheet is THE item — it
   * rides `pendingAction` and goes through the local pipeline; with nothing
   * waiting, the button opens the picker in local mode. Either way the
   * explainer's job is done and it never returns.
   */
  const addItemMyself = useCallback(() => {
    setExplainerVisible(false);
    const next = pendingAction ?? 'library';
    setPendingAction(null);
    run(next);
  }, [pendingAction, run]);

  /**
   * The shutter's own tap, and the two doors beside it.
   *
   * Through `@/lib/haptics` rather than expo-haptics directly — UX-07's policy
   * module is the only door onto the taptic engine, and `tests/haptic-
   * policy.test.ts` holds that. `commit()` is the shutter's intent (a
   * photograph was taken, which is a state change with weight); `selection()`
   * is the doors'. Best-effort in both cases: haptics no-op during a camera
   * session and in Low Power Mode, so the pressed state is the real feedback.
   */
  const start = useCallback(
    (action: CaptureAction) => {
      if (action === 'camera') haptics.commit();
      else haptics.selection();
      guarded(action);
    },
    [guarded],
  );

  // Progress is read entirely off the real upload/tag queue — never fabricated.
  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const failed = selectFailedJobs(jobs);
  const failedCount = failed.length;
  // CP-05 — the pieces that were filed but arrived without a cutout.
  const cutoutLost = cutoutFailures(jobs);
  const active = selectActiveCount(jobs); // queued + in-flight, i.e. still to process
  const allDone = total > 0 && active === 0;
  //
  // CP-03: THE BAR IS GONE, AND IT IS NOT COMING BACK.
  //
  // A `ProgressTrack` used to sit here, filled by `settled / total`. The
  // constitution's refusal is flat — "Progress is a count, never a bar or
  // percentage" — and redesign 22's own annotation repeats it: "Honest counts,
  // never a percent". Neither the fraction nor the component is computed any
  // more: a derived value kept "just in case" is how a refused treatment finds
  // its way back onto a screen.
  //
  // What replaces it is the row list below, which reads the same jobs and gives
  // each piece its own ground and its own word.
  const canRetry = failed.some((j) => j.retryable !== false);
  const [retrying, setRetrying] = useState(false);

  /** Frames 07/08/09/17 — the batch, as rows. */
  const rows = useMemo(
    () => filingRows(jobs, { held: !online }),
    [jobs, online],
  );
  const subline = useMemo(() => filingSubline(rows), [rows]);
  const jobUri = useCallback(
    (id: string) => jobs.find((j) => j.id === id)?.localUri ?? null,
    [jobs],
  );

  /**
   * The celebration's "before" — the closet as it stood when this screen opened.
   *
   * Captured once, on the first wardrobe result that arrives while the queue is
   * empty. Without it `celebrationFor` cannot prove a CROSSING, and it refuses
   * to fire on an unprovable one rather than celebrating the fortieth import.
   */
  // DERIVED, not remembered. The closet as it stood before this batch is the
  // closet now minus what this batch filed — an arithmetic fact, not a
  // snapshot, so there is no effect, no ref read during render, and no window
  // in which a slow wardrobe query makes the app forget where it started.
  // Null while the wardrobe has not answered: `celebrationFor` refuses to fire
  // on a crossing it cannot prove.
  const closetBefore = wardrobe.data === undefined ? null : wardrobe.data.length - doneCount;

  const celebration = celebrationFor({
    settled: allDone,
    unresolved: failedCount + cutoutLost.length,
    closetCount: wardrobe.data?.length ?? 0,
    closetBefore,
  });

  /**
   * The one notification haptic, once — the artifact's own bound.
   *
   * `success()` rather than `commit()`: the user was waiting on a batch that
   * could have failed, which is exactly the case UX-07 reserves that intent
   * for. Guarded by a ref so a re-render on the settled page cannot fire it
   * twice.
   */
  const celebrated = useRef(false);
  useEffect(() => {
    if (celebration === null || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [celebration]);

  /**
   * M-03 — the listing-photo offer, once the batch has finished arguing.
   *
   * OFFERED FOR A BATCH OF ONE, and only then. The card's whole claim is
   * specific — it names the retailer the tagger guessed and the kind of thing
   * the piece is — and a card that said that about one garment out of twelve
   * would be picking a favourite the user never nominated. Anyone importing in
   * batches meets the same offer as a row on each piece's own screen, which is
   * where the atlas puts the permanent way in regardless.
   *
   * A local job is excluded because its photograph never left the phone: there
   * is nothing server-side for the search to read, and the item detail row
   * hides itself for exactly the same reason.
   *
   * THE CONDITION AND THE ROUTING ARE THE SHIPPED ONES, CHARACTER FOR
   * CHARACTER. Redesign 22 restyles the card (frame 15) and moves nothing about
   * when it appears or where it goes; `tests/capture-layout.test.ts` pins both.
   */
  const [offerDismissed, setOfferDismissed] = useState(() =>
    readFlag(LISTING_OFFER_DISMISSED_KEY),
  );
  const offerJob =
    granted && !offerDismissed && allDone && doneCount === 1
      ? jobs.find((j) => j.stage === 'done' && !j.local && j.itemId)
      : undefined;
  /**
   * The tagged row itself, for the two words the sentence needs.
   *
   * Read from the live closet query rather than the job, which knows only what
   * kind of garment it is: the brand is the whole reason the offer is specific
   * rather than speculative. The queue invalidates `['closet']` as each item
   * settles, so by the time a batch is done this is a cache hit carrying the
   * tagger's own answer.
   */
  const closet = useCloset();
  const offerItem = offerJob ? closet.data?.find((i) => i.id === offerJob.itemId) : undefined;
  // The bare kind, in the tagger's lowercase word. Never `category` when that
  // is 'other' — "this other" is not a sentence, and a card that cannot name
  // the piece has no business making a specific offer about it.
  const offerPiece =
    offerItem?.subcategory ?? (offerItem?.category === 'other' ? null : offerItem?.category);

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

  /**
   * The close disc on the stage.
   *
   * With a batch in flight it hands over to the batch page rather than
   * dismissing the route — the frames give the queue a page of its own and this
   * is the only door onto it. With nothing in the queue it is the ordinary way
   * out, which is what the shipped "Done" pill was.
   */
  const leaveStage = useCallback(() => {
    if (total > 0) {
      setSurface('batch');
      return;
    }
    router.back();
  }, [total, router]);

  /** Frame 06's Review pill, and frame 09's capsule — one destination. */
  const openReview = useCallback(() => {
    haptics.selection();
    router.replace('/review');
  }, [router]);

  // ── The batch page ────────────────────────────────────────────────────────

  const batchPage = (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />

      {/* Frame 19's chevron, carried onto every batch state.
          THE FRAMES DRAW NO EXIT ON 07 AND 09 and one is added anyway: a page
          reached by leaving the stage, that a person can arrive at with four
          minutes of filing ahead of them, must have a way off it. Recorded as a
          deviation. */}
      <View className="flex-row justify-start px-gutter pt-2 pb-1">
        <CloseDisc
          tone="canvas"
          glyph="chevron.left"
          label="Back"
          onPress={() => (total > 0 ? setSurface('stage') : router.back())}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, flexGrow: 1 }}>
        {resumeVisible ? (
          <>
            {/* Frame 18. */}
            <PageMasthead title={RESUME_TITLE} />
            <View className="px-gutter">
              <Text variant="note" style={{ fontSize: 15 }}>
                {resumeBody(active)}
              </Text>
            </View>
            <View className="mt-4">
              <SettledGrid uris={jobs.slice(0, 6).map((j) => j.localUri)} />
            </View>
            <View className="flex-1" />
            <PageActions
              primary={RESUME_CTA}
              onPrimary={() => setResumeVisible(false)}
              secondary={RESUME_NEW}
              onSecondary={() => {
                setResumeVisible(false);
                clearSettled();
                setSurface('stage');
              }}
              quiet={resumeDiscard(active)}
              onQuiet={() => {
                setResumeVisible(false);
                // Every job, settled or not — "discard" is the only outcome on
                // this page that throws work away, and it throws away the batch
                // the page is about. The PHOTOGRAPHS are untouched: nothing here
                // deletes a file, exactly as W-02's "Not now" does not.
                for (const job of useQueueStore.getState().jobs) {
                  useQueueStore.getState().remove(job.id);
                }
                setSurface('stage');
              }}
            />
          </>
        ) : celebration !== null ? null : (
          <>
            {/* Frames 07 / 08 / 09 / 17 — one masthead, four readings. */}
            <PageMasthead
              title={
                !online && !allDone
                  ? waitingTitle(total)
                  : allDone
                    ? settledTitle(doneCount)
                    : filingTitle(total)
              }
              sub={allDone ? SETTLED_SUB : subline}
            />

            {/* Frame 17 — offline, stated once above the rows rather than on
                each of them. */}
            {!online && !allDone ? (
              <View className="pb-3.5">
                <AmberPlate
                  eyebrow={OFFLINE_EYEBROW}
                  body={OFFLINE_BODY}
                  primary="Try again"
                  busy={retrying}
                  onPrimary={() => void retryFailed()}
                />
              </View>
            ) : null}

            {/* Frame 19 — the request failed and can be retried in place.
                Distinct from offline and from a lost cut-out, which is the
                artifact's own failure-separation rule. */}
            {online && failedCount > 0 ? (
              <View className="pb-3.5">
                <AmberPlate
                  eyebrow={ERROR_EYEBROW}
                  body={userFacingFailure(failed[0])}
                  primary={canRetry ? 'Try again' : 'Leave them untagged'}
                  busy={retrying}
                  onPrimary={() => (canRetry ? void retryFailed() : clearFailed())}
                  secondary={canRetry ? ERROR_BACK : null}
                  onSecondary={() => router.replace('/(tabs)/closet')}
                />
              </View>
            ) : null}

            {allDone ? (
              /* Frame 09 — the grid of what just landed. */
              <SettledGrid uris={jobs.filter((j) => j.stage === 'done').map((j) => j.localUri)} />
            ) : (
              /* Frames 07 / 08 / 17 — one row per piece. */
              <View className="px-gutter" style={{ gap: PAGE.rowGap }}>
                {rows.map((row) => (
                  <FilingRowView key={row.id} row={row} imageUri={jobUri(row.id)} />
                ))}
              </View>
            )}

            {/* CP-05. Under the rows, over its own subject, and after the
                generic failure plate: a lost cutout is not a stopped piece, so
                it must not be read as one more of those. Frame 08 draws this
                plate with "Retake it / Skip it"; the shipped notice's own words
                are pinned verbatim by `tests/cutout-failure.test.ts` and are
                kept. Recorded as a deviation. */}
            {cutoutLost[0]?.id ? (
              <View className="px-gutter pt-3.5">
                <CutoutFailedNotice jobId={cutoutLost[0].id} count={cutoutLost.length} />
              </View>
            ) : null}

            {/* M-03, frame 15. Inline in the flow and below the rows that name
                what just landed, so the offer reads as a remark about the
                pieces the user is already looking at. It carries the page's
                only oxblood card. */}
            {offerJob?.itemId && offerPiece ? (
              <View className="px-gutter pt-4">
                <ListingOffer
                  brand={offerItem?.brand ?? null}
                  piece={offerPiece}
                  onFind={() => router.push(`/item/${offerJob.itemId}?match=1`)}
                  onDismiss={() => {
                    setOfferDismissed(true);
                    writeFlag(LISTING_OFFER_DISMISSED_KEY, true);
                  }}
                />
              </View>
            ) : null}

            {/* The social half of the promise, offered at the first moment it is
                actually true: real pieces exist and they are photographed well
                enough for a friend to browse.

                A REMARK, NOT A BANNER — frame 16 is one quiet line with an
                inline oxblood action. Withheld until the closet is a real one
                (`PLANS.free.items`, never a typed figure) and never drawn beside
                the ListingOffer, which carries this page's single oxblood card.
                THE CONDITION IS THE SHIPPED ONE, CHARACTER FOR CHARACTER. */}
            {allDone &&
            doneCount > 0 &&
            !offerJob &&
            (wardrobe.data?.length ?? 0) >= PLANS.free.items ? (
              <View className="pt-4">
                <InviteLine onPress={() => router.push('/invite')} />
              </View>
            ) : null}

            <View className="flex-1" />

            {allDone && doneCount > 0 ? (
              <PageActions
                primary={reviewCta(doneCount)}
                onPrimary={openReview}
                quiet={PHOTOGRAPH_MORE}
                onQuiet={() => setSurface('stage')}
              />
            ) : (
              /* Frame 07 has no button at all — the way onward is a verdict on
                 the whole batch, not a shortcut past it. What it has instead is
                 the promise that leaving costs nothing, and that promise is
                 true: the queue drains whether this screen is mounted or not. */
              <View className="px-gutter pt-4">
                {/* `note` already carries `muted`; `byline` is under AA as
                    text on canvas and this is a sentence, not a mark. */}
                <Text variant="note" style={{ fontSize: 13 }}>
                  {FILING_FOOT}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  // ── The celebration ───────────────────────────────────────────────────────

  const celebrationPage =
    celebration === null ? null : (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        className="flex-1"
        style={{ backgroundColor: theme.accent }}>
        {/* The one page in the app whose ground is the accent, so the status bar
            follows it rather than the app's light default. */}
        <StatusBar style="light" />
        <View
          className="flex-1"
          style={{ paddingBottom: insets.bottom + 10 }}
          accessibilityLiveRegion="polite">
          {/* Ten wells, five up — the pieces that got the user here, on their
              own ground rather than a photograph's. */}
          <View className="flex-row flex-wrap px-gutter pt-5" style={{ gap: PAGE.celebrationTileGap }}>
            {jobs
              .filter((j) => j.stage === 'done')
              .slice(0, 10)
              .map((job) => (
                <View
                  key={job.id}
                  className="overflow-hidden"
                  style={{
                    width: `${(100 - 4 * 1.9) / 5}%`,
                    height: PAGE.celebrationTileHeight,
                    borderRadius: PAGE.celebrationTileRadius,
                    backgroundColor: canvasAlpha(STAGE_ALPHA.door),
                  }}
                />
              ))}
          </View>

          <View className="px-gutter" style={{ paddingTop: 34 }}>
            {/* 56px, above `display`'s 40 — set inline with its own line height
                and WITHOUT `trim`: the trim table is a cap-height margin
                computed for each variant's own size, and applying display's to
                a 56px setting is the cap-trim bug ui/text.tsx exists to
                prevent, reintroduced by hand. */}
            <Text
              variant="display"
              style={{ fontSize: 56, lineHeight: 58, color: theme.canvas }}>
              {celebrationTitle(celebration)}
            </Text>
            <Text
              variant="body"
              className="mt-3"
              style={{ fontSize: 16, color: theme.blush }}>
              {CELEBRATION_BODY}
            </Text>
          </View>

          <View className="flex-1" />

          <PageActions
            primary={CELEBRATION_CTA}
            primaryTone="inverse"
            // Today is the tab group's index route — "See your first outfits"
            // means the page that dresses you, not a fourth destination.
            onPrimary={() => router.replace('/(tabs)')}
            quiet={CELEBRATION_SECONDARY}
            onQuiet={() => {
              // The celebration is a moment, not a state: dismissing it clears
              // the settled batch that produced it, which is the same sweep the
              // unmount effect above performs.
              clearSettled();
              setSurface('stage');
            }}
          />
        </View>
      </SafeAreaView>
    );

  // ── The stage ─────────────────────────────────────────────────────────────

  const stripUris = jobs.map((j) => j.localUri);
  const lastUri = stripUris.length > 0 ? stripUris[stripUris.length - 1]! : null;

  return (
    <>
      {explainerVisible ? (
        /*
        A-04 replaces the capture surface entirely at the moment of decline —
        full-screen content on canvas, not a banner over the dark stage. The
        sheets below stay mounted in a stable position, so the consent Modal
        finishes its slide-down over this page and the footnote's "Turn AI
        tagging on" can re-present the ask.
      */
        <>
          {/* Canvas ground, so the status bar goes back to the app's default. */}
          <StatusBar style="dark" />
          <DeclineExplainer onAddItem={addItemMyself} onTurnOnAi={reopenConsent} />
        </>
      ) : celebration !== null ? (
        celebrationPage
      ) : surface === 'batch' ? (
        batchPage
      ) : access === 'unasked' ? (
        /*
          Frame 01 — the ask, before the system sheet.

          "camera-ask, shown before the system prompt so the prompt is never
          spent blind. Both fallbacks are offered here, not hidden behind a
          refusal."

          Redesign 22 moves this off the ink stage and onto canvas: there is no
          live preview to float over yet, and a dark rectangle behind an ask is
          the black viewfinder this whole surface has been working to remove.
        */
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
          <StatusBar style="dark" />
          <View className="flex-row items-center justify-start px-gutter pt-2">
            <CloseDisc tone="canvas" onPress={() => router.back()} />
          </View>

          <CameraAsk
            onAsk={askForCamera}
            onLibrary={() => start('library')}
            onDescribe={() => start('describe')}
          />
        </SafeAreaView>
      ) : access === 'blocked' ? (
        /*
          Frame 02 — refused, and every fallback still open.

          "All three shipped routes stay: Settings, the library picker (no broad
          prompt), and describe. The prompt is never re-fired from here."

          On canvas rather than the ink stage, for the same reason frame 01 is:
          the states kit sets ink type, and ink on ink is the black rectangle
          this change exists to remove.
        */
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
          <StatusBar style="dark" />
          <View className="flex-row items-center justify-start px-gutter pt-2">
            <CloseDisc tone="canvas" onPress={() => router.back()} />
          </View>

          <PageMasthead
            title="The camera is switched off for Cinch"
            sub="There are two other ways in, and either one files a piece exactly the same."
          />

          <View className="px-gutter" style={{ gap: PAGE.rowGap }}>
            <FallbackDoor
              title="Choose from your library"
              body="Pick the photos yourself — no library access needed."
              onPress={() => start('library')}
            />
            <FallbackDoor
              title="Describe it instead"
              body="Colour and kind is enough to file a piece."
              onPress={() => start('describe')}
            />
          </View>

          <View className="flex-1" />

          <View style={{ paddingBottom: insets.bottom + 8 }}>
            <PageActions primary="Open Settings" onPrimary={openSettings} />
            <Text variant="note" className="px-gutter pt-2 text-center" style={{ fontSize: 13 }}>
              Turning the camera on in Settings brings you straight back here.
            </Text>
          </View>
        </SafeAreaView>
      ) : (
        <View className="flex-1" style={{ backgroundColor: CAPTURE.stage }}>
          {/* The capture stage is the one dark screen in a light-only app; the
          global status bar is dark-on-light, which would vanish here. */}
          <StatusBar style="light" />
          <SafeAreaView edges={['top', 'left', 'right']} className="flex-1">
            {/*
              Frame 04's chrome, and the whole of it.

              CP-01's serif title, its 132pt instruction foot, its dashed
              framing rectangle, its filed-count pill and its Done pill are all
              gone. What is left is a close disc, one label pill, four corner
              marks, a shutter and two doors — "no prose over the live preview:
              guidance lives in the ask before the camera opens and in the
              failure notice after, never floating on the frame."
            */}
            <View className="flex-row items-center justify-between px-gutter pb-2">
              <CloseDisc onPress={leaveStage} />
              <StagePill label={heldPill(total)} />
            </View>

            {/* The framed stage — a LIVE viewfinder. `heldCapture` is not drawn
                here any more: W-02 raises its own sheet over this surface and
                the frames give the held photograph no separate stage. */}
            <View
              className="flex-1 items-center justify-center"
              style={{ backgroundColor: CAPTURE.preview }}
              onLayout={(e) => setPreviewHeight(e.nativeEvent.layout.height)}>
              {live ? (
                <DeferredCameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  mode="picture"
                  active={focused}
                  onCameraReady={() => setSessionReady(true)}
                  onMountError={() => setPreviewFailed(true)}
                />
              ) : (
                /* A device with no preview to give — a simulator, or a session
                   that failed to mount. The corner marks alone are the right
                   answer: they say what to photograph without pretending a
                   camera is running. */
                <EmptyStagePlaceholder />
              )}
              <FramingCorners previewHeight={previewHeight} />
            </View>

            {/* Frame 06's strip — the batch, above the control row. */}
            <View style={{ paddingTop: 12 }}>
              <HeldStrip uris={stripUris} />
            </View>

            {/* Library · shutter · describe, at the frames' 76pt centre.
                Once something has finished filing the left slot carries the
                Review door as well, which is frame 06's own arrangement. */}
            <View
              className="flex-row items-center justify-between"
              style={{ paddingHorizontal: 26, paddingTop: 14, paddingBottom: insets.bottom + 10 }}>
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <LibraryDoor
                  onPress={() => start('library')}
                  thumbUri={lastUri}
                  count={total}
                  hint={`Opens your photos. Pick up to ${selectionLimit} at a time.`}
                />
                {doneCount > 0 ? (
                  <ReviewPill label={reviewPill(doneCount)} onPress={openReview} />
                ) : null}
              </View>

              <Shutter
                onPress={() => start('camera')}
                disabled={access !== 'granted'}
                busy={shooting}
                // `blocked` and `unasked` both have their own full-screen state
                // above, so the only two readings left here are granted and the
                // moment iOS's own alert is on top of this screen. Nothing may
                // be pressable while the OS owns the screen: a tap in that
                // window fell through to the system-camera fallback, which
                // requests the permission AGAIN — a second prompt stacked on a
                // question the user is already being asked.
                hint={
                  access === 'granted'
                    ? 'Files this piece and stays open'
                    : 'Waiting for camera access'
                }
              />

              <DescribeDoor onPress={() => start('describe')} />
            </View>
          </SafeAreaView>
        </View>
      )}

      {/*
        A described garment now joins the same queue a photographed one does
        (`tagImportedGarment`, fired by the import mutation), so the user stays
        here and watches it categorise on the rail like everything else.
      */}
      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAcceptConsent()}
        onDismissed={runResume}
        onDecline={() => {
          setConsentVisible(false);
          // The answer is recorded and the mode flips NOW — synchronously,
          // ahead of any query refetch — so the very next enqueue is local.
          setDeclinedLocally(true);
          writeFlag(DECLINED_KEY, true);
          localModeRef.current = true;
          // Nothing resumes on the way out: a decline is an answer, not a
          // pause. The photo that was waiting behind the sheet stays with
          // `pendingAction` instead — A-04's "Add the item myself" is what
          // carries it through the local pipeline.
          deferredAction.current = null;
          // First-ever decline gets the one full account of what changes
          // (A-04). Marked seen immediately: it is shown at the moment of
          // decline and never again — no second ask, no second explainer.
          if (!explainerSeen) {
            setExplainerSeen(true);
            writeFlag(EXPLAINER_SEEN_KEY, true);
            setExplainerVisible(true);
          }
        }}
      />

      {/*
        W-02 — the closet-full sheet. The photograph exists now (it was
        taken before this sheet ever appears — see `settleCapture`), so the
 atlas's own eyebrow is literally true and needs no softening.

        THE NUMBER: the atlas says the gain quoted here is for the specific
        garment ("a second coat would honestly read 'fourteen either
 way'"). The photograph in hand is not tagged — tagging is exactly
        the paid call this state exists to avoid spending on a garment that
        cannot yet be added — so its kind is genuinely unknown, and quoting
 `rankGaps`'s best case here would be the exact substitution the
        atlas forbids: printing a gain that belongs to a different piece.
        The body below says what IS true without naming a garment — today's
        real count, and that the eventual gain depends on what this is —
        rather than inventing an affordance to ask.
      */}
      <ClosetFullSheet
        visible={closetFullVisible}
        eyebrow={heldCapture && heldCapture.assets.length > 1 ? `${heldCapture.assets.length} photographed · not added yet` : 'Photographed · not added yet'}
        title={`Your closet is full at ${capacity.limit}.`}
        body={(() => {
          const tally = tallyOf(wardrobe.data ?? []);
          const today = countOutfits(tally);
          const plural = (heldCapture?.assets.length ?? 1) > 1;
          return `Your ${capacity.used} pieces make ${today} outfits today. What ${plural ? 'these would' : 'this would'} add depends on what ${plural ? 'they are' : 'it is'} — Cinch can't say until ${plural ? "they're" : "it's"} tagged. ${plural ? "They're" : "It's"} saved on your phone either way — nothing here deletes a photograph.`;
        })()}
        onSeePlans={seePlansForHeldCapture}
        seePlansBusy={gatePresenting}
        secondaryLabel="Make room for it"
        onSecondary={makeRoomForHeldCapture}
        tertiaryLabel="Not now"
        onDismiss={() => {
          setClosetFullVisible(false);
          // Discarding the HOLD, not the file: nothing here calls a delete —
          // the temp photo simply stops being tracked, same as if the app
          // were closed without acting on it. See the `heldCapture` docblock
          // above for why component state, not persistence, is the design.
          setHeldCapture(null);
        }}
      />
    </>
  );
}

/**
 * The stage with no session behind it.
 *
 * Not an error and not drawn as one: a simulator has no camera, and the corner
 * marks over the empty preview say exactly as much as they say over a live one.
 * A glyph used to sit here; the frames draw none, and a garment icon on a dark
 * rectangle is what "a camera that has failed to start" looks like.
 */
function EmptyStagePlaceholder() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="The camera preview is not available on this device"
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Frame 02's two doors — a title, a line under it, and a tinted glyph well.
 *
 * A row rather than a Button, because each one is a route with a reason
 * attached: "Pick the photos yourself — no library access needed" is the whole
 * point of offering it to somebody who has just refused a permission, and it
 * does not fit on a pill.
 */
function FallbackDoor({
  title,
  body,
  onPress,
}: {
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      onPress={onPress}
      className="flex-row items-center rounded-plate bg-tray active:opacity-70"
      style={{ minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, gap: 14 }}>
      <View className="items-center justify-center rounded-md bg-sand" style={{ width: 44, height: 44 }} />
      <View className="flex-1">
        <Text variant="body" style={{ fontSize: 16 }}>
          {title}
        </Text>
        <Text variant="note" className="mt-0.5" style={{ fontSize: 13 }}>
          {body}
        </Text>
      </View>
    </Pressable>
  );
}
