import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { CameraAsk } from '@/components/ingest/camera-ask';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { CutoutFailedNotice } from '@/components/ingest/cutout-failed-notice';
import {
  DeferredCameraView,
  type CameraViewHandle,
} from '@/components/ingest/lazy-camera-view';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { ListingOffer } from '@/components/match/listing-offer';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
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
  queueAnnouncement,
  queueCards,
  type QueueFacts,
} from '@/features/ingest/queue-count';
import { useCapture, type CapturedAsset } from '@/features/ingest/use-capture';
import { useWardrobe } from '@/features/styling/queries';
import { CAMERA_AVAILABLE } from '@/features/ingest/camera-availability';
import { cutoutFailures } from '@/features/ingest/cutout-failure';
import {
  useQueueStore,
  selectActiveCount,
  selectFailedJobs,
  selectPhaseLabel,
} from '@/features/ingest/queue-store';
import { drainQueue, retryFailedJobs, userFacingFailure } from '@/features/ingest/upload-queue';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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

/**
 * The held photograph, shown behind W-02 exactly as the atlas draws it — the
 * shot that was just taken, translucent, on the dark stage. `scrim` is the
 * app's own token for "a gradient over garment photography" (see
 * tailwind.config.js), not a literal alpha typed here.
 */
function HeldPhotoStage({
  uri,
  count,
  theme,
}: {
  uri: string;
  count: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View className="mx-4 my-2 flex-1 overflow-hidden rounded-plate">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />
      {count > 1 ? (
        <View
          className="absolute right-3 top-3 rounded-full px-2.5 py-1"
          style={{ backgroundColor: theme.scrim }}>
          <Text variant="caption" style={{ color: theme.canvas }}>
            {`+${count - 1} more`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * CP-01's framing guide.
 *
 * "The preview keeps 20 pt corners and the framing guide 16 pt, which is the
 * same family as every sheet in the group." Four corner Ls used to stand here;
 * the frame draws one dashed rectangle inset from the preview, which reads as a
 * region to fill rather than as four marks to align to.
 *
 * `pointerEvents="none"` throughout: a guide that swallowed a tap on the
 * preview would be chrome pretending to be a control.
 */
function FramingGuide({ canvas }: { canvas: string }) {
  return (
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
        borderColor: canvas,
        opacity: 0.42,
      }}
    />
  );
}

/**
 * The 55% ink scrim CP-01 sets every piece of chrome on.
 *
 * "Close, Done and Describe are regular weight, paper ink on a 55% scrim rather
 * than filled buttons, so the live garment is the brightest region of the
 * frame; the only filled element is the shutter, which is the one thing the
 * screen is for."
 */
const CHROME_SCRIM = 'rgba(28,26,22,0.55)';

/**
 * CP-03's queue, drawn as the atlas draws it: counted rows, never a bar.
 *
 * Two rules are carried here rather than at the call site. Zero is quiet — a
 * row with nothing in it is absent, not printed as "0" — and the pair is one
 * accessibility node with one live region, because the accessibility note asks
 * for a single announcement on change rather than one per row per tick.
 *
 * The rule above the rows is the same hairline the rest of the sheet uses; it
 * separates the sentence from the counts without boxing them, which is what
 * turned the old treatment into a meter in the first place.
 */
function QueueCount({ facts }: { facts: QueueFacts }) {
  const cards = queueCards(facts);
  const announcement = queueAnnouncement(facts);
  if (cards.length === 0) return null;

  return (
    <View
      className="mt-3 flex-row gap-2.5"
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={announcement ?? undefined}>
      {cards.map((card) => (
        // Equal halves, so neither card reads as the more important one — one
        // is an identity and the other a count, not a primary and a footnote.
        // Tray fill at the 12pt radius; no rule, no meter, no fill that grows.
        <View key={card.state} className="flex-1 rounded-md bg-tray px-3 py-2.5">
          {/* The lead is the fact — a garment's name or a spelled remainder —
              so it takes the LABEL weight. The state under it is prose in the
              regular cut (`note`), per the constitution's weight rule. */}
          <Text variant="label" numberOfLines={1} className="text-ink">
            {card.lead}
          </Text>
          <Text variant="note" numberOfLines={1}>
            {card.state}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The three ways a garment gets into the closet from this screen. */
type CaptureAction = 'library' | 'camera' | 'describe';

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
    // CP-04, drawn here rather than redirected to `/camera-unavailable`: this
    // route was reached directly — a deep link, a notification, a restored
    // session — and bouncing somebody to a second route would lose the Close
    // that takes them back where they came from.
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="flex-row justify-start px-gutter pt-6">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            onPress={() => router.back()}
            className="py-1 active:opacity-60">
            <Text variant="body">
              Close
            </Text>
          </Pressable>
        </View>
        <View className="mt-8">
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
   * Camera permission is asked for HERE, on the way in — but CP-02 puts a
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

  // `HeldPhotoStage` replaces `<CameraView>` in the tree while a photo is held,
  // which unmounts the live session — so readiness must not survive the hold. A
  // shutter tap in the instant the view remounts has to wait for a real
  // `onCameraReady` rather than trusting a flag left over from before.
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

  // Rehydrate a batch interrupted by a kill or a crash, and resume it.
  useEffect(() => {
    hydrate();
    void drainQueue();
  }, [hydrate]);

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
  // CP-05 — the pieces that were filed but arrived without a cutout.
  const cutoutLost = cutoutFailures(jobs);
  const active = selectActiveCount(jobs); // queued + in-flight, i.e. still to process
  const allDone = total > 0 && active === 0;
  // Everything the queue has finished ARGUING about, added or not. The ordinal
  // below counts these rather than the successes alone: a batch where the first
  // four failed was reading "Processing 1 of 5" while it worked on the fifth,
  // which is a count of nothing anybody could see.
  const settledCount = doneCount + failedCount;
  // CP-03's first card names the garment, so the notice over a captured frame
  // can be told apart from the one over the next piece. Read off the queue's
  // own label, which the tagger writes when it has an answer — undefined until
  // then, and the card falls back to a count rather than inventing a name.
  const firstReadyName = jobs.find((j) => j.stage === 'done' && j.label)?.label ?? null;
  //
  // CP-03: THE BAR IS GONE, AND IT IS NOT COMING BACK.
  //
  // A `ProgressTrack` used to sit here, filled by `settledCount / total`. The
  // constitution's refusal is flat — "Progress is a count, never a bar or
  // percentage" — and the atlas draws CP-03's queue as two counted rows under
  // the annotation "Queue is a count". Neither the fraction nor the component
  // is computed any more: a derived value kept "just in case" is how a refused
  // treatment finds its way back onto a screen.
  //
  // What replaces it is `QueueCount` below, which reads the same jobs and
  // prints them as ready-to-review and still-in-the-queue counts. Zero is
  // quiet: a row whose count is nought is not drawn at all.
  // What the batch is actually doing this second — "cleaning up…",
  // "categorising…". Named rather than implied, because a long tagging pass over
  // a slow connection is otherwise indistinguishable from nothing happening.
  const phase = selectPhaseLabel(jobs);
  const canRetry = failed.some((j) => j.retryable !== false);
  const [retrying, setRetrying] = useState(false);

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
      ) : access === 'unasked' ? (
        /*
          CP-02 — the ask, before the system sheet.

          "The ask states what the permission is for, that the following prompt
          belongs to the system, and where the photograph goes. The second
          action is a real alternative rather than a decline, so refusing does
          not end the intake. Nothing is oxblood: this frame asks, it does not
          sell."

          It replaces the stage rather than floating over it: there is no live
          preview to float over, and a dark rectangle behind an ask is the black
          viewfinder this whole surface has been working to remove.
        */
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
          <StatusBar style="light" />
          <View className="flex-row items-center justify-start px-gutter pt-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => router.back()}
              style={{ minHeight: MIN_TAP_TARGET, backgroundColor: CHROME_SCRIM }}
              className="items-center justify-center rounded-md px-3 active:opacity-70">
              <Text variant="body" style={{ fontSize: 16, color: theme.canvas }}>
                Close
              </Text>
            </Pressable>
          </View>

          <CameraAsk onAsk={askForCamera} onLibrary={() => start('library')} />
        </SafeAreaView>
      ) : (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
          {/* The capture stage is the one dark screen in a light-only app; the
          global status bar is dark-on-light, which would vanish here. */}
          <StatusBar style="light" />
          {/*
            CP-01's chrome. The serif "Add clothes" title that used to lead this
            row is gone: the frame draws no title on the stage at all, because
            "the live garment is the brightest region of the frame" and a 24pt
            serif in the corner is the second brightest.

            ONE CONTROL, NOT TWO. The frame draws Close on the left and Done on
            the right. Both of them leave this stage and nothing distinguishes
            their outcomes — an import keeps running in the queue either way —
            so shipping both would be one control drawn twice, which is worse
            than the frame being one pill short. Recorded as a deviation.

            "Regular weight, paper ink on a 55% scrim rather than filled
            buttons": a pill at r12 and the 44pt floor, never a fill.
          */}
          <View className="flex-row items-center justify-end px-gutter pt-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done adding clothes"
              onPress={() => router.back()}
              style={{ minHeight: MIN_TAP_TARGET, backgroundColor: CHROME_SCRIM }}
              className="items-center justify-center rounded-md px-3 active:opacity-70">
              <Text variant="body" style={{ fontSize: 16, color: theme.canvas }}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* The framed stage — a LIVE viewfinder, per 07a. It was an instructional
          frame with a garment glyph in it, which on a dark screen reads as a
          camera that has failed to start; the corner guides and the hint now
          sit over the real preview they were always drawn for. `heldCapture`
          takes priority over all of it: W-02's atlas draws the shot just
          taken, not the live feed, behind its sheet. */}
          {heldCapture ? (
            <HeldPhotoStage uri={heldCapture.assets[0]!.uri} count={heldCapture.assets.length} theme={theme} />
          ) : access === 'blocked' ? (
            /* Declined, and on iOS that decision is final until Settings — so this
           is a plate rather than a prompt. It is drawn on canvas, not on the
           ink stage: the states kit sets ink type, and ink on ink is the black
           rectangle this whole change exists to remove. The two other doors
           below stay open, so a refused camera narrows the screen instead of
           ending it. */
            <View className="mx-4 my-2 flex-1 overflow-hidden rounded-plate bg-canvas">
              <EmptyState
                symbol="camera.fill"
                tone="blocked"
                title="Camera access is off"
                body="Cinch can’t show the viewfinder without it. Turn the camera on in Settings, or add clothes from your library instead."
                actionTitle="Open Settings"
                onAction={openSettings}
              />
            </View>
          ) : (
            <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
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
              <FramingGuide canvas={theme.canvas} />

              {/*
                CP-01: "The count of pieces filed in this session sits at the
                top of the preview as a quiet label, so the progress claim is a
                count and never a bar."

                A real count, read off the queue's own finished jobs — never a
                fabricated one — and ZERO IS QUIET: before anything has been
                filed there is no label at all, because "0 pieces filed just
                now" is a sentence about nothing.
              */}
              {doneCount > 0 ? (
                <View
                  className="absolute self-center rounded-md px-3 py-1.5"
                  style={{ top: 16, backgroundColor: CHROME_SCRIM }}
                  accessibilityLiveRegion="polite">
                  <Text variant="note" style={{ fontSize: 13, color: theme.canvas }}>
                    {`${doneCount} ${doneCount === 1 ? 'piece' : 'pieces'} filed just now`}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/*
            CP-01's INSTRUCTION FOOT — audit 69.

            "the instruction panel is a 132 pt foot holding one sentence and the
            control row — a 48 pt library thumb, a 72 pt shutter, a 48 pt
            Describe target — instead of a sheet climbing a third of the way up
            the preview."

            The sentence used to sit INSIDE the preview, over the live garment,
            with a text shadow to survive a white shirt behind it. It comes out
            here, where it has a ground of its own and needs no shadow — and the
            preview keeps every pixel of itself.

            The sentence is drawn only while nothing is in flight: once the
            queue has work, CP-03's own copy is on screen below and two
            instructions at once is one too many.
          */}
          <View
            className="justify-center px-gutter"
            style={{ minHeight: total === 0 ? 132 : 120 }}>
            {total === 0 ? (
              <Text
                variant="note"
                className="mb-3.5 text-center"
                style={{ fontSize: 15, lineHeight: 22, color: theme.canvas, opacity: 0.86 }}>
                One piece, laid flat or on a hanger. Any wall will do.
              </Text>
            ) : null}

            {/*
              Library · shutter · describe. The handoff draws "Flip" in the
              third slot; "Describe" holds it instead, and now that the preview
              is live that is a choice rather than a limitation. A front camera
              photograph of a garment held at arm's length is not a garment
              photograph, so flip would be a control for a shot nobody wants —
              while describe is the door for the pieces somebody will never get
              round to photographing at all.
            */}
            <View className="flex-row items-center justify-between">
              {/*
                THE FRAME DRAWS A PHOTOGRAPH IN THIS 48pt WELL — the user's most
                recent library picture. Reading that needs the photo library,
                which is a permission this door explicitly does not ask for
                ("Photo library opens the system picker and asks for nothing"),
                and putting any other image in it would be inventing a
                photograph. So the well is drawn at the frame's geometry with a
                line mark in it, which is what the rest of the app does for a
                picture it does not have.
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose from library"
                accessibilityHint={`Opens your photos. Pick up to ${selectionLimit} at a time.`}
                onPress={() => start('library')}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: `${theme.canvas}4D`,
                }}
                className="items-center justify-center active:opacity-70">
                <SymbolView
                  name="photo.on.rectangle"
                  size={22}
                  tintColor={theme.canvas}
                  resizeMode="scaleAspectFit"
                />
              </Pressable>

              {/* Dimmed and inert until the camera is actually GRANTED, rather
              than live over a plate that has just said it cannot open — the
              Settings button in the stage is the one way forward from there,
              and a shutter that fires an alert saying the same thing is a
              second, worse copy of it.

              `!== 'granted'`, not `=== 'blocked'`: `checking` is the state
              while iOS's own permission alert is on screen, and the shutter was
              live underneath it. A tap there fell through to the system-camera
              fallback, which requests the permission AGAIN — a second OS prompt
              stacked on the first, over a question the user is already being
              asked. Nothing here should be pressable while the OS owns the
              screen.

              72pt, and the ONLY filled element on the stage: "the shutter,
              which is the one thing the screen is for." */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photograph"
                accessibilityHint={
                  access === 'blocked'
                    ? 'Turn on camera access in Settings to use this'
                    : access === 'granted'
                      ? 'Files this piece and stays open'
                      : 'Waiting for camera access'
                }
                accessibilityState={{ disabled: access !== 'granted', busy: shooting }}
                disabled={access !== 'granted' || shooting}
                onPress={() => start('camera')}
                className="items-center justify-center active:opacity-80"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: theme.canvas,
                  opacity: access !== 'granted' ? 0.35 : 1,
                }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    borderWidth: 2,
                    borderColor: theme.ink,
                    opacity: shooting ? 0.5 : 1,
                  }}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Describe it instead"
                accessibilityHint="Find a picture of a garment by describing it"
                onPress={() => start('describe')}
                style={{ minWidth: 48, minHeight: 48 }}
                className="items-end justify-center active:opacity-70">
                {/* Regular weight on the scrim, per audit 68 — not a filled
                    button and not Medium. */}
                <Text
                  variant="note"
                  numberOfLines={1}
                  style={{ fontSize: 15, color: theme.canvas, opacity: 0.86 }}>
                  Describe
                </Text>
              </Pressable>
            </View>
          </View>

          {/*
            THE STANDING SHEET IS GONE FROM THE READY STATE.

            A `rounded-t-plate` panel used to sit under the controls at all
            times, carrying a serif "Photograph your closet" and a paragraph.
            CP-01 draws no such panel: audit 69 is precisely that the
            instruction stops being "a sheet climbing a third of the way up the
            preview" and becomes a 132pt foot with one sentence in it, which the
            block above now is.

            Nothing the paragraph said is lost. The batch size moved to the
            library control's own hint, and the local-mode sentence — the one
            that promises the photographs stay on this phone — is kept below,
            because a privacy statement is not furniture and does not get
            dropped with the panel that happened to be holding it.
          */}
          {total === 0 && declinedMode ? (
            <View className="px-gutter" style={{ paddingBottom: insets.bottom + 12 }}>
              <Text
                variant="note"
                className="text-center"
                style={{ fontSize: 13, color: theme.canvas, opacity: 0.72 }}>
                Photos stay on this phone, and the tags are yours to write.
              </Text>
            </View>
          ) : null}

          {/* CP-03's sheet — bg-surface, rounded top corners, flush to the
          bottom edge. Everything below is driven by the queue state, and it is
          drawn only when the queue HAS state. */}
          {total > 0 ? (
            <View
              className="rounded-t-plate bg-surface px-gutter pt-4"
              style={{ paddingBottom: insets.bottom + 20 }}>
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
                      ? `Added ${doneCount} of ${total}`
                      : `Processing ${Math.min(settledCount + 1, total)} of ${total}${phase ? ` · ${phase}` : ''}`}
                  </Text>
                  {/* `label`, not `caption`: the count is a sibling of the headline,
                  not a footnote under a thumbnail — 11px beside 17px read as
                  debris. Colour rides inline as `muted` — `faint` is under AA
                  on canvas and this is text, not a decorative mark. Once
                  settled, nothing rides here: a failure count already leads
                  the banner below as its eyebrow, and saying it twice is
                  nagging. */}
                  {!allDone ? (
                    <Text variant="label" style={{ color: theme.muted }}>{`${active} to go`}</Text>
                  ) : null}
                </View>

                {/* CP-03. The bar that stood here is replaced by the queue
                    stated as counts — see the note over `settledCount`. The
                    sentence is the frame's own "work continues during
                    processing", and it is true: the shutter above stays live
                    through the whole batch. */}
                {!allDone ? (
                  <Text variant="note" className="mt-1.5">
                    Cutting it out and reading its colour. You can keep photographing while this
                    finishes.
                  </Text>
                ) : null}

                <QueueCount facts={{ ready: doneCount, waiting: active, firstReadyName }} />

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
                    {/* Ink, inline: `label` ships `muted`, and the sentence is the
 banner's actual content — the eyebrow above it is the quiet
                    layer, not this. */}
                    <Text variant="label" className="mt-1" style={{ color: theme.ink }}>
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
                          title="Try again"
                          variant="ink"
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

                {/* CP-05. Under the rail, over its own subject, and after the
                    generic failure banner: a lost cutout is not a stopped
                    piece, so it must not be read as one more of those. */}
                {cutoutLost[0]?.id ? (
                  <CutoutFailedNotice jobId={cutoutLost[0].id} count={cutoutLost.length} />
                ) : null}

                {/* M-03. Inline in the flow and below the rail that names what
                just landed, so the offer reads as a remark about the piece the
                user is already looking at. It carries the screen's only
                oxblood; "Review tags" underneath is ink, which is why the two
                can sit together at all. */}
                {offerJob?.itemId && offerPiece ? (
                  <ListingOffer
                    brand={offerItem?.brand ?? null}
                    piece={offerPiece}
                    onFind={() => router.push(`/item/${offerJob.itemId}?match=1`)}
                    onDismiss={() => {
                      setOfferDismissed(true);
                      writeFlag(LISTING_OFFER_DISMISSED_KEY, true);
                    }}
                  />
                ) : null}

                {/* `ink`, not `primary`: the atlas draws the promoted state as the
                ink fill — this screen has no oxblood on it anywhere, and the
                way onward should not be the place it appears. Always ink when
                shown: the atlas draws it ink-filled even beside a retry
                (Q-04). And only once the batch has settled — mid-batch (Q-02)
                the sheet shows no button at all, because the way onward is a
                verdict on the whole batch, not a shortcut past it. */}
                {allDone && doneCount > 0 ? (
                  <Button
                    title="Review tags"
                    variant="ink"
                    onPress={() => router.replace('/review')}
                    haptic
                    className="mt-4"
                  />
                ) : null}

                {/* The social half of the promise, offered at the first moment
                    it is actually true: real pieces exist and they are
                    photographed well enough for a friend to browse. The
                    sign-in cover promises it twice and no onboarding surface
                    has mentioned it since.

                    A REMARK, NOT A BANNER — one quiet muted line under the
                    batch that just landed. No accent: it is withheld until the
                    closet is a real one (`PLANS.free.items`, never a typed
                    figure) and never drawn beside the ListingOffer, which
                    carries this screen's single oxblood. */}
                {allDone &&
                doneCount > 0 &&
                !offerJob &&
                (wardrobe.data?.length ?? 0) >= PLANS.free.items ? (
                  <Pressable
                    onPress={() => router.push('/invite')}
                    accessibilityRole="button"
                    className="items-center justify-center active:opacity-70"
                    style={{ minHeight: MIN_TAP_TARGET }}>
                    <Text variant="note" style={{ color: theme.muted }}>
                      Let a friend borrow from these
                    </Text>
                  </Pressable>
                ) : null}
              </>
            </View>
          ) : null}
        </SafeAreaView>
      )}

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
