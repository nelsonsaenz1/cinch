import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CameraDenied } from '@/components/onboarding/camera-denied';
import { FirstTenDoors } from '@/components/onboarding/first-ten-doors';
import { SubstitutionSheet } from '@/components/onboarding/substitution-sheet';
import { TenBody } from '@/components/onboarding/ten-body';
import { TenCamera } from '@/components/onboarding/ten-camera';
import { TenStopSheet } from '@/components/onboarding/ten-stop-sheet';
import { Text } from '@/components/ui/text';
import { countOutfits } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useUnfinishedWalkthrough } from '@/features/intake/queries';
import {
  declineSlot,
  fillSlot,
  hydrateFromWardrobe,
  isComplete,
  nextSlot,
  plannedTally,
  settledCount,
  type CountedKind,
  type TenSlot,
} from '@/features/onboarding/ten-slots';
import { canGenerate, useWardrobe } from '@/features/styling/queries';
import { trackOnce } from '@/lib/posthog';
import type { Garment } from '@/lib/styling';

/**
 * The Ten — Directive 1's guided capture, states T-01…T-06.
 *
 * A single screen with three layers of state on top of the wardrobe query:
 * which ten positions are filled (`slots`), which one the user is looking at
 * (`foregroundedId`, defaulting to `nextSlot` but overridable by a direct
 * tap — "order is a suggestion"), and whichever modal is open on top of it
 * (the camera, the substitution sheet, or the stop sheet once the ten is
 * complete). See docs/design/free-tier-contract.md and
 * design-refs/html/The Ten State Atlas for the states this renders.
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
 *    What it cannot restore is a DECLINE: a slot kept open, or redirected to a
 *    fourth top, is a decision that lives only in this component's state, and
 *    a returning reader is asked about that slot again. Nothing is lost by it
 *    — the same decline is one tap away — but it is the one part of "returning
 *    resumes at the count" that is not yet true, and it cannot be made true
 *    without persisting the slot list somewhere.
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
  const [declineSlotId, setDeclineSlotId] = useState<number | null>(null);
  const stopShown = useRef(false);
  const [showStop, setShowStop] = useState(false);
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

  useEffect(() => {
    if (slots && isComplete(slots) && !stopShown.current) {
      stopShown.current = true;
      setShowStop(true);
    }
  }, [slots]);

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
  const declining = slots.find((s) => s.id === declineSlotId) ?? null;

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

  const filled = settledCount(slots);

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
        <FirstTenDoors
          // TR-06 when there is a walkthrough waiting, TR-05 when there is not.
          // Null while either read is in flight, so the doors are what a
          // brand-new account sees — and it never sees a card swap in under it,
          // because a brand-new account has no session to find.
          unfinished={unfinished}
          onPhotograph={() => setDoorChosen(true)}
          onVoice={() => router.push('/walkthrough')}
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
        foregroundedId={foregrounded?.id ?? null}
        garmentNames={garmentNames}
        imageUris={imageUris}
        onSlotPress={(id) => setForegroundedOverride(id)}
        onPhotograph={(id) => openCamera(id, 'camera')}
        onLibrary={(id) => openCamera(id, 'library')}
        onSkip={(id) => setDeclineSlotId(id)}>
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

      <SubstitutionSheet
        visible={declining !== null}
        slot={declining}
        slots={slots}
        onDismiss={() => setDeclineSlotId(null)}
        onKeepOpen={() => {
          if (!declining) return;
          setSlots((prev) => (prev ? declineSlot(prev, declining.id, { open: true }) : prev));
          setDeclineSlotId(null);
          setForegroundedOverride(null);
        }}
        onRedirect={(to: CountedKind) => {
          if (!declining) return;
          setSlots((prev) => (prev ? declineSlot(prev, declining.id, { to }) : prev));
          setDeclineSlotId(null);
          setForegroundedOverride(null);
        }}
      />

      <TenStopSheet
        visible={showStop}
        count={countOutfits(plannedTally(slots))}
        onSeeOutfits={() => {
          setShowStop(false);
          // The dress redirect, if the user took one — the one fact about
          // *why* the tally changed shape that only this screen's slot state
          // knows. The Reveal cannot recover it from the finished wardrobe
          // alone, so it rides along as a param rather than being re-guessed.
          const dressSlot = slots.find((s) => s.originalKind === 'dresses');
          const redirectedDressTo =
            dressSlot && dressSlot.kind !== 'dresses' ? dressSlot.kind : '';
          router.replace({ pathname: '/reveal', params: { redirectedDressTo } });
        }}
        // "Back to the grid" — the sheet closes and nothing else happens. It
        // used to route to The Wall's swap flow, which promised a replacement
        // this sheet never offered; the atlas's own second action is smaller
        // and truer, and the grid behind it is still fully live.
        onBackToGrid={() => setShowStop(false)}
      />
    </SafeAreaView>
  );
}
