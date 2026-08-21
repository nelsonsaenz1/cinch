import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { CameraDenied } from '@/components/onboarding/camera-denied';
import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { TenBody } from '@/components/onboarding/ten-body';
import { TenCamera } from '@/components/onboarding/ten-camera';
import { TenMasthead, TroublePlate } from '@/components/onboarding/ten-parts';
import { TenNoRoomNotice } from '@/components/onboarding/ten-no-room-notice';
import { TenRepair } from '@/components/onboarding/ten-repair';
import { TenReplaceSheet } from '@/components/onboarding/ten-replace-sheet';
import { TenStopSheet } from '@/components/onboarding/ten-stop-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { useRemoveItems } from '@/features/closet/mutations';
import { useArchiveItems, useRestoreItems } from '@/features/closet/storage';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { CAMERA_AVAILABLE } from '@/features/ingest/camera-availability';
import { matchOfferJob } from '@/features/ingest/match-eligibility';
import { selectActiveCount, useQueueStore } from '@/features/ingest/queue-store';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useUnfinishedWalkthrough } from '@/features/intake/queries';
import { starterReadiness } from '@/features/onboarding/starter-readiness';
import {
  TEN_TITLE,
  noRoomCopy,
  replaceFailureLine,
  replacedAnnouncement,
  type TenPhase,
} from '@/features/onboarding/ten-copy';
import { PAD, TEN, WELL_RADIUS, tenMeasure } from '@/features/onboarding/ten-spec';
import {
  applyReplace,
  initialReplaceState,
  replaceReducer,
} from '@/features/onboarding/ten-replace';
import {
  fillSlot,
  filledCount,
  hydrateFromWardrobe,
  isComplete,
  nextSlot,
  placedIds,
  type TenSlot,
} from '@/features/onboarding/ten-slots';
import { canGenerate, useWardrobe } from '@/features/styling/queries';
import { track, trackOnce } from '@/lib/posthog';
import type { Garment } from '@/lib/styling';

/**
 * The Ten — Directive 1's guided capture, states T-01…T-07.
 *
 * A single screen with three layers of state on top of the wardrobe query:
 * which ten positions are filled (`slots`), which one the user is looking at
 * (`foregroundedId`, defaulting to `nextSlot` but overridable by a direct
 * tap — "order is a suggestion"), and whichever modal is open on top of it
 * (the camera, or the stop sheet once the ten is complete AND ready). See
 * docs/design/free-tier-contract.md and design-refs/html/The Ten State Atlas
 * for the states this renders.
 *
 * WHAT DECIDES THE ENDING, which is the whole of this correction.
 *
 * The grid used to prescribe ten NAMED positions and therefore guaranteed its
 * own success: filling them in order always produced a top, a bottom and a
 * pair of shoes, so "ten filled" and "ready to style" were the same event. The
 * positions are generic now (`ten-slots.ts`), so they are two different events
 * and this screen has to hold both:
 *
 *   - ten filled AND `starterReadiness().ready` → T-06, the stop sheet;
 *   - ten filled and NOT ready → T-07, `TenRepair`, over a live grid;
 *   - a photograph still being read → neither, until it settles.
 *
 * Readiness is read from the classifier's output over the real wardrobe and
 * never from which cell a photograph was taken in.
 *
 * HOW IT IS ENTERED, which is a newer question than the screen is.
 *
 * This was written as the first thing a brand-new account ever saw, and for
 * most of its life it was unreachable — the tour exited to `/capture` and the
 * only route here was the Reveal's own repair loop. Since D1
 * (docs/design/positioning-contract.md §5) it is the default first run, so it
 * is now opened in states it was never shown:
 *
 *  - EMPTY CLOSET — the state it was designed for; T-01.
 *  - SOME PIECES ALREADY IN, from a capture before the tour, or a session
 *    abandoned half way. `hydrateFromWardrobe` places them, so the flow
 *    resumes at the count rather than asking for the same photographs twice.
 *    Positions are generic now, so every category resumes — a watch, a hat, a
 *    fourth pair of trousers. The old kind-matched hydration silently dropped
 *    anything the template had no position for, which is the second half of
 *    the same bug the grid's labels were the first half of.
 *  - A CLOSET ALREADY PAST THE TEN. `exitDestination` keeps that reader out of
 *    here entirely, because a stop sheet reading "That's the ten" over sixty
 *    garments is a lie. The one path that can still land here is the fallback
 *    when the wardrobe read has not settled by the time TR-03 is tapped; the
 *    hydration below then completes the ten immediately and the flow stops on
 *    the sheet, which is the honest thing for it to say once it is here.
 *  - THE REVEAL'S REPAIR LOOP, unchanged: `reveal.tsx` replaces to this route
 *    for a closet that photographed ten pieces and made no outfit.
 *
 * There is no in-app door to this screen after the tour has been spent. That
 * is a real hole and it is not this file's to close — see the note on the
 * Today empty state in the wave report.
 */
