import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { DoorArt } from '@/components/ingest/door-art';
import { Button, DoorCondition, DoorConditionAction, DoorPlate, Text } from '@/components/ui';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import {
  DECLINED_KEY,
  EXPLAINER_SEEN_KEY,
  readFlag,
  writeFlag,
} from '@/features/ingest/consent-mode';
import { useCapacity } from '@/features/billing/use-capacity';
import {
  AC,
  CAMERA_BLOCKED_ACTION,
  CAMERA_BLOCKED_LINE,
  CAMERA_MODULE_ACTION,
  CAMERA_MODULE_LINE,
  LOCAL_MODE_ACTION,
  LOCAL_MODE_LINE,
  PEER_LINE,
  SHELF_FULL_ACTION,
  SHELF_FULL_BODY,
  SHELF_FULL_TITLE,
  capacityColophon,
} from '@/features/ingest/add-clothes-spec';
import { CAMERA_AVAILABLE } from '@/features/ingest/camera-availability';
import {
  CATALOGUE_DISCLOSURE,
  INTAKE_ROUTES,
  type IntakeRouteKey,
} from '@/features/ingest/intake-routes';
import { useCameraStatus } from '@/features/ingest/use-camera-access';
import { leading, tracking } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

import { DeclineExplainer } from './capture';

/**
 * The four routes, by key, so the JSX can name one without indexing an array.
 * The ARRAY is the contract (order, membership); this is only a lookup on it,
 * built from it, so the two can never disagree.
 */
const ROUTE = Object.fromEntries(INTAKE_ROUTES.map((r) => [r.key, r])) as Record<
  IntakeRouteKey,
  (typeof INTAKE_ROUTES)[number]
>;

/**
 * AC-01 — Add Clothes, the entry chooser. Redesign 23.
 *
 * The door before the doors. Eight places in the app used to route straight
 * into a live viewfinder, which made the camera the only way into a closet and
 * quietly told anyone without the garment in front of them to come back later.
 * Four ways in, drawn as peers.
 *
 * ── WHAT REDESIGN 23 CHANGED, AND WHAT IT DID NOT ─────────────────────────
 *
 * DRAWING. The doors are tinted plates carrying drawn imagery rather than
 * white cards carrying SF Symbols; the disclosure sits in a tray of its own;
 * the capacity sentence becomes a tracked colophon; The Ten becomes an oxblood
 * lead door above the group. All of that is `DoorPlate`, `DoorArt` and
 * `add-clothes-spec.ts`, and none of it is a decision this file makes.
 *
 * ROUTING AND GATES. Byte for byte what shipped. Every door lands where it
 * landed, the consent sheet fires on the same two doors, `?door=` resolves the
 * same way and latches the same way, capacity gates nothing, and Cancel still
 * writes nothing. The frame's own handoff says the same: "presentation-only
 * over the existing intake table, consent, catalogue and capacity contracts."
 *
 * ── THE EQUAL-DOORS RULE, AND THE ONE ACCENT ──────────────────────────────
 *
 * NO PEER DOOR IS ACCENTED. The accent means "the one thing to do on this
 * screen", and this screen's whole question is which of four things you want
 * to do. Neither capture nor voice reads as the fallback; that is T-00's
 * equal-doors rule, generalised (§3.2).
 *
 * The accent is spent twice, and neither is a peer: on THE TEN, which is not
 * an intake method but a guided run that uses these four; and on the recovery
 * link inside a door's condition, which is a way out of a state rather than a
 * way in. The frame draws Cancel in oxblood too; it ships as the app's ghost
 * Button, whose labels are `muted` by contract (`components/ui/button-spec.ts`
 * — one variant, one tone), because forking that contract for one screen's
 * dismiss control is a bigger change than the frame is asking for.
 *
 * ── THE STATES ────────────────────────────────────────────────────────────
 *
 * - Default — four peers, one height, no favourite, and The Ten above them
 *   while the closet is under its cap.
 * - Camera denied at the system level — the door keeps its position, its
 *   height and its name, states the cause on its own condition line and names
 *   the three doors that still work, and offers Settings under it as a text
 *   action rather than as an alert.
 * - No camera module in this build — the same shape, a different cause and a
 *   different remedy. Updating, never Settings.
 * - Processing consent declined — the library door says so, and offers the
 *   way back. Declining is a working mode, not a dead end.
 * - Capacity reached — ALL FOUR DOORS STAY AVAILABLE. See the long note at the
 *   notice itself.
 *
 * ── CONSENT (AC-04), AND WHY ONLY TWO DOORS CARRY IT ──────────────────────
 *
 * The sheet fires here, over the chooser, on the first tap of a door whose tap
 * directly produces something to process — Photo Library and Describe it. The
 * user sees every way in before being asked to agree to anything, which is the
 * whole of AC-04.
 *
 * The CAMERA door is deliberately not gated here. Arriving at a viewfinder
 * processes nothing: the photograph does not exist yet, and capture already
 * asks at the shutter, at the moment there is something to send. Gating the
 * camera on this screen would move the ask EARLIER than the app has ever asked
 * it, to a point where the thing being consented to has not been created.
 * DESCRIBE BY VOICE is not gated either — voice carries its own consent line,
 * stated above the record button in the Walkthrough, about a recording rather
 * than a photograph. The artifact draws that sentence on a handoff sheet over
 * this chooser; it stays where it ships, unshortened and unparaphrased, so
 * there is exactly one place in the app that sentence lives.
 *
 * Whatever is answered here is persisted under the same two keys capture reads
 * (`features/ingest/consent-mode.ts`), so the destination does not ask again.
 */
