import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedRows, UnblockSheet } from '@/components/social/BlockedList';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { G6_BLOCKED, G6_NOW } from '@/features/social-graph/w3-g6-fixtures';

/**
 * SF-02 (= BL-02) — the unblock confirmation, over an untouched list.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · AUDIT 99, drawn exactly. The sheet arrives BEFORE anything changes; the
 *   consequence is three REGULAR paragraphs, never one bolded block; and both
 *   facts the audit names are stated — they can find you again, and the votes
 *   they retracted are not restored. The second is literally true rather than
 *   rhetorically: `20260809160000_block_retracts_votes` deletes those rows and
 *   `useUnblockUser` only deletes the block, so nothing brings them back.
 * · The second action is "Keep them blocked" — the OUTCOME, not "Cancel".
 * · Nothing on this sheet is oxblood. The confirming action is ink, because
 *   spending the accent on a restoration would misdescribe it.
 * · The person's name appears in the question and in all three paragraphs, so
 *   nobody unblocks the wrong person out of a list of three.
 *
 * PRONOUNS: the atlas writes "He will be able to…". Cinch holds a display name
 * and a handle and has never held a pronoun — there is no column anywhere in
 * `supabase/migrations` that could supply one — so every sentence is they/them
 * and the NAME does the identifying, which is the property the audit actually
 * asked for.
 */
export default function DevW3G6SF02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Blocked people" />
      <ScrollView contentContainerClassName="px-gutter pb-10 pt-4">
        <View>
          <BlockedRows
            rows={G6_BLOCKED}
            now={G6_NOW}
            onUnblock={() => undefined}
            onRetry={() => undefined}
          />
        </View>
      </ScrollView>
      <UnblockSheet
        target={{ userId: 'u-daniel', name: 'Daniel Okafor' }}
        onConfirm={() => undefined}
        onKeep={() => undefined}
      />
    </SafeAreaView>
  );
}
