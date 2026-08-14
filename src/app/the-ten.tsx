import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CameraUnavailable } from '@/components/ingest/camera-unavailable';
import { CameraDenied } from '@/components/onboarding/camera-denied';
import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { TenBody } from '@/components/onboarding/ten-body';
import { TenCamera } from '@/components/onboarding/ten-camera';
import { TenRepair } from '@/components/onboarding/ten-repair';
import { TenStopSheet } from '@/components/onboarding/ten-stop-sheet';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { CAMERA_AVAILABLE } from '@/features/ingest/camera-availability';
import { selectActiveCount, useQueueStore } from '@/features/ingest/queue-store';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useUnfinishedWalkthrough } from '@/features/intake/queries';
import { starterReadiness } from '@/features/onboarding/starter-readiness';
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
import { trackOnce } from '@/lib/posthog';
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
  /** TR-05 is answered by walking through a door, and only asked once. */
  const [doorChosen, setDoorChosen] = useState(door === 'photograph');

  const openCamera = useCallback(
    (slotId: number, mode: 'camera' | 'library') => {
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
      <SafeAreaView className="flex-1 justify-center bg-canvas px-gutter">
        <View accessibilityRole="alert">
          <Text variant="title" trim>
            Couldn&rsquo;t read your closet
          </Text>
          <Text variant="body" className="mt-3.5 text-muted">
            Nothing you&rsquo;ve photographed is lost. Check your connection and try again.
          </Text>
          {/* Wrapper carries the offset: `Button` omits `style` from its props. */}
          <View style={{ marginTop: 30 }}>
            <Button
              title="Try again"
              variant="secondary"
              loading={wardrobe.isRefetching}
              onPress={() => void wardrobe.refetch()}
              className="self-stretch"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!slots) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Loading your closet…</Text>
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

  const filled = filledCount(slots);
  // Ten filed and the arithmetic has not arrived. Never the stop sheet: see
  // `TenRepair`. The grid stays live under it, so the reader is never stranded
  // in front of a full grid with nowhere to go.
  const needsRepair = isComplete(slots) && !settling && !readiness.ready;
  const newestPlacedId = placedIds(slots).at(-1) ?? null;

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
        readiness={readiness}
        foregroundedId={foregrounded?.id ?? null}
        garmentNames={garmentNames}
        imageUris={imageUris}
        // A filled tile now opens its piece rather than doing nothing: that is
        // the repair path, and it has to be live from the first filled cell
        // rather than only once the grid is full — a garment read wrong at
        // slot two is worth correcting at slot two.
        onSlotPress={(id) => {
          const slot = slots.find((s) => s.id === id);
          if (slot?.status === 'filled' && slot.garmentId) {
            router.push(`/item/${slot.garmentId}` as Href);
            return;
          }
          setForegroundedOverride(id);
        }}
        onPhotograph={(id) => openCamera(id, 'camera')}
        onLibrary={(id) => openCamera(id, 'library')}
        footer={
          needsRepair ? (
            <TenRepair
              readiness={readiness}
              onCheckPiece={() =>
                newestPlacedId ? router.push(`/item/${newestPlacedId}` as Href) : undefined
              }
            />
          ) : undefined
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