export default function AddClothesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Read, never requested. A chooser that raises the system permission alert on
  // arrival is asking for the camera before anyone has said they want it.
  const { access, openSettings } = useCameraStatus();
  // Read only. The chooser never gates on this — W-02 decides capacity once a
  // photograph exists — it only states the condition before the effort.
  const capacity = useCapacity();

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [declinedLocally, setDeclinedLocally] = useState(() => readFlag(DECLINED_KEY));
  const [explainerSeen, setExplainerSeen] = useState(() => readFlag(EXPLAINER_SEEN_KEY));
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  /**
   * Whether this visit has sent the reader out to Settings.
   *
   * The frame draws a "Camera access is on" line on the door after a return
   * with the permission granted, and draws NOTHING on a door that was simply
   * never blocked — which is the same distinction `useCameraStatus` already
   * makes between `granted` and `blocked` plus the one fact it cannot know:
   * whether the reader has been anywhere. Without this flag the granted line
   * would greet every reader whose camera has always worked, which is an
   * answer to a question they never asked.
   */
  const [wentToSettings, setWentToSettings] = useState(false);

  const granted = consent.data?.granted === true;
  const declined = !granted && (declinedLocally || consent.data?.revokedAt != null);
  /**
   * Unanswered — and `undefined` while the query is still in flight, which is
   * NOT unanswered. Treating a pending read as "never asked" would put the
   * sheet in front of somebody who answered it months ago, every time this
   * screen opened cold. It is also what holds the frame's
   * consent-query-loading-no-flash state: while the answer is unknown no sheet
   * appears and no door is pre-disabled.
   */
  const unresolved = consent.data !== undefined && !granted && !declined;

  /**
   * The door waiting behind the sheet.
   *
   * A ref, not state: it is read from `onDismissed`, a native Modal callback
   * outside React's update cycle, and it has to be readable and clearable in
   * one go so an interrupted door opens exactly once.
   */
  const pendingHref = useRef<Href | null>(null);

  /**
   * Navigation is deferred to the far side of the sheet's dismissal.
   *
   * The same edge `capture.tsx` documents at length: iOS refuses to present a
   * view controller while another modal is still animating away. Pushing the
   * destination in the same tick as hiding the sheet drops the push on the
   * floor, and the user is left on the chooser having consented to nothing
   * visible. `onDismissed` fires once the sheet has finished LEAVING.
   */
  const openPending = useCallback(() => {
    const href = pendingHref.current;
    pendingHref.current = null;
    if (href) router.push(href);
  }, [router]);

  /** A door that produces something to process the moment it is tapped. */
  const openContentDoor = useCallback(
    (href: Href) => {
      if (!unresolved) {
        router.push(href);
        return;
      }
      pendingHref.current = href;
      setConsentVisible(true);
    },
    [unresolved, router],
  );

  /**
   * `?door=` — THE DEEP LINK THAT WENT NOWHERE.
   *
   * Three surfaces pushed `/add-clothes?door=describe` or `?door=library`: The
   * Ten's camera-unavailable branch, the standalone `/camera-unavailable`
   * route, and capture's own. This screen never read the parameter, so every
   * one of them landed on the plain chooser — a "Describe it instead" button
   * that dropped the reader on a menu and left them to find the door
   * themselves. Which is worse than it sounds: those three call sites all exist
   * because the CAMERA just failed, so the reader has already been told once
   * that something did not work.
   *
   * Routed through `openContentDoor`, not `router.push`, so a door reached by
   * deep link raises the same consent sheet a tapped one does.
   *
   * One-shot: `handledDoor` latches, so dismissing the destination and coming
   * back leaves the reader on the chooser they can now see rather than bouncing
   * them straight back out of it.
   *
   * An unknown value opens nothing. A deep link is untrusted input, and the
   * chooser is the right answer to a door nobody recognises — silently, with no
   * error and nothing written.
   */
  const doorParams = useLocalSearchParams<{ door?: string; from?: string }>();
  const requestedDoor = doorParams.door;
  // Carried through rather than dropped: the catalogue route's return action
  // names the flow it came from, and this is the only thing that knows.
  const doorFrom = doorParams.from === 'ten' ? '&from=ten' : '';
  const handledDoor = useRef(false);

  useEffect(() => {
    if (handledDoor.current) return;
    if (requestedDoor !== 'describe' && requestedDoor !== 'library') return;
    handledDoor.current = true;
    // Off the mount tick, for the two reasons `capture.tsx`'s own auto-start
    // defers: `openContentDoor` may raise the consent sheet, and setting state
    // synchronously inside an effect cascades a render; and iOS refuses to
    // present a view controller while another modal is still animating, which
    // is exactly what is happening when this screen arrives from a deep link.
    const timer = setTimeout(() => {
      // `?door=describe` is the catalogue route by deep link, and it lands
      // where the tapped plate lands — ungated, on `/find-photo`. The library
      // door still goes through `openContentDoor`, because a photograph really
      // is about to be processed.
      if (requestedDoor === 'library') {
        openContentDoor(`/capture?start=library${doorFrom}` as Href);
      } else {
        router.push(`/find-photo${doorFrom ? `?from=ten` : ''}` as Href);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [requestedDoor, doorFrom, openContentDoor, router]);

  const onAccept = useCallback(async () => {
    await grantConsent.mutateAsync();
    setConsentVisible(false);
    // The door opens on `onDismissed`, not here.
  }, [grantConsent]);

  const onDecline = useCallback(() => {
    setConsentVisible(false);
    // Recorded synchronously, ahead of any query refetch, so the destination
    // reads local mode rather than asking a second time.
    setDeclinedLocally(true);
    writeFlag(DECLINED_KEY, true);
    if (explainerSeen) return;
    // First-ever decline gets the one full account of what changes (A-04).
    // Marked seen immediately: shown at the moment of decline and never again.
    setExplainerSeen(true);
    writeFlag(EXPLAINER_SEEN_KEY, true);
    setExplainerVisible(true);
    // A-04 replaces the chooser, so the waiting door is carried by its own
    // "Add the item myself" rather than opening behind the explainer.
    pendingHref.current = null;
  }, [explainerSeen]);

  if (explainerVisible) {
    return (
      <DeclineExplainer
        // The door the user was heading for, resumed in local mode. Library is
        // the honest default: they tapped a content door to begin with.
        onAddItem={() => {
          setExplainerVisible(false);
          router.push('/capture?start=library');
        }}
        onTurnOnAi={() => {
          setExplainerVisible(false);
          setConsentVisible(true);
        }}
      />
    );
  }

  /**
   * The drawings, hoisted out of the JSX.
   *
   * Not a style preference: `<DoorPlate art={<DoorArt … />} />` puts a
   * self-closing tag inside a plate's attribute list, and three tests slice a
   * plate's props by finding the next `/>` after its name. Naming the element
   * first keeps those slices reading the plate rather than its tile.
   */
  const catalogueArt = <DoorArt kind="catalogue" />;
  const cameraArt = <DoorArt kind="camera" />;
  const libraryArt = <DoorArt kind="library" />;
  const voiceArt = <DoorArt kind="voice" />;
  const tenArt = <DoorArt kind="ten" />;

  /**
   * The camera's condition, and the order the two causes are tested in.
   *
   * CAPABILITY BEFORE PERMISSION, here and in the `subdued` flag below. A build
   * with no camera module has refused nobody anything, and telling that reader
   * to visit Settings sends them looking for a switch that is not there.
   */
  const cameraCondition = !CAMERA_AVAILABLE ? (
    <DoorCondition>
      <Text variant="note" style={{ color: theme.ink }}>
        {CAMERA_MODULE_LINE}
      </Text>
      <DoorConditionAction
        title={CAMERA_MODULE_ACTION}
        accessibilityHint="Opens Help, where the update instructions are"
        onPress={() => router.push('/help' as Href)}
      />
    </DoorCondition>
  ) : access === 'blocked' ? (
    <DoorCondition>
      <Text variant="note" style={{ color: theme.ink }}>
        {CAMERA_BLOCKED_LINE}
      </Text>
      <DoorConditionAction
        title={CAMERA_BLOCKED_ACTION}
        accessibilityLabel="Open Settings to turn the camera on"
        onPress={() => {
          setWentToSettings(true);
          openSettings();
        }}
      />
    </DoorCondition>
  ) : wentToSettings && access === 'granted' ? (
    // Returned from Settings with the permission granted. The notice flips to
    // the real state and NOTHING auto-launches: the owner presses when ready.
    <DoorCondition>
      <Text variant="note" style={{ color: theme.ink }}>
        Camera access is on. Tap Camera to photograph a piece.
      </Text>
    </DoorCondition>
  ) : null;

  /**
   * The library door's condition — declined processing consent, stated on the
   * door it changes, with the way back under it.
   *
   * `declined` was already computed here and drawn nowhere, so the only place
   * the choice was visible was the destination, after the tap.
   */
  const libraryCondition = declined ? (
    <DoorCondition>
      <Text variant="note" style={{ color: theme.ink }}>
        {LOCAL_MODE_LINE}
      </Text>
      <DoorConditionAction
        title={LOCAL_MODE_ACTION}
        accessibilityLabel="Change how photographs are handled"
        accessibilityHint="Reopens the choice about sending photographs to be tagged"
        onPress={() => setConsentVisible(true)}
      />
    </DoorCondition>
  ) : null;

  /** The doors settle a few points on entry; Reduce Motion gets a short fade. */
  const enter = (i: number) =>
    reduced
      ? FadeIn.duration(motion.duration.fast)
      : FadeInDown.duration(motion.duration.base).delay(i * motion.stagger);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      {/* Serif title left, plain control right — the app's own nav grammar, not
          glass chrome. "Cancel", not "Done": nothing has been started yet, so
          there is nothing to be finished, and leaving writes nothing. */}
      <View className="flex-row items-center justify-between px-gutter">
        <Text variant="title" trim>
          Add clothes
        </Text>
        {/* `px-0` so the label sits on the page gutter rather than 20pt inside it. */}
        <Button title="Cancel" variant="ghost" className="px-0" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter"
        contentContainerStyle={{
          paddingTop: AC.peerLineTop,
          paddingBottom: insets.bottom + 20,
        }}>
        {/*
          THE LEAD DOOR — The Ten, and only while the closet is under the cap.

          Today's "Add your clothes" used to branch here itself, opening The Ten
          instead of this chooser, so a new reader never saw the four doors and
          could not reach Describe or Talk it in. Today now always opens the
          chooser and The Ten is drawn as its first door instead, which keeps
          both promises at once: every way in is visible, and there is still a
          way back into The Ten for somebody who backed out of it
          (docs/design/positioning-contract.md §1).

          It is drawn ABOVE the four and not among them, and it is the one plate
          on the page wearing the accent, because it is not a fifth way to add
          one garment — it is a guided run at the first ten, and the doors below
          are what it uses. It is never counted in the peer sentence.

          It disappears at the cap rather than dimming: The Ten would hydrate
          complete and tell somebody with a full closet "that's the ten", which
          is the same boundary `exitDestination` draws for the tour. `used` is
          0 while the count loads, so this can appear briefly for an instant on
          a cold start — harmless, and the alternative is hiding the lead door
          from the readers who most need it.
        */}
        {!capacity.full && capacity.used < capacity.limit ? (
          <Animated.View entering={enter(0)} style={{ marginBottom: AC.leadBottom }}>
            <DoorPlate
              tone="accent"
              name="The Ten"
              line="The ten pieces that make the most outfits."
              art={tenArt}
              accessibilityLabel="The Ten — a guided run at the ten pieces that make the most outfits"
              // No consent gate: The Ten opens a list, and each of its own doors
              // asks at the point it produces something to process.
              onPress={() => router.push('/the-ten')}
            />
          </Animated.View>
        ) : null}

        {/*
          The peer sentence, and why it sits HERE rather than under the title.

          The frame draws it under the title because the frame's default state
          has no lead door. This screen draws The Ten above the four, and a
          sentence reading "Four ways in" under the title would be counting
          five plates. Directly above the four, it counts exactly the four it
          precedes — which is what makes it true rather than merely placed
          correctly, and it is the order VoiceOver reads them in.
        */}
        <Text variant="note" style={{ marginBottom: AC.peerLineBottom }}>
          {PEER_LINE}
        </Text>

        <View style={{ gap: AC.doorGap }}>
          <Animated.View entering={enter(1)}>
            <DoorPlate
              name={ROUTE.catalogue.name}
              line={ROUTE.catalogue.line}
              art={catalogueArt}
              accessibilityLabel={ROUTE.catalogue.accessibilityLabel}
              /**
               * STRAIGHT THROUGH, NOT `openContentDoor`.
               *
               * The consent sheet exists because a photograph is about to be
               * sent to an AI model. Typed catalogue search is not AI
               * processing — the words go to Cinch and to the licensed shop
               * catalogue, and Packet 1 moved `action: 'search'` above the
               * server's consent gate to make that true rather than merely
               * stated. Gating this door would ask for permission to do
               * something the destination does not do, and would put a wall in
               * front of the one intake route that works with AI processing
               * switched off.
               *
               * The spoken half of `/find-photo` carries its own recording
               * disclosure, in the field, above the microphone — about a
               * recording, not a photograph. Same reasoning as the Voice door.
               */
              onPress={() => router.push('/find-photo')}
            />
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <DoorPlate
              name={ROUTE.camera.name}
              line={ROUTE.camera.line}
              art={cameraArt}
              accessibilityLabel={ROUTE.camera.accessibilityLabel}
              subdued={!CAMERA_AVAILABLE || access === 'blocked'}
              // Permission is not gated here: nothing exists to process until the
              // shutter, and that is where capture asks. CAPABILITY is, and has to
              // be — `/capture` statically imports `CameraView`, so on a binary
              // without the module this door would not open a screen, it would
              // throw on the way there.
              // Cast on the WHOLE expression, not on one arm. expo-router's `Href`
              // is a generated union over every file in src/app, and a ternary of
              // two members of it is a union of unions — which tipped past
              // TS2590's complexity ceiling the moment Catalogue Photo V2 added
              // seventeen fixture routes. Casting the result keeps one `Href` where
              // there were two. `tests/dev-route-index.test.ts` checks both paths
              // against the filesystem, so the cast hides nothing.
              onPress={() =>
                router.push((CAMERA_AVAILABLE ? '/capture' : '/camera-unavailable') as Href)
              }
              condition={cameraCondition}
            />
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <DoorPlate
              name={ROUTE.library.name}
              line={ROUTE.library.line}
              art={libraryArt}
              accessibilityLabel={ROUTE.library.accessibilityLabel}
              // Into the SAME queue the camera feeds, which is why this opens the
              // picker on the capture surface rather than running one of its own:
              // capacity and the upload queue are both owned there, and a second
              // picker would be a second copy of that flow.
              onPress={() => openContentDoor('/capture?start=library')}
              condition={libraryCondition}
            />
          </Animated.View>

          <Animated.View entering={enter(4)}>
            <DoorPlate
              name={ROUTE.voice.name}
              line={ROUTE.voice.line}
              art={voiceArt}
              accessibilityLabel={ROUTE.voice.accessibilityLabel}
              // Voice carries its own consent line, in the Walkthrough, above the
              // record button — about a recording, not a photograph.
              onPress={() => router.push('/walkthrough')}
            />
          </Animated.View>
        </View>

        {/*
          THE CATALOGUE ROUTE'S DISCLOSURE — AC-C1.

          Under the four, in a tray of its own, because it is about one of them
          and a reader has to have met it to need this. It travels with the
          control rather than living in a settings screen.

          The route has been renamed twice and this is the third; the whole
          argument is recorded on `INTAKE_ROUTES` so it does not have to be had
          again. The short version: audit 66 paired it with voice as "one act in
          two media", and they are not one act. Voice files the reader's own
          words; this searches a licensed product-listing catalogue and returns
          a shop's photograph. It is the only one of the four that reaches a
          third party, which is why it is named for that and why this sits with
          the doors.
        */}
        <View
          className="bg-tray"
          style={{
            marginTop: AC.disclosureTop,
            borderRadius: AC.disclosureRadius,
            paddingVertical: AC.disclosurePadV,
            paddingHorizontal: AC.disclosurePadH,
          }}>
          <Text variant="note">{CATALOGUE_DISCLOSURE}</Text>
        </View>

        {/*
          The capacity colophon — a COUNT, PRINTED ONLY WHEN KNOWN.

          `capacity.loading` omits the whole line rather than printing a
          placeholder or a dash — refusal 2 — and nothing here is estimated:
          both figures come off the live plan. Never a bar, a percentage, a
          streak or a countdown.
        */}
        {capacity.loading ? null : (
          <Text
            variant="colophon"
            style={{
              marginTop: AC.colophonTop,
              fontSize: AC.colophonSize,
              lineHeight: leading('helvetica', AC.colophonSize, 1.3),
              letterSpacing: tracking(AC.colophonSize, AC.colophonTracking),
            }}>
            {capacityColophon(capacity.used, capacity.limit)}
          </Text>
        )}

        {/*
          AC-03 — THE CEILING, AND WHY NO DOOR CLOSES.

          The frame was corrected on 2026-08-12 against this file's own
          behaviour, and the correction inverted it: an earlier rendering
          disabled the doors at capacity, which contradicted what ships. All
          four stay available, in the same order and at the same weight as the
          default, "because capacity is decided after the photograph or
          description exists, never before: acquiring is not adding, so the user
          cannot lose what they just captured to a door that refused to open."

          That IS W-02, the standing rule this screen has always held, and
          nothing here weakens it. Nor does it weaken the other half: the
          database still refuses an over-ceiling write (`before insert on
          items`, `before update of is_archived`).

          REDESIGN 23 DRAWS NO NOTICE HERE AT ALL — its at-cap frame is the four
          doors and a "30 of 30" colophon. That is a copy deletion rather than a
          restyle, and it would take the free recovery with it: `/storage` is
          reached from this screen and this notice is the only thing that names
          it. So the sentences and the action are the shipped ones, byte for
          byte, wearing the new tray geometry. Recorded as a deviation.

          The recovery offered is the one that costs nothing — store a piece you
          are not reaching for. No tier name, no price, no upgrade action and no
          paywall appears on this frame: capacity is arithmetic from the current
          plan, and membership is reached from Profile, which keeps this frame
          free of a second, competing decision.

          `capacity.full` is false while the count is still loading, so this
          cannot flash at someone who has room.
        */}
        {capacity.full ? (
          <View
            className="bg-tray"
            style={{
              marginTop: AC.noticeTop,
              borderRadius: AC.noticeRadius,
              padding: AC.noticePad,
            }}>
            <Text variant="label" className="text-ink">
              {SHELF_FULL_TITLE}
            </Text>
            <Text variant="note" className="mt-1">
              {SHELF_FULL_BODY}
            </Text>
            {/* The free recovery, and the only action on this notice. Not a
                filled control: the doors above are what this screen is for. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See stored pieces"
              accessibilityHint="Opens your stored pieces, where you can store or wake one"
              onPress={() => router.push('/storage')}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-1 justify-center active:opacity-60">
              <Text variant="label" className="text-ink">
                {SHELF_FULL_ACTION}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* AC-04. The shipped sheet, with its four contract-bound facts and its
          keep-option named for the thing kept — not the atlas's reduced
          "Allow / Not now" pair, which drops three of the facts and renames
          the decline to a form refusal 13 forbids. It cannot be dismissed
          without an answer, which is why the frame's
          "waiting on your answer" state has no counterpart here. */}
      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAccept()}
        onDecline={onDecline}
        onDismissed={openPending}
      />
    </SafeAreaView>
  );
}
