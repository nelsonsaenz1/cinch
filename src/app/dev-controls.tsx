import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReactionBar } from '@/components/today/reaction-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Rule } from '@/components/ui/rule';
import { SearchField } from '@/components/ui/search-field';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';

/**
 * Every state audit item 49 pins as data, drawn as pixels. `__DEV__` only,
 * reachable at `/dev-controls`.
 *
 * Item 49 pins the six components' contracts as tables — which token, which
 * weight, which height, per variant — because that is the shape every bug they
 * shipped actually had. What a table cannot say is whether the result LOOKS
 * right at the largest Dynamic Type, and it cannot say it because the tables
 * hold class names, not layout.
 *
 * So this is the other half, and item 50's screen matrix photographs it at
 * three widths. Between them: the contract is asserted, and the rendering of
 * that contract is diffed.
 *
 * WHY A FIXTURE AND NOT THE REAL SCREENS
 *
 * The matrix used to capture `/`, `/closet` and `/plan`. All three sit behind
 * the auth gate, so on a signed-out simulator they render the SAME welcome
 * screen and the run produced three identical PNGs. Signing in does not fix
 * it either: Today prints the date, the weather and a fresh outfit, so its
 * bytes change daily by design. Neither is a thing a baseline can hold still.
 *
 * A fixture can be held still, and it costs no account and no production data.
 * The real screens still get walked by eye — `docs/design/dynamic-type-walk.md`
 * is where that is recorded.
 *
 * Nothing here is interactive on purpose: the handlers are no-ops so a stray
 * tap during a capture cannot change what the next screenshot sees.
 */

const noop = () => {};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7">
      <Text variant="eyebrow">{title}</Text>
      <Rule className="mb-3 mt-1.5" />
      {children}
    </View>
  );
}

export default function DevControlsScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View className="px-gutter">
          <Text variant="title" trim>
            Controls
          </Text>
          <Text variant="note" className="mt-2">
            The states `tests/*-spec.test.ts` pins, rendered. Set the simulator to the largest
            Dynamic Type before reading this.
          </Text>

          {/*
           * All six variants, so the two bugs the contract records are visible
           * as well as asserted: a label the colour of its own ground, and
           * `ghost` sitting at a different height from the rest.
           */}
          <Section title="Button · six variants">
            <View className="gap-3">
              <Button title="Primary" onPress={noop} />
              <Button title="Ink" variant="ink" onPress={noop} />
              <Button title="Secondary" variant="secondary" onPress={noop} />
              <Button title="Ghost" variant="ghost" onPress={noop} />
              <Button title="Critical" variant="critical" onPress={noop} />
            </View>
          </Section>

          {/* Inverse is the one variant that only works on a dark ground. */}
          <Section title="Button · inverse, on the ground it is for">
            <View className="rounded-md bg-ink p-4">
              <Button title="Inverse" variant="inverse" onPress={noop} />
            </View>
          </Section>

          {/*
           * Disabled but NOT loading, in both this section and the settings
           * rows below. `loading` renders an ActivityIndicator, which spins:
           * the capture lands on whatever frame the shutter caught, and the
           * screen never reproduces its own bytes. Two rows of a clean diff
           * came back CHANGED before this was cut.
           *
           * The loading contract is not lost — `button-spec.test.ts` and
           * `settings-row-spec.test.ts` pin which colour the spinner takes and
           * which ground stays under it, and a table holds still by nature.
           */}
          <Section title="Button · disabled">
            <View className="gap-3">
              <Button title="Disabled" onPress={noop} disabled />
              <Button title="Disabled, filled tone" onPress={noop} disabled disabledTone="filled" />
            </View>
          </Section>

          {/*
           * A wrapped row is where the `tap` chip's zero vertical slop earns
           * itself: overlapping slop between two lines makes the boundary
           * between them a coin toss.
           */}
          <Section title="Chip · tones, sizes and selection">
            <View className="flex-row flex-wrap gap-2">
              <Chip label="Outline" onPress={noop} />
              <Chip label="Selected" selected onPress={noop} />
              <Chip label="On ink" selected selectedGround="ink" onPress={noop} />
              <Chip label="With count" count={12} onPress={noop} />
              <Chip label="Selected count" count={12} selected onPress={noop} />
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Chip label="Tap sized" size="tap" onPress={noop} />
              <Chip label="Tap selected" size="tap" selected onPress={noop} />
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Chip label="Read-only tag" tone="fill" />
              <Chip label="+ Tag" tone="dashed" onPress={noop} />
            </View>
          </Section>

          <Section title="SearchField · empty and filled">
            <SearchField value="" onChangeText={noop} placeholder="Search your closet" />
            <View className="mt-3">
              <SearchField
                value="charcoal herringbone overcoat"
                onChangeText={noop}
                placeholder="Search your closet"
              />
            </View>
          </Section>

          <Section title="SettingsRow · every trailing state">
            <SettingsRow label="Plain row" onPress={noop} />
            <SettingsRow label="With a detail" detail="2 waiting" onPress={noop} />
            <SettingsRow label="Leaves the app" external onPress={noop} />
            <SettingsRow label="Not yet available" disabled onPress={noop} />
            {/* The one accent row in the whole app. */}
            <SettingsRow label="Delete account" tone="accent" onPress={noop} />
          </Section>

          {/*
           * Reacted and un-reacted are the pair worth holding still: a faded
           * pill and a hidden one are the same in a tree snapshot and entirely
           * different to a screen reader, which is why item 49 pins the
           * accessibility state and item 50 pins the pixels.
           */}
          <Section title="ReactionBar · resting and recorded">
            <ReactionBar onReact={noop} />
            <View className="mt-4">
              <ReactionBar onReact={noop} reacted={{ liked: true }} />
            </View>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
