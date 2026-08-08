import { useQueryClient } from '@tanstack/react-query';
import { CameraView } from 'expo-camera';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressTrack } from '@/components/ui/progress-track';
import { Text } from '@/components/ui/text';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { GarmentSearchSheet } from '@/components/ingest/garment-search-sheet';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { ListingOffer } from '@/components/match/listing-offer';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { useCloset } from '@/features/closet/queries';
import { countOutfits, rankGaps, tallyOf } from '@/features/closet/outfit-count';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useCapture, type CapturedAsset } from '@/features/ingest/use-capture';
import { useWardrobe } from '@/features/styling/queries';
import {
  useQueueStore,
  selectActiveCount,
  selectFailedJobs,
  selectPhaseLabel,
} from '@/features/ingest/queue-store';
import { drainQueue, retryFailedJobs, userFacingFailure } from '@/features/ingest/upload-queue';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Whether this account has answered the consent sheet with "Keep my photos on
 * this phone". There is no server-side "declined" record — consent that was
 * never granted and consent that was declined look identical in `profiles` —
 * so the decline is persisted here, in the same kv-store the upload queue
 * uses, with `revokedAt` from the server as corroboration for a decline (a
 * revocation) made on another device. Simple and honest: the flag only ever
 * widens local mode, never grants anything.
 */
const DECLINED_KEY = 'cinch.ai-consent.declined.v1';
/** A-04 is shown once, at the moment of decline — never re-shown ("no second ask"). */
const EXPLAINER_SEEN_KEY = 'cinch.ai-consent.decline-explainer-seen.v1';
/**
 * M-03's card is dismissible FOREVER, so the dismissal is persisted in the same
 * kv-store the two flags above use — one read on mount, one write on the tap,
 * no server round trip for a preference the server has no opinion about. Like
 * those flags this is per install rather than truly per account; the item
 * detail row is the permanent way in either way, so the worst case of a
 * reinstall is one more offer, never a lost door.
 */
const LISTING_OFFER_DISMISSED_KEY = 'cinch.listing-offer.dismissed.v1';

function readFlag(key: string): boolean {
  try {
    return Storage.getItemSync(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    Storage.setItemSync(key, value ? 'true' : 'false');
  } catch {
    // Worst case the explainer shows once more; never block the flow over it.
  }
}

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
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas dark:bg-canvas-dark">
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
                className={`flex-row gap-3 border-t border-rule py-3 dark:border-rule-dark ${
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

/** The three ways a garment gets into the closet from this screen. */
type CaptureAction = 'library' | 'camera' | 'describe';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { pickFromLibrary, takePhoto, commit, selectionLimit } = useCapture();

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

  // `HeldPhotoStage` replaces `<CameraView>` in the tree while a photo is
  // held, which unmounts the live session. Reset readiness so a shutter tap
  // in the instant the view remounts waits for a real `onCameraReady` rather
  // than trusting a flag left over from before the hold.
  useEffect(() => {
    if (heldCapture) setCameraReady(false);
  }, [heldCapture]);

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
        setDescribeVisible(true);
      }
    },
    [pickFromLibrary, shoot, settleCapture],
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
  const active = selectActiveCount(jobs); // queued + in-flight, i.e. still to process
  const allDone = total > 0 && active === 0;
  // Everything the queue has finished ARGUING about, added or not. The ordinal
  // below counts these rather than the successes alone: a batch where the first
  // four failed was reading "Processing 1 of 5" while it worked on the fifth,
  // which is a count of nothing anybody could see.
  const settledCount = doneCount + failedCount;
  // Filled by settled jobs, not successes: a failure is work the queue has
  // finished, and a bar that ignores it stalls short of the truth. Floored at a
  // sliver, not zero: the first shot sits at 0 settled for its whole first
  // pass, and an empty track under "Processing 1 of 1" reads as a bar that
  // failed to start rather than one that has. Pinned to full on settle — the
  // track stays mounted then, so the floor must never lie about a finished
  // batch.
  const fraction = total ? (allDone ? 1 : Math.max(settledCount / total, 0.04)) : 0;
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
      ) : (
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
            <View className="mx-4 my-2 flex-1 overflow-hidden rounded-plate bg-canvas dark:bg-canvas-dark">
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
                variant="label"
                className="absolute"
                style={[
                  { bottom: 22, color: theme.canvas, opacity: 0.75 },
                  // Over a live scene the hint has no fixed backdrop to be legible
                  // against — a white shirt fills the frame and the line vanishes.
                  // Warm ink at 55%, not pure black: a neutral black shadow reads
                  // cold against the warm canvas type it sits under, and the
                  // palette has no true black in it anywhere else. The shadow
                  // belongs to the live preview alone; on the instructional frame
                  // there is nothing bright to defend against.
                  live
                    ? {
                        textShadowColor: 'rgba(28,26,22,0.55)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 4,
                      }
                    : null,
                ]}>
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
              <Text
                variant="label"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: theme.canvas }}>
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
              <Text
                variant="label"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{ color: theme.canvas }}>
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
                {/* Local mode gets the honest half of the promise — the amber
                declined banner this replaced is superseded by A-04, which said
                everything once; here the screen just works, and the copy only
                stops claiming a tagging pass that will not run. */}
                <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
                  {declinedMode
                    ? `Pick up to ${selectionLimit} photos at a time, or shoot pieces one by one. Photos stay on this phone, and the tags are yours to write.`
                    : `Pick up to ${selectionLimit} photos at a time, or shoot pieces one by one. Cinch cuts out the background and tags everything for you.`}
                </Text>
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
                      ? `Added ${doneCount} of ${total}`
                      : `Processing ${Math.min(settledCount + 1, total)} of ${total}${phase ? ` · ${phase}` : ''}`}
                  </Text>
                  {/* `label`, not `caption`: the count is a sibling of the headline,
                  not a footnote under a thumbnail — 11px beside 17px read as
                  debris. Colour rides inline; the variant's own `muted` loses
                  to it, which is the one precedence that holds. Once settled,
                  nothing rides here: a failure count already leads the banner
                  below as its eyebrow, and saying it twice is nagging. */}
                  {!allDone ? (
                    <Text variant="label" style={{ color: theme.faint }}>{`${active} to go`}</Text>
                  ) : null}
                </View>

                {/* Ink fill, not accent: this sheet's promoted action ("Review
                tags") is already ink, and an oxblood bar above an ink button
                spends the accent on a meter. Stays mounted when the batch
                settles, pinned to full — the finished bar is part of the
                record, not scaffolding to strike. */}
                <ProgressTrack value={fraction} tone="ink" height={6} className="my-3" />

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
              </>
            )}
          </View>
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
      <GarmentSearchSheet visible={describeVisible} onClose={() => setDescribeVisible(false)} />

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
