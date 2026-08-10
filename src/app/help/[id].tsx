import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { articleById, groupTitle, relatedArticles } from '@/features/help/articles';
import { useTheme } from '@/theme/tokens';

/**
 * HS-02 — an answer, set as an editor's notes page.
 *
 * Eyebrow, serif question, three short paragraphs, the two adjacent worries,
 * and a two-word feedback row whose negative branch does something useful.
 *
 * Every paragraph on this page is data, from `features/help/articles.ts`, and
 * every one of them carries a `file:line` in that file's comments. Three of the
 * atlas's own drawn sentences were false and are rewritten there — the wear
 * counts a friend can see, what search can find, and whether a piece can be
 * hidden. This screen renders; it does not assert.
 */
export default function HelpArticleScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = articleById(id);

  /**
   * "Yes" acknowledges and nothing more.
   *
   * There is no table behind this — no `help_feedback`, no analytics event
   * defined for it — so the row must not behave as though the answer went
   * somewhere. It swaps for one quiet line. A thumbs-up that silently records
   * nothing is theatre; a thumbs-up that claims to record something is a lie.
   */
  const [answered, setAnswered] = useState(false);

  if (!article) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <View className="flex-row items-center px-gutter pb-1 pt-5">
          <BackButton onPress={() => router.back()} />
        </View>
        <View className="flex-1 items-center justify-center px-gutter">
          <Text variant="body" style={{ color: theme.muted }} className="text-center">
            That question is not in Help any more.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const related = relatedArticles(article);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => router.back()} />
        <Text variant="colophon" className="ml-3">
          Help
        </Text>
      </View>

      {/* 26px of margin rather than the 20 gutter — the atlas sets this page
          narrower than the index on purpose: a reading measure, not a list. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 56, paddingTop: 12 }}>
        {/* The space between eyebrow and question is the EYEBROW's bottom
            margin, never the serif's top: a `trim`'d serif's cap-collapse eats
            its own `mt-*` (editorial-frame.tsx:103-108). */}
        <Text variant="eyebrow" className="mb-2">
          {groupTitle(article.group)}
        </Text>

        {/* NOT `trim`. `trim` is documented for single-line display text, and a
            question wraps to two or three lines here — collapsing the line box
            of a multi-line setting pulls the first line into the eyebrow and
            leaves the last one hanging. The serif's natural box is the measure
            this page wants anyway. */}
        <Text variant="title" accessibilityRole="header">
          {article.question}
        </Text>

        <View className="mt-4" style={{ gap: 16 }}>
          {article.body.map((paragraph, i) => (
            <Text key={i} variant="body">
              {paragraph}
            </Text>
          ))}
        </View>

        {/* The answer that IS an action rather than a description — "How do I
            cancel?" ends at Apple's subscriptions screen, the same destination
            profile.tsx's Manage row opens. Only Membership has one. */}
        {article.action ? (
          <Button
            title={article.action.label}
            variant="ink"
            className="mt-6 self-start"
            onPress={() => void Linking.openURL(article.action!.url)}
            accessibilityHint="Opens your App Store subscriptions"
          />
        ) : null}

        {related.length > 0 ? (
          <View className="mt-7 rounded-lg bg-tray p-4">
            <Text variant="note">Related</Text>
            <View className="mt-1.5" style={{ gap: 8 }}>
              {related.map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="link"
                  accessibilityLabel={r.question}
                  onPress={() => router.push(`/help/${r.id}`)}
                  hitSlop={6}
                  style={{ minHeight: 28, justifyContent: 'center' }}
                  className="active:opacity-60">
                  {/* The page's one oxblood. Inline, because `body` already
                      carries `text-ink`. */}
                  <Text variant="body" style={{ color: theme.accent }}>
                    {r.question}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View className="mt-7 border-t border-rule pt-5">
          {answered ? (
            <Text variant="body" style={{ color: theme.muted }}>
              Good. That is what it is here for.
            </Text>
          ) : (
            <>
              <Text variant="body">Did this answer it?</Text>
              <View className="mt-3 flex-row" style={{ gap: 10 }}>
                <Button
                  title="Yes"
                  variant="secondary"
                  className="flex-1"
                  onPress={() => setAnswered(true)}
                />
                <Button
                  title="Not quite"
                  variant="secondary"
                  className="flex-1"
                  onPress={() =>
                    router.push({ pathname: '/help/write', params: { articleId: article.id } })
                  }
                />
              </View>
              <Text variant="noteSmall" className="mt-3">
                Not quite opens a note to us with this question attached.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
