/**
 * CP-08 fixture — redesign 22, frames 11 and 20: the three decisions.
 *
 * The brief's second clause, in isolation: "keep/fix/drop as big tinted buttons
 * with haptics". Both compositions are drawn together so the AX change is
 * visible as a COMPOSITION change rather than a scale — side by side at the
 * frames' 1.4 / 1 / 1 widths, then stacked full width at the same 60pt, which
 * is what frame 20 asks for so "none of them is ever a cramped third".
 *
 * The semantics are the shipped ones and Drop is not destructive; see the
 * docblock over `decisions` in `components/review/review-card.tsx`.
 *
 * Inert: the callbacks are no-ops. The haptic still fires, which is the point —
 * it is the one thing a screenshot cannot show.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Decisions } from '@/components/ingest/capture-parts';

export default function DevCp08DecisionsScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-canvas">
      <View className="px-gutter pt-6" style={{ gap: 24 }}>
        <View style={{ gap: 8 }}>
          <Text variant="eyebrow">Frame 11 · default</Text>
          <Decisions stacked={false} onKeep={() => {}} onFix={() => {}} onDrop={() => {}} />
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="eyebrow">Frame 20 · largest accessibility text</Text>
          <Decisions stacked onKeep={() => {}} onFix={() => {}} onDrop={() => {}} />
        </View>
      </View>
    </SafeAreaView>
  );
}
