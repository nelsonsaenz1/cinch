import { useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { Button, DoorCondition, DoorPlate, Text } from '@/components/ui';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import {
  DECLINED_KEY,
  EXPLAINER_SEEN_KEY,
  readFlag,
  writeFlag,
} from '@/features/ingest/consent-mode';
import { useCapacity } from '@/features/billing/use-capacity';
import { useCameraStatus } from '@/features/ingest/use-camera-access';
import { useTheme } from '@/theme/tokens';

import { DeclineExplainer } from './capture';

/**
 * AC-01 — Add Clothes, the entry chooser.
 *
 * The door before the doors. Eight places in the app used to route straight
 * into a live viewfinder, which made the camera the only way into a closet and
 * quietly told anyone without the garment in front of them to come back later.
 * Four ways in, drawn as peers.
 *
 * ZERO OXBLOOD HERE. The accent means "the one thing to do on this screen", and
 * this screen's whole question is which of four things you want to do. Neither
 * capture nor voice reads as the fallback; that is T-00's equal-doors rule,
 * generalised (§3.2). The single exception is AC-03's "Open Settings", which is
 * a link inside a condition on a door rather than a door.
 *
 * THE STATES
 *
 * - AC-01 default — the four doors.
 * - AC-02 the fifth slot — a reserved "Lookup" door whose destination the
 *   founder has not defined. NOT DRAWN, deliberately: the directive reserves
 *   the space so the grid never needs redrawing, and ships four until the
 *   question is answered. See docs/design/refacing/AC-HANDOVER.md.
 * - AC-03 camera denied — the condition rides the Camera door, stated before
 *   the tap rather than discovered after it.
 * - AC-04 processing consent — see CONSENT, below.
 * - AC-05 at the ceiling — the chooser renders undimmed and every door stays
 *   interactive. Capacity is decided once a photograph exists, per the Wall's
 *   W-02, not at this door. Settled 2026-08-11: W-02 stands.
 *
 * CONSENT (AC-04), AND WHY ONLY TWO DOORS CARRY IT
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
 * TALK IT IN is not gated either — voice carries its own consent line, stated
 * above the record button in the Walkthrough, about a recording rather than a
 * photograph.
 *
 * Whatever is answered here is persisted under the same two keys capture reads
 * (`features/ingest/consent-mode.ts`), so the destination does not ask again.
 */
export default function AddClothesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  const granted = consent.data?.granted === true;
  const declined = !granted && (declinedLocally || consent.data?.revokedAt != null);
  /**
   * Unanswered — and `undefined` while the query is still in flight, which is
   * NOT unanswered. Treating a pending read as "never asked" would put the
   * sheet in front of somebody who answered it months ago, every time this
   * screen opened cold.
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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Serif title left, plain control right — the app's own nav grammar, not
          glass chrome. "Cancel", not "Done": nothing has been started yet, so
          there is nothing to be finished. */}
      <View className="flex-row items-center justify-between px-gutter">
        <Text variant="title" trim>
          Add clothes
        </Text>
        {/* Ghost regular 17, per reference board A — and `px-0` so the label
            sits on the page gutter rather than 20pt inside it. */}
        <Button title="Cancel" variant="ghost" className="px-0" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pt-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, gap: 12 }}>
        {/*
          AC-05 — the ceiling, stated before the effort rather than after it.

          The atlas's sentence ("new pieces will ask about Standard first")
          describes a gate order this app does not have: W-02 stands, so the
          ask comes once a photograph exists, not at the door. Printing it
          would promise a paywall that never fires here. This says what
          actually happens instead — and it is the reason the notice is worth
          drawing at all, since the whole point is not to let someone
          photograph a jacket before finding out.

          The count is `capacity.limit`, read live off the plan. Never a
          literal: refusal 7 prints or drops a number, never estimates one,
          and refusal 8 keeps the ten out of marketing constants.
          `capacity.full` is false while the count is still loading, so this
          cannot flash at someone who has room.
        */}
        {capacity.full ? (
          <View className="rounded-md bg-tray p-3 dark:bg-tray-dark">
            <Text variant="note">
              Your {capacity.limit} active pieces are full. Adding still works — Cinch asks about
              room once the piece is here, and stores rather than deletes.
            </Text>
          </View>
        ) : null}
        <DoorPlate
          name="Camera"
          line="True colour, one piece at a time."
          symbol="camera"
          accessibilityLabel="Camera — photograph a piece"
          // Not gated here: nothing exists to process until the shutter, and
          // that is where capture asks.
          onPress={() => router.push('/capture')}
          condition={
            access === 'blocked' ? (
              <DoorCondition>
                <View className="flex-1">
                  <Text variant="note">Camera access is off for Cinch.</Text>
                  {/*
                    The atlas draws "Your photos stay put either way" here and
                    marks it [CLAIM]. It cannot ship as drawn: for anyone who
                    has granted processing consent it is FALSE — their photos
                    do leave the phone, to be tagged. A privacy sentence that
                    is true only for some readers is the worst kind.

                    What the line was reaching for IS provable, and this is it:
                    the camera permission and the processing consent are two
                    separate gates. Granting the first sends nothing. The
                    second is asked for explicitly (`ConsentSheet`) and is
                    enforced server-side on every Edge Function call, so
                    "nothing is sent without asking" is a claim about
                    behaviour the code actually holds up.
                  */}
                  <Text variant="note">
                    Turning it on only opens the viewfinder — nothing is sent without asking.
                  </Text>
                </View>
                {/* This page's ONE oxblood. A link inside a condition, not a
                    door: the doors stay peers even when one of them is shut. */}
                <Text
                  accessibilityRole="button"
                  accessibilityLabel="Open Settings to turn the camera on"
                  variant="note"
                  style={{ color: theme.accent }}
                  onPress={openSettings}>
                  Open Settings
                </Text>
              </DoorCondition>
            ) : null
          }
        />
        <DoorPlate
          name="Photo Library"
          line="The pictures you already have."
          symbol="photo.on.rectangle"
          accessibilityLabel="Photo Library — choose pictures you already have"
          // Into the SAME queue the camera feeds, which is why this opens the
          // picker on the capture surface rather than running one of its own:
          // capacity and the upload queue are both owned there, and a second
          // picker would be a second copy of that flow.
          onPress={() => openContentDoor('/capture?start=library')}
        />
        <DoorPlate
          name="Describe it"
          line="No photo to hand — say what it is."
          symbol="text.alignleft"
          accessibilityLabel="Describe it — say what the piece is, without a photo"
          onPress={() => openContentDoor('/capture?start=describe')}
        />
        <DoorPlate
          name="Talk it in"
          line="Your whole closet, four minutes."
          symbol="waveform"
          accessibilityLabel="Talk it in — describe your whole closet out loud"
          // Voice carries its own consent line, in the Walkthrough, above the
          // record button — about a recording, not a photograph.
          onPress={() => router.push('/walkthrough')}
        />
      </ScrollView>

      {/* AC-04. The shipped sheet, with its four contract-bound facts and its
          keep-option named for the thing kept — not the atlas's reduced
          "Allow / Not now" pair, which drops three of the facts and renames
          the decline to a form refusal 13 forbids. */}
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