export default function TheTenScreen() {
  const router = useRouter();
  const wardrobe = useWardrobe();
  const camera = useCameraAccess();
  /** TR-06's card, or null. Read on mount so the doors never swap under a
   *  reader who is already looking at them. */
  const unfinished = useUnfinishedWalkthrough();
  /**
   * `?door=photograph` skips TR-05.
   *
   * TR-05 is the question "how would you rather do this", and it must not be
   * asked of somebody who has already answered it: the Walkthrough's
   * "Photograph them instead", every V-13 fork, and the Reveal's repair loop
   * all arrive here having just chosen the camera. Without the param they
   * would be shown the two doors again, with the door they just walked through
   * offered as if it were a fresh choice.
   */
  const { door } = useLocalSearchParams<{ door?: string }>();

  const [slots, setSlots] = useState<TenSlot[] | null>(null);
  const hydrated = useRef(false);

  // Resume at the count, not at the start (free-tier-contract.md §2) — once
  // the real closet loads, any already-tagged garment fills its matching
  // slot exactly once.
  useEffect(() => {
    if (hydrated.current || !wardrobe.data) return;
    hydrated.current = true;
    setSlots(hydrateFromWardrobe(wardrobe.data));
  }, [wardrobe.data]);

  const [foregroundedOverride, setForegroundedOverride] = useState<number | null>(null);
  const [cameraSlotId, setCameraSlotId] = useState<number | null>(null);
  const [cameraStart, setCameraStart] = useState<'camera' | 'library'>('camera');
  /**
   * The stop sheet is DERIVED, not stored.
   *
   * It used to be a `useState` set from an effect that watched for the tenth
   * slot. That worked while completion was the only condition; it stops
   * working once readiness can arrive later than the tenth photograph — a
   * tagging pass finishing thirty seconds after the grid filled has to be able
   * to raise the sheet, and an effect that has already fired once cannot.
   * Deriving it means the sheet tracks the truth continuously, and the only
   * thing worth remembering is whether the reader has waved it away.
   */
  const [stopDismissed, setStopDismissed] = useState(false);
  /**
   * T-05 is entered by TRYING, never by inspecting.
   *
   * A screen that reads the permission on mount and renders the failure would
   * meet a reader who has not asked for the camera yet with a sentence about
   * the camera being off. The fork is drawn only once a Photograph tap has
   * found the door locked.
   */
  const [cameraRefused, setCameraRefused] = useState(false);
  /**
   * The slot a replacement was refused for because the ACCOUNT is full — the
   * total ceiling, stored pieces counted.
   *
   * Held rather than alerted. This is the one failure whose remedy is not a
   * retry and not a permission, so it is drawn under the grid (`TenNoRoomNotice`)
   * where the reader can reach Storage or the plans from it. Every other
   * failure keeps the system alert, which is right for a fact that stops being
   * true the moment it is read.
   */
  // A reducer rather than useState for one mechanical reason: the slot is set
  // from inside the failure effect below, and dispatching is the sanctioned
  // way to move state from an effect (react-hooks/set-state-in-effect).
  const [noRoomSlot, setNoRoomSlot] = useReducer(
    (_prev: number | null, slot: number | null) => slot,
    null,
  );
  /**
   * The position a replacement has just landed in, or null — redesign 21's
   * `swapped` band.
   *
   * KEPT UNTIL THE READER MOVES, never on a timer. The frame draws "TEN OF TEN
   * · Swapped" over "Linen coat filed. Camel shirt archived.", which is a
   * report on a write that has finished; a report that erases itself after two
   * seconds is one a reader who looked away has no way to get back. Every next
   * action clears it, because every next action supersedes it.
   *
   * A reducer for the same mechanical reason `noRoomSlot` is one: it is set
   * from inside the retire effect, and dispatching is the sanctioned way to move
   * state from an effect (react-hooks/set-state-in-effect).
   */
  const [swappedSlot, setSwappedSlot] = useReducer(
    (_prev: number | null, slot: number | null) => slot,
    null,
  );
  /** TR-05 is answered by walking through a door, and only asked once. */
  const [doorChosen, setDoorChosen] = useState(door === 'photograph');

  const openCamera = useCallback(
    (slotId: number, mode: 'camera' | 'library') => {
      // Any next action supersedes the swap report — see `swappedSlot`.
      setSwappedSlot(null);
      if (mode === 'camera' && camera.access === 'blocked') {
        setCameraRefused(true);
        return;
      }
      setCameraRefused(false);
      setCameraStart(mode);
      setCameraSlotId(slotId);
    },
    [camera.access],
  );

  // ── LP-02 · replacing the photograph in a filled position ────────────────
  //
  // The rules live in `ten-replace.ts` and are tested there; this is only the
  // wiring. What the screen owns is the four writes the machine asks for —
  // store, discard, restore, and the one slot swap — and nothing else about a
  // replacement is decided here.
  //
  // The effects below depend on the whole `replace` object and that is safe
  // rather than sloppy: `replaceReducer` returns the SAME object for every
  // event that does not belong to the current phase, so `useReducer` keeps the
  // identity and an archive cannot be re-fired by an unrelated render.
  const [replace, dispatchReplace] = useReducer(replaceReducer, initialReplaceState);
  /**
   * The row the incoming photograph created, if any.
   *
   * Kept OUTSIDE the machine because it is not part of the contract — it is a
   * piece of rubbish to sweep up. A replacement that fails after the row is
   * written leaves an item with no photograph on it, and on the no-room path
   * that orphan is also sitting in the active slot the outgoing piece has to
   * come back to, so it is discarded before the restore is attempted.
   */
  const orphanRef = useRef<string | null>(null);
  /**
   * The outgoing photograph, held for the life of the flow.
   *
   * On the no-room path the outgoing piece is archived before the camera opens
   * and therefore leaves `useWardrobe`, which would blank the tile behind the
   * sheet. The contract says the old photograph stays until the new one lands,
   * and this is that sentence in the render.
   */
  const [heldPiece, setHeldPiece] = useState<{
    slotId: number;
    uri?: string;
    name: string | null;
  } | null>(null);

  /**
   * The composition, for the two states that draw chrome without a tray.
   *
   * Read here rather than inside the error and loading branches because those
   * are early returns and a hook cannot live behind one. `TenBody` measures
   * again for itself — the same pure function over the same window, so the two
   * cannot disagree, and neither has to be handed the other's answer.
   */
  const window = useWindowDimensions();
  const chromeMeasure = tenMeasure({ fontScale: window.fontScale, height: window.height });

  const capacity = useCapacity();
  // Only ever used by the no-room plate's "See plans", whose placement is the
  // one whose whole contract is a closet the server has already refused.
  const gate = useGate();
  const archive = useArchiveItems();
  const restore = useRestoreItems();
  const discard = useRemoveItems();
  const jobs = useQueueStore((s) => s.jobs);

  // 10/10 only — store the outgoing piece so the incoming insert has a slot.
  // `enforce_item_limit` refuses it otherwise, which would make a replacement
  // at the ceiling impossible rather than merely awkward.
  useEffect(() => {
    if (replace.phase !== 'freeing') return;
    const { outgoingId } = replace;
    let live = true;
    void archive
      .mutateAsync({ ids: [outgoingId] })
      .then(() => live && dispatchReplace({ type: 'room-freed' }))
      .catch(() => live && dispatchReplace({ type: 'room-refused' }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replace]);

  // The incoming photograph's progress, read off the same queue the ordinary
  // capture reports through. `tagAttempts` is the honest marker for "the image
  // is on the row": it can only have moved after the upload and the row update
  // both landed, so a tag that fails afterwards is a badged item rather than a
  // failed replacement.
  useEffect(() => {
    if (replace.phase !== 'processing') return;
    const job = jobs.find((j) => j.itemId === replace.incomingId);
    if (!job) return;
    if (job.stage === 'tagging' || job.stage === 'done' || job.tagAttempts > 0) {
      dispatchReplace({ type: 'processing-committed' });
    } else if (job.stage === 'failed') {
      dispatchReplace({ type: 'processing-failed' });
    }
  }, [jobs, replace]);

  // The incoming photograph is written, so the swap lands here — and, on the
  // room-to-spare path, the outgoing piece goes to storage first. AFTER the
  // write, never before: until this moment a failure had to be able to leave a
  // closet nobody had touched.
  useEffect(() => {
    if (replace.phase !== 'retiring') return;
    const { outgoingId, slotId, freed } = replace;
    let live = true;
    void (async () => {
      // The no-room path stored it on the way in; there is nothing owed.
      let stored = true;
      if (!freed) {
        try {
          await archive.mutateAsync({ ids: [outgoingId] });
        } catch {
          stored = false;
        }
      }
      if (!live) return;
      // The reducer decides the ending and `applyReplace` applies it, so the
      // screen never invents a slot state of its own.
      const event = { type: stored ? ('retired' as const) : ('retire-failed' as const) };
      const ending = replaceReducer(replace, event);
      setSlots((prev) => (prev ? applyReplace(prev, ending) : prev));
      orphanRef.current = null;
      AccessibilityInfo.announceForAccessibility(replacedAnnouncement(slotId));
      // Only a swap that actually stored the outgoing piece is a swap. A
      // `retire-failed` ending leaves the new photograph filed and the old one
      // still in the closet, which is a state the band must not celebrate.
      if (stored) setSwappedSlot(slotId);
      dispatchReplace(event);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replace]);

  // No-room path, unwinding. The orphan goes first because it is holding the
  // active slot the restore needs; the outgoing piece is never deleted, only
  // brought back out of storage.
  useEffect(() => {
    if (replace.phase !== 'restoring') return;
    const { outgoingId } = replace;
    let live = true;
    void (async () => {
      await sweepOrphan(orphanRef, discard);
      try {
        await restore.mutateAsync({ ids: [outgoingId] });
        if (live) dispatchReplace({ type: 'restored' });
      } catch {
        if (live) dispatchReplace({ type: 'restore-failed' });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replace]);

  // Every ending, once the writes are done: close the flow, or sweep up and
  // say what did not happen. No path here touches the grid — the one that
  // moves a slot is the one above, where the ending was decided.
  useEffect(() => {
    const state = replace;

    // The grid was already moved where the ending was decided; all that is
    // left is to close the flow.
    if (state.phase === 'replaced') {
      dispatchReplace({ type: 'acknowledge' });
      return;
    }

    if (state.phase !== 'failed') return;

    // Nothing was replaced, so nothing on the grid changes — the only work
    // left is sweeping the half-written row and saying so.
    void sweepOrphan(orphanRef, discard);

    // The total ceiling is DRAWN, not alerted: it names an upgrade, and an
    // alert has nowhere to put a door. The spoken sentence is the paragraph
    // this used to raise, unchanged, because a reader who cannot see the plate
    // still has to hear both remedies.
    if (state.failure === 'no-room' && capacity.storageFull) {
      AccessibilityInfo.announceForAccessibility(noRoomCopy(state.slotId).announcement);
      setNoRoomSlot(state.slotId);
      dispatchReplace({ type: 'acknowledge' });
      return;
    }

    const line = replaceFailureLine(state.failure, state.slotId, capacity.storageFull);
    if (line) {
      AccessibilityInfo.announceForAccessibility(line);
      Alert.alert('Nothing changed', line, [
        { text: 'OK', onPress: () => dispatchReplace({ type: 'acknowledge' }) },
      ]);
    } else {
      dispatchReplace({ type: 'acknowledge' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replace]);

  /**
   * The two photographic doors out of the sheet.
   *
   * The camera permission is checked HERE, before the machine chooses a path:
   * a door already known to be locked must not first send the outgoing piece
   * to storage and then have to fetch it back. `capacity.full` is the whole of
   * the no-room decision — see `ten-replace.ts`.
   *
   * A FULL ACCOUNT IS CHECKED HERE FOR THE SAME REASON. `capacity.storageFull`
   * is the total ceiling — active plus stored — and at that ceiling archiving
   * the outgoing piece works and the incoming insert is refused regardless, so
   * the flow would ask for a photograph it could never keep. Stopping before
   * the camera opens costs the reader nothing and is the only honest order.
   * This is the client's own count, not a control: the trigger remains the
   * authority, and being wrong here only means the ordinary path runs and the
   * server refuses with its own message.
   */
  const chooseReplacement = useCallback(
    (mode: 'camera' | 'library') => {
      if (mode === 'camera' && camera.access === 'blocked') {
        dispatchReplace({ type: 'permission-denied', source: 'camera' });
        return;
      }
      if (capacity.storageFull) {
        dispatchReplace({ type: 'room-refused' });
        return;
      }
      dispatchReplace({ type: 'choose', mode, needsRoom: capacity.full });
    },
    [camera.access, capacity.full, capacity.storageFull],
  );

  const byId = useMemo(() => {
    const m = new Map<string, Garment>();
    for (const g of wardrobe.data ?? []) m.set(g.id, g);
    return m;
  }, [wardrobe.data]);

  const { resolve } = useSignedUrls(
    (wardrobe.data ?? []).flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
  );

  /**
   * READINESS, and the two guards on it.
   *
   * `starterReadiness` reads the REAL wardrobe — the classifier's answer, never
   * the position a photograph was taken from. A hoodie shot into the third cell
   * is a `mid_layer`, `outfit-count.ts` counts it as a top, and this screen has
   * no opinion of its own to disagree with.
   */
  const readiness = useMemo(() => starterReadiness(wardrobe.data ?? []), [wardrobe.data]);

  /**
   * Nothing is declared ready while a photograph is still being read.
   *
   * A slot fills the moment the item ROW is written (see `TenCamera`) — well
   * before the tagging pass returns — which is deliberate: processing must
   * never block the next photograph. The cost is that the tenth piece can be
   * filed and untagged at the same instant, and a readiness verdict taken then
   * is a verdict about a garment Cinch has not read yet. It would flip a moment
   * later, which is worse than waiting.
   */
  const activeJobs = useQueueStore((s) => selectActiveCount(s.jobs));
  const settling = activeJobs > 0;

  const showStop =
    !stopDismissed && slots !== null && isComplete(slots) && !settling && readiness.ready;

  // ACTIVATION, observed from the guided route.
  //
  // The condition is `canGenerate` over the REAL wardrobe, not `isComplete`
  // over the slots. Those are different claims: the ten being settled includes
  // slots the reader declined, so a run that kept three open finishes the flow
  // without necessarily finishing a closet — and the honest activation moment
  // is the one the rest of the app agrees with, which is the same predicate
  // Today uses to decide whether it has outfits to show. `trackOnce` makes
  // this and Today's observer idempotent with each other: whichever sees the
  // crossing first emits, the other is a no-op, forever.
  useEffect(() => {
    const items = wardrobe.data;
    if (!items || !canGenerate(items)) return;
    trackOnce('closet_ready', { route: 'the_ten', pieces: items.length });
  }, [wardrobe.data]);

  // A closet that cannot be read is not an empty closet — the same distinction
  // Today draws at T-08, and it matters more here than it does there. Before
  // this screen became the first run, a failed wardrobe query left it holding
  // "Loading your closet…" forever, which for a brand-new account on a bad
  // connection is the first minute of the app and has no way out of it.
  if (!slots && wardrobe.isError) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View style={{ paddingHorizontal: PAD, paddingTop: 4 }} accessibilityRole="alert">
          {/* The title stays, and the band does not. A tray that could not be
              read has no count to report, and drawing `NONE OF TEN` over a
              failed read would be asserting an empty closet — which is the one
              thing this state exists to avoid claiming. */}
          <TenMasthead title={TEN_TITLE} subtitle={null} measure={chromeMeasure} />
          <View style={{ marginTop: 16 }}>
            <TroublePlate
              measure={chromeMeasure}
              eyebrow="Couldn’t open your tray"
              body="Something went wrong reading what you’ve filed. Your pieces are safe — this is only the read."
              primary={{ label: 'Try again', onPress: () => void wardrobe.refetch() }}
              secondary={{ label: 'Back to Today', onPress: () => router.replace('/(tabs)' as Href) }}
            />
          </View>
          {/* One row of ghost wells under it. The frame draws them and they earn
              their place: they say what the plate is standing in front of. */}
          <GhostRow />
        </View>
      </SafeAreaView>
    );
  }

  if (!slots) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View
          style={{ paddingHorizontal: PAD, paddingTop: 4 }}
          accessibilityRole="progressbar"
          accessibilityLabel="Opening your tray">
          {/* The title is REAL and everything under it is a shape. A skeleton
              that also greys the masthead has nothing on it a reader can hold
              on to; the frame keeps the one word that is already known. */}
          <TenMasthead title={TEN_TITLE} subtitle={null} measure={chromeMeasure} />
          <Bone height={14} width={150} radius={7} top={10} />
          <Bone height={54} radius={18} top={16} />
          <GhostRow />
          <GhostRow />
          <GhostRow />
        </View>
      </SafeAreaView>
    );
  }

  const foregrounded = slots.find((s) => s.id === foregroundedOverride) ?? nextSlot(slots);
  const cameraSlot = slots.find((s) => s.id === cameraSlotId) ?? null;

  const garmentNames: Record<number, string | null> = {};
  const imageUris: Record<number, string | undefined> = {};
  for (const s of slots) {
    if (s.status !== 'filled' || !s.garmentId) continue;
    const g = byId.get(s.garmentId);
    if (!g) continue;
    garmentNames[s.id] = g.subcategory
      ? g.subcategory.charAt(0).toUpperCase() + g.subcategory.slice(1)
      : null;
    imageUris[s.id] = resolve(g.platePath, g.cutoutPath, g.thumbPath);
  }

  // A slot fills the moment the item ROW is written — before the cutout is
  // uploaded, before the wardrobe refetches, before `resolve` has any path to
  // sign. Between those two moments the tile was `wellFilled` with nothing on
  // it: a dark block where the photograph just taken should be. The queue job
  // that filled the slot still holds that photograph's local URI, so it stands
  // in until the processed image arrives and takes precedence above.
  for (const s of slots) {
    if (s.status !== 'filled' || !s.garmentId || imageUris[s.id] !== undefined) continue;
    const job = jobs.find((j) => j.itemId === s.garmentId);
    if (job?.localUri) imageUris[s.id] = job.localUri;
  }

  // LP-02 — the outgoing photograph stays on its tile for the whole flow. On
  // the no-room path its row is in storage and has left `useWardrobe`, so the
  // loop above found nothing for that position; without this the grid would
  // show a blank cell and a count of nine while the reader was mid-replacement,
  // which is the exact thing the contract forbids.
  // Gated on the flow being live rather than cleared by an effect: `closed` is
  // the only state in which the wardrobe is the whole truth again, and a render
  // that reads it is one fewer set of cascading renders than a reset would be.
  if (replace.phase !== 'closed' && heldPiece && imageUris[heldPiece.slotId] === undefined) {
    imageUris[heldPiece.slotId] = heldPiece.uri;
    garmentNames[heldPiece.slotId] = heldPiece.name;
  }

  const filled = filledCount(slots);
  // Ten filed and the arithmetic has not arrived. Never the stop sheet: see
  // `TenRepair`. The grid stays live under it, so the reader is never stranded
  // in front of a full grid with nowhere to go.
  const needsRepair = isComplete(slots) && !settling && !readiness.ready;
  const newestPlacedId = placedIds(slots).at(-1) ?? null;

  // ── Redesign 21 · what the page is DOING ─────────────────────────────────
  //
  // The band and the foot both need this and neither may derive it for itself:
  // `settling` is read off the ingest queue, `readiness` off the classifier and
  // `swappedSlot` off the replacement machine, and a component that had to
  // reach all three would be a second copy of this screen's state.
  //
  // THE ORDER IS THE PRIORITY, and settling wins. A tray that is ten-tenths
  // full with a photograph still being read is not ready — a verdict taken then
  // is a verdict about a garment Cinch has not looked at, and it would flip a
  // moment later, which is worse than waiting. Same rule, and the same sentence,
  // as `showStop` above.
  const settlingSlot =
    settling && newestPlacedId
      ? (slots.find((s) => s.garmentId === newestPlacedId)?.id ?? null)
      : null;
  const phase: TenPhase = settling
    ? 'settling'
    : swappedSlot !== null
      ? 'swapped'
      : isComplete(slots)
        ? readiness.ready
          ? 'ready'
          : 'unready'
        : 'filling';

  // `cameraStart === 'library'` falls THROUGH to `TenCamera`, which opens the
  // picker on mount and never touches a viewfinder. Without that the notice
  // below would re-render itself and "Use the photo library" would be a button
  // that did nothing — the one thing this state must not be.
  if (cameraSlot && !CAMERA_AVAILABLE && cameraStart !== 'library') {
    // CP-04 inside The Ten. The guided walk keeps running: the library door is
    // the one the atlas already offers on every slot card, so this hands the
    // slot back rather than ending the session — nothing filed is affected and
    // the other nine slots are unchanged.
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="mt-10">
          <CameraUnavailable
            onLibrary={() => setCameraStart('library')}
            onDescribe={() => router.replace('/add-clothes?door=describe' as Href)}
            onHelp={() => router.replace('/help' as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }

  // LP-02's capture is the SAME component the guided one uses — same shutter,
  // same picker, same queue, same upload, same cutout, same tagger. Only the
  // two callbacks differ, because a replacement reports into the machine
  // instead of filling an empty position.
  const replacingSlot =
    replace.phase === 'capturing' ? (slots.find((s) => s.id === replace.slotId) ?? null) : null;

  if (replace.phase === 'capturing' && replacingSlot) {
    return (
      <TenCamera
        slot={replacingSlot}
        slots={slots}
        start={replace.mode}
        onCancel={() => dispatchReplace({ type: 'cancel' })}
        onFilled={(itemId) => {
          // Remembered before the machine moves: if the flow stops after this
          // point, this row is the thing to sweep up.
          orphanRef.current = itemId;
          dispatchReplace({ type: 'item-created', itemId });
        }}
      />
    );
  }

  if (cameraSlot) {
    return (
      <TenCamera
        slot={cameraSlot}
        slots={slots}
        start={cameraStart}
        onCancel={() => setCameraSlotId(null)}
        onFilled={(itemId) => {
          setSlots((prev) => (prev ? fillSlot(prev, cameraSlot.id, itemId) : prev));
          setCameraSlotId(null);
          setForegroundedOverride(null);
        }}
      />
    );
  }

  // ── TR-05 · the two doors ────────────────────────────────────────────────
  //
  // Only ever on a run that has not started. A closet with a piece in it has
  // already answered this question, and re-asking it would put a chooser in
  // front of somebody mid-flow.
  if (!doorChosen && filled === 0) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        {/* CX-01. This screen is reached from Today's "Start your closet" and
            had no way back out of it — the only exits were the four doors and
            the iOS edge swipe, which is not a control and is not discoverable.
            `router.back()` is right rather than a hard `/(tabs)` replace: every
            production entrance pushes, so back lands where the reader came
            from, and the shared header is the same disc eight other screens
            draw rather than a ninth hand-rolled copy. */}
        <ScreenHeader align="leading" title="Today" backLabel="Today" />
        <FirstTenDoors
          // TR-06 when there is a walkthrough waiting, TR-05 when there is not.
          // Null while either read is in flight, so the doors are what a
          // brand-new account sees — and it never sees a card swap in under it,
          // because a brand-new account has no session to find.
          unfinished={unfinished}
          // TN-C1's four routes, all reaching the destinations The Ten and Add
          // clothes already had. Camera opens the guided grid; the other three
          // hand off to the surfaces that own them, so nothing here is a second
          // copy of a picker, a catalogue search or a recorder.
          onRoute={(key) => {
            if (key === 'camera') {
              setDoorChosen(true);
              return;
            }
            if (key === 'voice') {
              router.push('/walkthrough');
              return;
            }
            // Library and catalogue both file into the same queue the camera
            // feeds, through the chooser's own consent gate — which is why they
            // go via `/add-clothes?door=`, the deep link this packet made live,
            // rather than pushing `/capture` and skipping it.
            router.push(
              (key === 'library'
                ? '/add-clothes?door=library&from=ten'
                : '/add-clothes?door=describe&from=ten') as Href,
            );
          }}
          onResume={() =>
            unfinished && router.replace(`/walkthrough/review?session=${unfinished.sessionId}`)
          }
          // Nothing on this screen implies the recording is discarded, and this
          // action does not discard it: the old session stays resumable in the
          // database and a fresh invitation opens on top of it.
          onStartAgain={() => router.push('/walkthrough')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <TenBody
        slots={slots}
        phase={phase}
        foregroundedId={foregrounded?.id ?? null}
        settlingId={settlingSlot}
        settlingName={settlingSlot === null ? null : (garmentNames[settlingSlot] ?? null)}
        garmentNames={garmentNames}
        imageUris={imageUris}
        // A filled tile opens a focused review of the piece in it — LP-02.
        //
        // It used to push straight to `/item/{id}`, which answered only half
        // of why anyone taps their own photograph: a garment read wrong is
        // worth correcting at slot two, and so is a photograph taken badly,
        // and only the first of those had a door. The push is not lost — it is
        // `Edit details`, third in the sheet, and it still mutates nothing.
        //
        // Ignored outright while a replacement is already in flight: the tile
        // is busy, and a second flow over the top of it would be two writes
        // racing for one position.
        onSlotPress={(id) => {
          // Any next action supersedes the swap report — see `swappedSlot`.
          setSwappedSlot(null);
          const slot = slots.find((s) => s.id === id);
          if (slot?.status === 'filled' && slot.garmentId) {
            if (replace.phase !== 'closed') return;
            setHeldPiece({ slotId: id, uri: imageUris[id], name: garmentNames[id] ?? null });
            dispatchReplace({ type: 'open', slotId: id, garmentId: slot.garmentId });
            return;
          }
          setForegroundedOverride(id);
        }}
        onPhotograph={(id) => openCamera(id, 'camera')}
        onLibrary={(id) => openCamera(id, 'library')}
        // The complete tray's capsule. The SAME destination the stop sheet's
        // first action has, deliberately: a reader who waved the sheet away
        // still has the one exit this flow was counting down to, and there is
        // exactly one route to the reveal rather than two that could drift.
        onFinish={() => {
          setStopDismissed(true);
          router.replace('/reveal');
        }}
        // And its quiet one. `/add-clothes` owns the capacity question — there
        // is no eleventh well here to fill, so this is a door out rather than a
        // second picker.
        onAddAnother={() => router.push('/add-clothes?from=ten' as Href)}
        plates={
          <>
            {needsRepair ? (
              <TenRepair
                readiness={readiness}
                measure={chromeMeasure}
                onCheckPiece={() =>
                  newestPlacedId ? router.push(`/item/${newestPlacedId}` as Href) : undefined
                }
              />
            ) : null}
            {/* The refusal stands under the tray until the reader acts on it —
                both doors clear it, because both of them answer it. */}
            {noRoomSlot !== null ? (
              <TenNoRoomNotice
                slotId={noRoomSlot}
                measure={chromeMeasure}
                onOpenStorage={() => {
                  setNoRoomSlot(null);
                  router.push('/storage' as Href);
                }}
                onSeePlans={() => {
                  setNoRoomSlot(null);
                  void gate.present(Placement.AddGarmentOverLimit);
                }}
              />
            ) : null}
          </>
        }>
        {cameraRefused ? (
          // ── T-05 ──────────────────────────────────────────────────────────
          // Under the masthead, not instead of it: the work already done stays
          // visible from the failure screen.
          <View style={{ marginTop: 24 }}>
            <CameraDenied
              filled={filled}
              onLibrary={() => foregrounded && openCamera(foregrounded.id, 'library')}
              onSettings={camera.openSettings}
              onVoice={() => router.push('/walkthrough')}
            />
          </View>
        ) : undefined}
      </TenBody>

      {replace.phase === 'choosing' ? (
        <TenReplaceSheet
          visible
          slotId={replace.slotId}
          garmentName={garmentNames[replace.slotId] ?? null}
          imageUri={imageUris[replace.slotId]}
          onRetake={() => chooseReplacement('camera')}
          onLibrary={() => chooseReplacement('library')}
          // The path this screen has always had, kept whole: it pushes the
          // piece and touches neither the slot nor the count.
          onEditDetails={() => {
            const garmentId = replace.outgoingId;
            dispatchReplace({ type: 'cancel' });
            router.push(`/item/${garmentId}` as Href);
          }}
          // The look-alike offer, only while the just-settled job for THIS
          // piece says it may be made (`match-eligibility.ts` — tag settled
          // with a category, an image on the server, consent current). The
          // route is capture's own M-03 routing, `?match=1`, so the sheet that
          // opens is the same one item detail's row opens — one flow, three
          // doors. The `door` property is what tells this door apart in the
          // one `garment_search_used` funnel.
          onFindPhoto={
            matchOfferJob(jobs, replace.outgoingId)
              ? () => {
                  const garmentId = replace.outgoingId;
                  dispatchReplace({ type: 'cancel' });
                  track('garment_search_used', { stage: 'listing_offer_opened', door: 'ten' });
                  router.push(`/item/${garmentId}?match=1` as Href);
                }
              : undefined
          }
          onCancel={() => dispatchReplace({ type: 'cancel' })}
        />
      ) : null}

      <TenStopSheet
        visible={showStop}
        // The REAL count, from `countOutfits` over the classified wardrobe.
        // It used to be `plannedTally` — arithmetic over a template's plan,
        // which could quote fourteen outfits to a closet that made none.
        count={readiness.outfits}
        onSeeOutfits={() => {
          setStopDismissed(true);
          router.replace('/reveal');
        }}
        // "Back to the grid" — the sheet closes and nothing else happens. It
        // used to route to The Wall's swap flow, which promised a replacement
        // this sheet never offered; the atlas's own second action is smaller
        // and truer, and the grid behind it is still fully live.
        onBackToGrid={() => setStopDismissed(true)}
      />
    </SafeAreaView>
  );
}

/**
 * A skeleton bar. The loading frame's own vocabulary and nothing else's.
 *
 * Static rather than shimmering: a pulse is motion, motion on a loading state is
 * the one place `useReducedMotion` gets forgotten, and the frame draws stillness.
 */
function Bone({
  height,
  width,
  radius,
  top,
}: {
  height: number;
  width?: number;
  radius: number;
  top: number;
}) {
  return (
    <View
      style={{
        height,
        width: width ?? '100%',
        borderRadius: radius,
        marginTop: top,
        backgroundColor: TEN.wellEmpty,
      }}
    />
  );
}

/**
 * One row of empty wells, drawn as furniture rather than as slots.
 *
 * Used by the loading and error frames, where there are no `TenSlot`s to hand
 * `TenTray` yet. Deliberately NOT pressable and carrying no label: it is a
 * picture of the tray, and a reader who tabbed onto it would find three
 * controls that cannot do anything. `accessibilityElementsHidden` says so.
 */
function GhostRow() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
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
  );
}

/**
 * Discard the half-written row a stopped replacement left behind.
 *
 * NOT the prior asset, and the distinction is the whole of LP-02's cleanup
 * rule: this deletes a row created seconds ago that never received a
 * photograph, while the piece being replaced is only ever archived — never
 * touched by `useRemoveItems`, never touched at all on a path that failed.
 *
 * Best-effort by design. The orphan is invisible in the closet until the
 * wardrobe refetches and costs the reader nothing that a later pass cannot
 * fix, whereas a failure to sweep it must not turn into a second error
 * message on top of the one they are already reading.
 */
async function sweepOrphan(
  ref: { current: string | null },
  discard: { mutateAsync: (vars: { ids: string[] }) => Promise<unknown> },
): Promise<void> {
  const id = ref.current;
  if (!id) return;
  ref.current = null;
  try {
    await discard.mutateAsync({ ids: [id] });
  } catch {
    // Left for a later pass rather than reported: see above.
  }
}
