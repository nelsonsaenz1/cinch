import { useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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
 * THE STATE IDS BELOW ARE WAVE 3'S. The refacing-era numbering (AC-01 default,
 * AC-02 reserved slot, AC-03 camera denied, AC-04 consent, AC-05 ceiling) is
 * superseded by the Closet and Intake atlas, which draws three:
 *
 * - AC-01 default — four peers, one height, no favourite. The typed and spoken
 *   Describe doors are named as the same act in two media (audit 66).
 * - AC-02 camera denied at the system level — the door keeps its position, its
 *   height and its name, states the cause on its own explanation line, and the
 *   recovery sits under it as a text action rather than arriving as an alert.
 *   The subtitle counts what is OPEN before naming what is not.
 * - AC-03 capacity reached — ALL FOUR DOORS STAY AVAILABLE. See the long note
 *   at the notice itself; the frame was corrected on 2026-08-12 against this
 *   file, and the correction inverted an earlier rendering that disabled them.
 *
 * The reserved "Lookup" door is still reserved and still undrawn: the atlas is
 * explicit that "nothing hints at a fifth row".
 *
 * Processing consent (the old AC-04) has no frame of its own here — see
 * CONSENT, below.
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
 * DESCRIBE BY VOICE is not gated either — voice carries its own consent line,
 * stated above the record button in the Walkthrough, about a recording rather
 * than a photograph.
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
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
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
          THE LEAD DOOR — The Ten, and only while the closet is under the cap.

          Today's "Add your clothes" used to branch here itself, opening The Ten
          instead of this chooser, so a new reader never saw the four doors and
          could not reach Describe or Talk it in. Today now always opens the
          chooser and The Ten is drawn as its first door instead, which keeps
          both promises at once: every way in is visible, and there is still a
          way back into The Ten for somebody who backed out of it
          (docs/design/positioning-contract.md §1).

          It is drawn ABOVE the four and not among them, because it is not a
          fifth way to add one garment — it is a guided run at the first ten,
          and the doors below are what it uses. That is also why this does not
          spend the reserved AC-02 slot.

          It disappears at the cap rather than dimming: The Ten would hydrate
          complete and tell somebody with a full closet "that's the ten", which
          is the same boundary `exitDestination` draws for the tour. `used` is
          0 while the count loads, so this can appear briefly for an instant on
          a cold start — harmless, and the alternative is hiding the lead door
          from the readers who most need it.
        */}
        {!capacity.full && capacity.used < capacity.limit ? (
          <DoorPlate
            name="The Ten"
            line="The ten pieces that make the most outfits."
            symbol="sparkles"
            accessibilityLabel="The Ten — a guided run at the ten pieces that make the most outfits"
            // No consent gate: The Ten opens a list, and each of its own doors
            // asks at the point it produces something to process.
            onPress={() => router.push('/the-ten')}
          />
        ) : null}
        {/*
          AC-01's subtitle, and AC-02's.

          It sits HERE rather than under the title, which is where the frame
          draws it, for one reason: the frame draws four doors and this screen
          draws The Ten above them (see the block over that plate). A sentence
          reading "Four ways in" under the title would be counting five plates.
          Directly above the four, it counts exactly the four it precedes —
          which is what makes it true rather than merely placed correctly.

          AC-02 swaps it for the count of what is OPEN before naming what is
          not: "the subtitle counts what is open before naming what is not."
        */}
        <Text variant="note" className="pt-1">
          {access === 'blocked'
            ? 'Three doors are open. The camera needs permission in Settings.'
            : 'Four ways in. All of them file the same kind of piece.'}
        </Text>

        <DoorPlate
          name="Camera"
          line="Photograph a piece against any wall."
          symbol="camera"
          accessibilityLabel="Camera — photograph a piece"
          // Not gated here: nothing exists to process until the shutter, and
          // that is where capture asks.
          onPress={() => router.push('/capture')}
          condition={
            access === 'blocked' ? (
              <DoorCondition>
                <View className="flex-1">
                  {/* AC-02 states the CAUSE on the door's own explanation line
                      — "its explanation line states the cause" — rather than
                      leaving the door silent and the recovery to carry it. */}
                  <Text variant="note">Cinch cannot open the camera until you allow it.</Text>
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
          name="Photo library"
          line="Pick pictures you already have — no permission needed."
          symbol="photo.on.rectangle"
          accessibilityLabel="Photo library — choose pictures you already have, no permission needed"
          // Into the SAME queue the camera feeds, which is why this opens the
          // picker on the capture surface rather than running one of its own:
          // capacity and the upload queue are both owned there, and a second
          // picker would be a second copy of that flow.
          onPress={() => openContentDoor('/capture?start=library')}
        />
        {/*
          THE TWO DESCRIBE DOORS, NAMED AS ONE ACT IN TWO MEDIA.

          This is audit 66, and it is a naming item before it is anything else:
          "Describe it and Describe by voice are stated as the same act in two
          media, which is the relationship the code models." The acceptance
          line is blunt about the other half — "Talk it in appears nowhere in
          the group."

          THIS REVERSES A SHIPPED RENAME, and the reason is recorded here so
          nobody has to guess. The typed door shipped as "Search for it" after
          the founder went hunting for a search door in the App Store build,
          failed to find one, and concluded the feature had not shipped. It had;
          it was called "Describe it". That discoverability problem is real, and
          it is answered here by the LINE rather than by the name: the line now
          states both jobs the field does ("type what it is, or paste a product
          link"), and the accessibility label keeps the word "finds". The name
          goes back to the atlas's because a pair named "Search for it" and
          "Describe by voice" is not a pair, which is precisely what audit 66
          exists to fix.
        */}
        <DoorPlate
          name="Describe it"
          line="Type what it is, or paste a product link."
          symbol="magnifyingglass"
          accessibilityLabel="Describe it — type what the piece is, or paste a product link, and Cinch finds its photo"
          onPress={() => openContentDoor('/capture?start=describe')}
        />
        <DoorPlate
          name="Describe by voice"
          line="Say it out loud instead of typing."
          symbol="waveform"
          accessibilityLabel="Describe by voice — say what you own out loud instead of typing"
          // Voice carries its own consent line, in the Walkthrough, above the
          // record button — about a recording, not a photograph.
          onPress={() => router.push('/walkthrough')}
        />

        {/*
          AC-01's closing line: "the capacity sentence closes the group", so the
          doors read as a finished list rather than a sparse one.

          A COUNT, PRINTED ONLY WHEN KNOWN. `capacity.loading` omits the whole
          line rather than printing a placeholder or a dash — refusal 2 — and
          nothing here is estimated: both figures come off the live plan.

          THE WORD IS "ACTIVE". An earlier drawing of this atlas said "awake"
          pieces, which would have put two names for one count on two screens —
          Profile's membership row and this one. The atlas was corrected to the
          repository's own term on 2026-08-12 and now carries no other, so the
          two agree by construction rather than by anyone remembering to.
        */}
        {capacity.loading ? null : (
          <Text variant="noteSmall" className="pt-1">
            {`${capacity.used} of ${capacity.limit} active pieces filed.`}
          </Text>
        )}

        {/*
          AC-03 — THE CEILING, AND WHY NO DOOR CLOSES.

          The frame was corrected on 2026-08-12 against this file's own
          behaviour, and the correction inverted it: an earlier rendering
          disabled the doors at capacity, which contradicted what ships. All
          four stay available, in the same order and at the same weight as
          AC-01, "because capacity is decided after the photograph or
          description exists, never before: acquiring is not adding, so the user
          cannot lose what they just captured to a door that refused to open."

          That IS W-02, the standing rule this screen has always held, and
          nothing here weakens it. Nor does it weaken the other half: the
          database still refuses an over-ceiling write (`before insert on
          items`, `before update of is_archived`). What the frame settles is
          when capacity is RESOLVED IN THE UI, not whether the row is allowed.

          THE FULL SHELF IS STATED ONCE, BELOW THE DOORS. The recovery offered
          is the one that costs nothing — store a piece you are not reaching
          for. No tier name, no price, no upgrade action and no paywall appears
          on this frame: capacity is arithmetic from the current plan, and
          membership is reached from Profile, "which keeps this frame free of a
          second, competing decision."

          `capacity.full` is false while the count is still loading, so this
          cannot flash at someone who has room.
        */}
        {capacity.full ? (
          <View className="rounded-md bg-tray p-3.5">
            <Text variant="label" className="text-ink">
              The active shelf is full
            </Text>
            <Text variant="note" className="mt-1">
              Adding still starts normally. Once the new photograph or description exists, Cinch
              asks you to store a piece you are not reaching for — nothing you just added is lost
              while you decide. Stored pieces keep their photographs, wear history and price.
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
                See stored
              </Text>
            </Pressable>
          </View>
        ) : null}
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
