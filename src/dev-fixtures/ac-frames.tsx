import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DoorArt } from '@/components/ingest/door-art';
import { Button, DoorCondition, DoorConditionAction, DoorPlate, Text } from '@/components/ui';
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
import { CATALOGUE_DISCLOSURE, INTAKE_ROUTES } from '@/features/ingest/intake-routes';
import { leading, tracking } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Redesign 23's frames, posed inert — the shared body behind `dev-ac-01…08`.
 *
 * THE PRIMITIVES ARE THE REAL ONES. `DoorPlate`, `DoorCondition`,
 * `DoorConditionAction`, `DoorArt`, `Text` and `Button` are exactly what
 * `src/app/add-clothes.tsx` draws, and every string comes from
 * `add-clothes-spec.ts` or `intake-routes.ts` — the same two tables the screen
 * reads. What is faked is only the STATE each page is in: the camera's access,
 * the consent answer, the capacity count. A fixture that retyped the copy
 * would be a fixture that gets screenshotted as evidence something shipped
 * which did not, which is the failure `dev-add-clothes.tsx` records having
 * already made once with a retired door name.
 *
 * Every callback is a no-op, so no fixture can open a viewfinder, raise a
 * permission alert, reach a catalogue or write a row however hard it is
 * tapped. That seam is what lets the accepted frames be walked and
 * photographed on a device without a session or a network.
 *
 * WHAT IS NOT POSED HERE, AND WHY. Six of the artifact's thirty-six states
 * describe behaviour this build does not have and this packet did not add —
 * the offline door honesty, the "Opening …" resolving notices, the
 * consent sheet dismissed without an answer (the shipped sheet cannot be), and
 * the private-image fallback (these tiles are drawn, not fetched). Posing them
 * would draw a promise the app does not keep. They are listed as deviations in
 * the build report instead.
 */

export type AcPose = {
  /** The lead door is drawn only below the cap, and never dimmed at it. */
  lead: boolean;
  camera: 'open' | 'blocked' | 'no-module' | 'returned-granted';
  /** Processing consent was answered "not now" — the library door says so. */
  declined?: boolean;
  /** `null` poses the unresolved capacity query: the colophon is absent. */
  used: number | null;
  limit: number;
  full?: boolean;
};

const ROUTE = Object.fromEntries(INTAKE_ROUTES.map((r) => [r.key, r])) as Record<
  string,
  (typeof INTAKE_ROUTES)[number]
>;

/** One posed frame, full-bleed, with its atlas id printed above the title. */
export function AcFrame({ id, name, pose }: { id: string; name: string; pose: AcPose }) {
  const theme = useTheme();

  const cameraCondition =
    pose.camera === 'no-module' ? (
      <DoorCondition>
        <Text variant="note" style={{ color: theme.ink }}>
          {CAMERA_MODULE_LINE}
        </Text>
        <DoorConditionAction title={CAMERA_MODULE_ACTION} onPress={() => {}} />
      </DoorCondition>
    ) : pose.camera === 'blocked' ? (
      <DoorCondition>
        <Text variant="note" style={{ color: theme.ink }}>
          {CAMERA_BLOCKED_LINE}
        </Text>
        <DoorConditionAction title={CAMERA_BLOCKED_ACTION} onPress={() => {}} />
      </DoorCondition>
    ) : pose.camera === 'returned-granted' ? (
      <DoorCondition>
        <Text variant="note" style={{ color: theme.ink }}>
          Camera access is on. Tap Camera to photograph a piece.
        </Text>
      </DoorCondition>
    ) : null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      <View className="flex-row items-baseline gap-2 px-gutter">
        <Text variant="caption" style={{ color: theme.ink, opacity: 0.45 }}>
          {id}
        </Text>
        <Text variant="caption" style={{ color: theme.ink, opacity: 0.45 }}>
          {name}
        </Text>
      </View>

      <View className="flex-row items-center justify-between px-gutter">
        <Text variant="title" trim>
          Add clothes
        </Text>
        <Button title="Cancel" variant="ghost" className="px-0" onPress={() => {}} />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter"
        contentContainerStyle={{ paddingTop: AC.peerLineTop, paddingBottom: 40 }}>
        {pose.lead ? (
          <View style={{ marginBottom: AC.leadBottom }}>
            <DoorPlate
              tone="accent"
              name="The Ten"
              line="The ten pieces that make the most outfits."
              art={<DoorArt kind="ten" />}
              onPress={() => {}}
            />
          </View>
        ) : null}

        <Text variant="note" style={{ marginBottom: AC.peerLineBottom }}>
          {PEER_LINE}
        </Text>

        <View style={{ gap: AC.doorGap }}>
          <DoorPlate
            name={ROUTE.catalogue.name}
            line={ROUTE.catalogue.line}
            art={<DoorArt kind="catalogue" />}
            accessibilityLabel={ROUTE.catalogue.accessibilityLabel}
            onPress={() => {}}
          />
          <DoorPlate
            name={ROUTE.camera.name}
            line={ROUTE.camera.line}
            art={<DoorArt kind="camera" />}
            accessibilityLabel={ROUTE.camera.accessibilityLabel}
            subdued={pose.camera === 'blocked' || pose.camera === 'no-module'}
            onPress={() => {}}
            condition={cameraCondition}
          />
          <DoorPlate
            name={ROUTE.library.name}
            line={ROUTE.library.line}
            art={<DoorArt kind="library" />}
            accessibilityLabel={ROUTE.library.accessibilityLabel}
            onPress={() => {}}
            condition={
              pose.declined ? (
                <DoorCondition>
                  <Text variant="note" style={{ color: theme.ink }}>
                    {LOCAL_MODE_LINE}
                  </Text>
                  <DoorConditionAction title={LOCAL_MODE_ACTION} onPress={() => {}} />
                </DoorCondition>
              ) : null
            }
          />
          <DoorPlate
            name={ROUTE.voice.name}
            line={ROUTE.voice.line}
            art={<DoorArt kind="voice" />}
            accessibilityLabel={ROUTE.voice.accessibilityLabel}
            onPress={() => {}}
          />
        </View>

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

        {pose.used === null ? null : (
          <Text
            variant="colophon"
            style={{
              marginTop: AC.colophonTop,
              fontSize: AC.colophonSize,
              lineHeight: leading('helvetica', AC.colophonSize, 1.3),
              letterSpacing: tracking(AC.colophonSize, AC.colophonTracking),
            }}>
            {capacityColophon(pose.used, pose.limit)}
          </Text>
        )}

        {pose.full ? (
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
            <View style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }} className="mt-1">
              <Text variant="label" className="text-ink">
                {SHELF_FULL_ACTION}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The `__DEV__` refusal every fixture route opens with. */
export function NotAvailable() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
      <Text variant="label">Not available.</Text>
    </SafeAreaView>
  );
}
