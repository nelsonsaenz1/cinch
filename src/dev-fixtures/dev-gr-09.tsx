import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AcceptRefusedNotice,
  GroupGoneNotice,
  GroupsOfflineState,
} from '@/components/circles';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { INVITED_ROOM } from '@/dev-fixtures/gr-fixture-data';
import { GROUPS_TITLE, PENDING } from '@/features/circles/copy';

/**
 * GR-09 · redesign 27 — the three states nobody designs for, side by side.
 *
 * THE ONE THAT MATTERS IS THE FIRST, AND IT IS A PRIVACY REFUSAL DRAWN AS A
 * SCREEN.
 *
 * `GroupGoneNotice` says the group is gone. It does NOT say who deleted it, and
 * it does not say whether it was deleted at all — because the client cannot
 * know and must never be able to. `useCircle` answers `null` for a deleted
 * group and for a membership that ended, identically and on purpose: a client
 * that could tell those apart would be telling somebody they had been REMOVED,
 * which is the one fact the removal promise spends a whole sentence refusing to
 * disclose ("They are told they were removed, not who removed them" — and the
 * schema keeps even that much out of reach, since there is no remover field on
 * `circle_members` at all).
 *
 * The artifact's own frame for this state carries a stronger headline. It is
 * not transcribed, and that is deliberate rather than an omission: the shipped
 * sentence is the one the data can stand behind.
 *
 * THE OTHER TWO
 *
 * · `AcceptRefusedNotice` — the seat that was gone by the time the invitation
 *   was answered. Reachable only because `enforce_circle_size` guards UPDATE as
 *   well as INSERT. It names nobody (who took the seat is a roster fact and
 *   this reader is not on the roster), it does not blame the reader for having
 *   waited, and it does not throw the invitation away, because the schema does
 *   not. Blush, because the offer still stands.
 * · `GroupsOfflineState` — a failed read, never dressed as an empty one.
 *   "Nothing changed" is a claim about the WRITE side and is the sentence an
 *   empty state would have got wrong. `ErrorState` carries
 *   `accessibilityRole="alert"`, so a failure that arrives after a wait is
 *   announced rather than merely findable by swiping to it, and `onRetry` is
 *   required so the state is never a dead end.
 */
export default function DevGr09() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-12 pt-3">
        <View className="px-gutter">
          <Text variant="display" trim accessibilityRole="header">
            {INVITED_ROOM}
          </Text>
          <GroupGoneNotice onBack={() => undefined} />

          <SectionHeader title={PENDING.heading} className="mt-10" />
          <AcceptRefusedNotice />

          <SectionHeader title={GROUPS_TITLE} className="mt-10" />
        </View>
        <GroupsOfflineState onRetry={() => undefined} />
      </ScrollView>
    </SafeAreaView>
  );
}
