import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DoorPlate } from '@/components/ui/door-plate';
import { Text } from '@/components/ui/text';
import {
  CATALOGUE_DISCLOSURE,
  INTAKE_ROUTES,
  TEN_MIXING_NOTE,
} from '@/features/ingest/intake-routes';
import {
  FIRST_TEN_DOORS,
  RESUME_HEADLINE,
  resumeCardCopy,
  TEN_TITLE,
} from '@/features/onboarding/ten-copy';

/**
 * TN-C1 (was TR-05) and TR-06 — the FOUR doors into the first ten, and the same
 * screen when a walkthrough was left unfinished.
 *
 * ── WHY THIS SCREEN GREW TWO DOORS ────────────────────────────────────────
 *
 * It used to offer two, Photograph and Voice, while Add clothes offered four.
 * "That is the founder-visible failure: the first thing a new user meets is the
 * narrowest door in the app." Somebody whose clothes were not in front of them
 * — on a train, at work, at the start of exactly the ten minutes this flow is
 * designed for — had a camera and a microphone and no third option, when the
 * app has had one all along.
 *
 * Same four, same order, same subtitles as AC-C1, read from the same table, so
 * a reader who learns the doors here meets them unchanged in Add clothes. The
 * mixing note is TN-C1's one addition, because at first run a target of ten
 * makes route-switching likely and nothing else on the screen says it is
 * allowed.
 *
 * THE ACCEPTANCE CRITERION IS THAT THE DOORS READ AS PEERS. Not "primary and
 * fallback": same plate, same radius, same icon well, same weight, and neither
 * one filled. A filled door would make the other read as the consolation, which
 * is exactly the reading the voice path spent a whole atlas section refusing.
 * `DoorPlate` is the Wave 2 primitive the Add Clothes chooser already draws, so
 * a returning reader meets one object twice rather than two similar ones — this
 * screen must never grow its own copy of it.
 *
 * NO OXBLOOD ON EITHER DOOR, and so the frame spends its accent nowhere: this
 * page is asking which way in, not recommending one. TR-06 is the exception the
 * atlas draws, and even there the accent stays unspent — Resume is INK, because
 * carrying on is the obvious thing rather than the persuaded thing.
 */

export type UnfinishedWalkthrough = {
  /** How many pieces the parse heard. */
  heard: number;
  /** How many the reader confirmed before leaving. */
  confirmed: number;
  /** The procession cursor — the same figure the card masthead prints. */
  cursor: number;
  /**
   * The day it was recorded, already formatted ("Tuesday").
   *
   * Passed in rather than derived here, and deliberately so: a component that
   * formats a date from a clock cannot be photographed twice with the same
   * bytes, and every fixture in this group has to be deterministic.
   */
  weekday: string;
};

export function FirstTenDoors({
  unfinished,
  onRoute,
  onResume,
  onStartAgain,
}: {
  /** TR-06 when present, TN-C1 when null. */
  unfinished: UnfinishedWalkthrough | null;
  /**
   * One handler for all four, keyed by route. A prop per door would have to
   * grow every time the table does, which is the coupling this replaces.
   */
  onRoute: (key: (typeof INTAKE_ROUTES)[number]['key']) => void;
  onResume: () => void;
  onStartAgain: () => void;
}) {
  const resume = unfinished
    ? resumeCardCopy(
        unfinished.heard,
        unfinished.confirmed,
        unfinished.cursor,
        unfinished.weekday,
      )
    : null;

  return (
    <ScrollView contentContainerClassName="px-gutter pb-8" keyboardShouldPersistTaps="handled">
      <Text variant="eyebrow" className="pt-1">
        {TEN_TITLE}
      </Text>
      <View style={{ marginTop: 4, marginBottom: 10 }}>
        <Text variant="display" trim accessibilityRole="header">
          {resume ? RESUME_HEADLINE : FIRST_TEN_DOORS.headline}
        </Text>
      </View>

      {resume ? (
        <>
          {/* One card, never a list: there is only ever one unfinished
              walkthrough, and a list of one is a promise the flow cannot keep. */}
          <View className="rounded-plate border border-rule bg-surface" style={{ padding: 16 }}>
            <Text variant="eyebrow">{resume.eyebrow}</Text>
            <Text variant="heading" className="mb-1" style={{ fontSize: 19, marginTop: 6 }}>
              {resume.title}
            </Text>
            <Text variant="note" style={{ fontSize: 15, lineHeight: 22 }}>
              {resume.body}
            </Text>
            <View style={{ marginTop: 14, gap: 4 }}>
              {/* Ink, not oxblood — see the note at the top of this file. */}
              <Button
                title={resume.action}
                variant="ink"
                onPress={onResume}
                className="self-stretch"
              />
              <Button
                title={resume.secondary}
                variant="ghost"
                onPress={onStartAgain}
                className="self-stretch"
              />
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            {/* TR-06 keeps ONE door under the resume card, and it is the
                camera: the reader already chose voice once and the card above
                is the way back into it. */}
            <DoorPlate
              name={FIRST_TEN_DOORS.photograph.name}
              line={FIRST_TEN_DOORS.photograph.shortLine}
              symbol="camera"
              accessibilityLabel="Photograph them — ten named slots, one picture each"
              onPress={() => onRoute('camera')}
            />
          </View>
        </>
      ) : (
        <>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {FIRST_TEN_DOORS.body}
          </Text>
          <View style={{ marginTop: 20, gap: 12 }}>
            {/* Straight off the shared table, in its order. Mapped rather than
                written out four times: a door written by hand here is a door
                that drifts from Add clothes, which is the whole bug. */}
            {INTAKE_ROUTES.map((route) => (
              <DoorPlate
                key={route.key}
                name={route.name}
                line={route.tenLine}
                symbol={route.symbol}
                accessibilityLabel={route.accessibilityLabel}
                onPress={() => onRoute(route.key)}
              />
            ))}
          </View>

          {/* TN-C1's own line. */}
          <Text variant="note" style={{ marginTop: 16 }}>
            {TEN_MIXING_NOTE}
          </Text>
          <Text variant="noteSmall" style={{ marginTop: 10 }}>
            {CATALOGUE_DISCLOSURE}
          </Text>
          {/* A statement of fact in the regular cut, not a request. The request
              is the consent the chosen door raises one screen later. */}
          <Text variant="note" style={{ marginTop: 14 }}>
            {FIRST_TEN_DOORS.footer}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
