import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import { articlesInGroup, HELP_GROUPS } from '@/features/help/articles';

/**
 * HP-01 — the help index.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · EVERY TITLE IS A QUESTION IN THE READER'S OWN WORDS, and is allowed to
 *   wrap to two lines — a truncated question is not a question. `SettingsRow`
 *   does not clamp its label, so this holds at every type size.
 * · GROUP HEADINGS ARE THE SAME 11pt uppercase labels Profile uses, so the two
 *   pages read as one system.
 * · The commerce article is titled honestly rather than defensively, and
 *   AUDIT 100 sweeps this page: nowhere in the index or its articles does a
 *   shopping absolute like "no shop" appear.
 * · FOUR GROUPS, NOT THREE. The atlas draws three and does not draw Membership
 *   — but an index frame listing eight rows is a drawing of eight rows, not an
 *   instruction to delete four accurate answers, and MB-08 routes a member
 *   toward cancellation that "How do I cancel?" is the answer to. Two of the
 *   atlas's own titles are still unwritten; the group-6 record names them.
 *
 * The rows are rendered from `HELP_ARTICLES` itself, so this frame cannot
 * drift from the shipping index — it IS the shipping index's data.
 */
export default function DevW3G6HP01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="title" trim accessibilityRole="header">
          Help
        </Text>

        {HELP_GROUPS.map((group) => (
          <View key={group.id} className="mt-6">
            <SectionHeader title={group.title} className="mb-2.5" />
            <Card padding="none">
              {articlesInGroup(group.id).map((article, i) => (
                <View key={article.id}>
                  {i > 0 ? <Rule tone="hairline" /> : null}
                  <SettingsRow label={article.question} onPress={() => undefined} />
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Text variant="note" className="mt-8">
          Cannot find it? Write to us, and two people read it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
