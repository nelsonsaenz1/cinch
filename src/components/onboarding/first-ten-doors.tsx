import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DoorPlate } from '@/components/ui/door-plate';
import { Text } from '@/components/ui/text';
import {
  FIRST_TEN_DOORS,
  RESUME_HEADLINE,
  resumeCardCopy,
  TEN_TITLE,
} from '@/features/onboarding/ten-copy';

/**
 * TR-05 and TR-06 — the two doors into the first ten, and the same screen when
 * a walkthrough was left unfinished.
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
  onPhotograph,
  onVoice,
  onResume,
  onStartAgain,
}: {
  /** TR-06 when present, TR-05 when null. */
  unfinished: UnfinishedWalkthrough | null;
  onPhotograph: () => void;
  onVoice: () => void;
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
            <DoorPlate
              name={FIRST_TEN_DOORS.photograph.name}
              line={FIRST_TEN_DOORS.photograph.shortLine}
              symbol="camera"
              accessibilityLabel="Photograph them — ten named slots, one picture each"
              onPress={onPhotograph}
            />
          </View>
        </>
      ) : (
        <>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {FIRST_TEN_DOORS.body}
          </Text>
          <View style={{ marginTop: 20, gap: 12 }}>
            <DoorPlate
              name={FIRST_TEN_DOORS.photograph.name}
              line={FIRST_TEN_DOORS.photograph.line}
              symbol="camera"
              accessibilityLabel="Photograph them — ten named slots, one picture each"
              onPress={onPhotograph}
            />
            <DoorPlate
              name={FIRST_TEN_DOORS.voice.name}
              line={FIRST_TEN_DOORS.voice.line}
              symbol="waveform"
              accessibilityLabel="Describe them out loud — walk your wardrobe and say what is in it"
              onPress={onVoice}
            />
          </View>
          {/* A statement of fact in the regular cut, not a request. The request
              is the consent the chosen door raises one screen later. */}
          <Text variant="note" style={{ marginTop: 20 }}>
            {FIRST_TEN_DOORS.footer}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
