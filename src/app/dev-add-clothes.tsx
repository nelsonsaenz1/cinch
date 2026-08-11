import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, DoorCondition, DoorPlate, Text } from '@/components/ui';
import { useTheme } from '@/theme/tokens';

/**
 * Add Clothes fixture — `cinch://dev-add-clothes`.
 *
 * The AC atlas as one vertically scrolling screen: AC-01 … AC-05, hardcoded,
 * signed out, with no camera permission read and no live capacity count. One
 * full-height page per state, labelled with its atlas ID, so the whole atlas
 * can be judged on-device against `docs/design/refacing/`.
 *
 * The doors are the REAL `DoorPlate`, and the header is the real `Text` and
 * `Button` the screen draws, so the fixture cannot drift from
 * `src/app/add-clothes.tsx` on any value that matters. What is faked is only
 * the state each page is in.
 *
 * TWO STATES ARE DRAWN HERE THAT THE SCREEN DOES NOT SHIP, and both are drawn
 * with their reason printed under them: AC-02's reserved slot (the "Lookup"
 * door is undefined and deliberately not designed) and AC-05's ceiling notice
 * (its sentence is an unresolved `[CLAIM]`). See
 * `docs/design/refacing/AC-HANDOVER.md`. They are here so the open questions
 * are visible on a device rather than only in a document.
 *
 * Dev-only, like dev-capture and dev-closet: `__DEV__`-gated by the `dev-`
 * prefix in the auth gate.
 */
export default function DevAddClothes() {
  const { height } = useWindowDimensions();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <ScrollView>
        <Frame height={height} id="AC-01" name="default — four doors, equal plates">
          <Doors />
        </Frame>

        <Frame height={height} id="AC-02" name="fifth slot, reserved — NOT drawn">
          <Doors />
          <ReservedSlot />
          <Aside>
            Open question, returned to the founder: what is “Lookup” — a barcode or tag scan, or a
            retailer catalogue search — and where does it land? The grid reserves the fifth slot so
            it never needs redrawing; until answered, AC-01 ships as four doors.
          </Aside>
        </Frame>

        <Frame height={height} id="AC-03" name="camera previously denied — the condition rides the door">
          <Doors cameraBlocked />
          <Aside>
            The condition is stated before the tap, not discovered after it. “Open Settings” is this
            page’s one oxblood — a link inside a condition, never a door.
          </Aside>
        </Frame>

        <Frame height={height} id="AC-04" name="AI processing declined — consent fires on the door tapped">
          <Doors />
          <Aside>
            The atlas draws the consent sheet over this chooser. The shipped sheet — with its four
            contract-bound facts and its A-04 decline explainer — belongs to the capture surface each
            processing door lands on, and fires there on the door tapped. Moving it is a refactor,
            not a redraw; see the handover note.
          </Aside>
        </Frame>

        <Frame height={height} id="AC-05" name="at the ceiling — chooser renders undimmed">
          <Doors />
          <Aside>
            No per-door disable state, and no dimming: the plates stay interactive. The atlas prints
            a tray notice here whose sentence is an unresolved [CLAIM] against
            membership-packing-contract.md, so it is not drawn. Capacity is also still decided once a
            photograph exists (the Wall’s W-02), not at this door — the conflict the handover note
            records.
          </Aside>
        </Frame>
      </ScrollView>
    </SafeAreaView>
  );
}

/** One atlas page: the ID strip, the real header, and the state below it. */
function Frame({
  height,
  id,
  name,
  children,
}: {
  height: number;
  id: string;
  name: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ minHeight: height }} className="border-b border-rule pb-8">
      <View className="flex-row items-baseline gap-2 px-gutter pt-2">
        <Text variant="caption" style={{ color: theme.ink, opacity: 0.45 }}>
          {id}
        </Text>
        <Text variant="caption" style={{ color: theme.ink, opacity: 0.45 }}>
          {name}
        </Text>
      </View>
      {/* The real header, drawn with the real primitives. */}
      <View className="flex-row items-center justify-between px-gutter">
        <Text variant="title" trim>
          Add clothes
        </Text>
        <Button title="Cancel" variant="ghost" className="px-0" onPress={() => {}} />
      </View>
      <View className="px-gutter pt-5" style={{ gap: 12 }}>
        {children}
      </View>
    </View>
  );
}

/** The four doors, verbatim — the copy the screen ships. */
function Doors({ cameraBlocked = false }: { cameraBlocked?: boolean }) {
  const theme = useTheme();
  return (
    <>
      <DoorPlate
        name="Camera"
        line="True colour, one piece at a time."
        symbol="camera"
        onPress={() => {}}
        condition={
          cameraBlocked ? (
            <DoorCondition>
              <View className="flex-1">
                <Text variant="note">Camera access is off for Cinch.</Text>
              </View>
              <Text variant="note" style={{ color: theme.accent }}>
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
        onPress={() => {}}
      />
      <DoorPlate
        name="Describe it"
        line="No photo to hand — say what it is."
        symbol="text.alignleft"
        onPress={() => {}}
      />
      <DoorPlate
        name="Talk it in"
        line="Your whole closet, four minutes."
        symbol="waveform"
        onPress={() => {}}
      />
    </>
  );
}

/**
 * AC-02's empty slot — dashed `rule-strong`, plate radius, 96 tall.
 *
 * Drawn in the fixture ONLY. The shipped chooser has four doors; this is the
 * space the fifth would occupy, held open so answering the Lookup question is
 * a redraw of one plate rather than of the grid.
 */
function ReservedSlot() {
  const theme = useTheme();
  return (
    <View
      className="items-center justify-center"
      style={{
        height: 96,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.ruleStrong,
      }}>
      <Text variant="note">reserved slot — “Lookup”</Text>
      <Text variant="note">door + destination undefined; not drawn</Text>
    </View>
  );
}

/** A fixture annotation. Never an app surface — it explains the page above it. */
function Aside({ children }: { children: React.ReactNode }) {
  return (
    <View className="mt-3 rounded bg-tray p-3">
      <Text variant="note">{children}</Text>
    </View>
  );
}
