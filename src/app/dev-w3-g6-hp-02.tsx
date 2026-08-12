import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { articleById } from '@/features/help/articles';
import { SUPPORT_ADDRESS } from '@/components/help/contact-card';

/**
 * HP-02 — an article, and writing to a person.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · CORRECTION 33 — the commerce answer describes the mechanism as it works:
 *   the gap comes out of your own closet before any shop is consulted, up to
 *   three merchants may show, "Paid link" belongs ONLY to a confirmed joined
 *   merchant and every other row just says it opens the shop. The earlier
 *   blanket "those rows are marked Paid link" was untrue for direct rows, and
 *   is the same defect correction 19 removed one level up.
 * · The commission sentence names all three things commission does not touch:
 *   the gap, the match, and the order.
 * · CORRECTION 34 — the support card drops the one-day promise. Nothing behind
 *   it could keep one: `support-mail` posts to a shared inbox and there is no
 *   queue, rota or SLA anywhere in that function. What is left is true — people
 *   read it, and there is no ticket number.
 * · THE SUPPORT CARD SITS AT THE END OF THE ARTICLE rather than pinned. A help
 *   page has one job — the answer — and a permanently docked card was taking a
 *   third of the screen from it and cutting the friend-opt-in disclosure off
 *   the bottom.
 * · The full disclosure of what a note carries lives in the composer, one tap
 *   on, where the note is actually written: `diagnosticLines()` names each
 *   field it will send, and `DIAGNOSTICS_FOOTNOTE` states the one reassurance
 *   that is true — no closet content is read.
 * · Body 17pt regular, headings Medium, no imagery, no marketing voice.
 */
export default function DevW3G6HP02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const article = articleById('buying-suggestions');
  if (!article) return null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <Text variant="plate" trim accessibilityRole="header">
          {article.question}
        </Text>

        {article.body.map((paragraph) => (
          <Text key={paragraph} variant="body" className="mt-5">
            {paragraph}
          </Text>
        ))}

        <Card padding="lg" className="mt-8">
          <Text variant="body">Still stuck?</Text>
          <Text variant="note" className="mt-1.5">
            {`Write to ${SUPPORT_ADDRESS}. Two people read it, and there is no ticket number.`}
          </Text>
          <View className="mt-3.5 self-start">
            <Button title="Write to us" variant="ink" onPress={() => undefined} className="px-4" />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
