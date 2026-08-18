import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerRow } from '@/components/circles';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PICKER, pickerSubtitle, sendInvitationsLabel } from '@/features/circles/copy';
import type { InviteIneligibility } from '@/features/circles/types';

/**
 * GR-08 · redesign 27 — the invite picker, with every reason a row can be inert.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · THE UNAVAILABLE ROWS ARE STILL ON THE LIST. Somebody hunting for a friend
 *   who is not there learns nothing from an absence; a row that says why
 *   answers the question they actually have.
 * · EVERY REASON IS A WORD. Not a tint, not an opacity, not a missing box.
 *   `reason` being non-null is the only thing that disables a row, so an
 *   unavailable row with no printed reason is unreachable by construction.
 * · The plate is a THIRD channel agreeing with the other two, never a
 *   replacement: choosable rows sit on the warm ground, unavailable ones on
 *   bare canvas, and a reader who cannot see either loses nothing.
 * · The empty ring appears only where a row can be chosen. Beside "No longer a
 *   mutual friend" it would read as "not chosen yet".
 * · NOTHING SAYS "BLOCKED". A block severs both follow edges permanently, so a
 *   blocked pair genuinely stop being mutual friends and land in `not_mutual` —
 *   which is what lets this screen be honest without disclosing that a block
 *   exists. There is no third reason and there must not be.
 * · The send button counts, and at zero it is a state rather than arithmetic:
 *   never "Send 0 invitations".
 */
const ROWS: { userId: string; name: string; selected: boolean; reason: InviteIneligibility }[] = [
  { userId: 'a', name: 'Alexandria Rivera', selected: true, reason: null },
  { userId: 'b', name: 'Christopher Montgomery', selected: false, reason: 'already_member' },
  { userId: 'c', name: 'Marisol Whitfield', selected: false, reason: 'invite_pending' },
  { userId: 'd', name: 'Jonah Okonkwo', selected: false, reason: null },
  { userId: 'e', name: 'Theo Barrington', selected: false, reason: 'not_mutual' },
  { userId: 'f', name: 'Rosa Villanueva', selected: false, reason: 'group_full' },
];

export default function DevGr08() {
  const chosen = ROWS.filter((row) => row.selected).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {PICKER.title}
        </Text>
        <Text variant="note" className="mt-2">
          {pickerSubtitle(chosen)}
        </Text>

        <View className="mt-6">
          {ROWS.map((row) => (
            <PickerRow
              key={row.userId}
              name={row.name}
              selected={row.selected}
              reason={row.reason}
              onToggle={() => undefined}
            />
          ))}
        </View>

        <Text variant="note" className="mt-3">
          {PICKER.body}
        </Text>

        <Button
          title={sendInvitationsLabel(chosen)}
          variant="primary"
          onPress={() => undefined}
          accessibilityLabel={sendInvitationsLabel(chosen)}
          className="mt-8"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
