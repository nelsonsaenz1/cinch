import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HelpArticleList } from '@/components/help/article-row';
import { HelpContactCard, SUPPORT_ADDRESS } from '@/components/help/contact-card';
import { BackButton } from '@/components/ui/screen-header';
import { SearchField } from '@/components/ui/search-field';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { HELP_GROUPS, articlesInGroup } from '@/features/help/articles';
import { EMPTY_HEADLINE, alsoAsk, emptyAnswerFor, searchHelp } from '@/features/help/search';
import { useTheme } from '@/theme/tokens';

/**
 * Help — HS-01, and HS-03 when the search finds nothing.
 *
 * The two are one screen because they are one screen: HS-03 is what HS-01
 * looks like with a query in the field and no rows under it. Splitting them
 * would mean a route that cannot be reached except through the other one.
 *
 * The old Support row on the profile opened a browser. Nothing here leaves the
 * app — the atlas's first rule — which also means the removal of that external
 * link is the integrator's move, not this file's; `src/app/profile.tsx` is not
 * Unit H's to edit.
 */
export default function HelpScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo(() => (searching ? searchHelp(trimmed) : []), [searching, trimmed]);
  const nothingFound = searching && results.length === 0;

  const openArticle = (id: string) => router.push(`/help/${id}`);
  const openComposer = (params?: { query?: string }) =>
    router.push({ pathname: '/help/write', params: params?.query ? { query: params.query } : {} });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* `pt-5` clears the sheet grabber, the clearance profile.tsx and
          privacy.tsx both use — Help is pushed from the profile sheet and
          presents in the same dialect. No colophon beside the chevron: the
          serif "Help" below is this page's title, and printing the word twice
          in two sizes is how a header stops meaning anything. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24 pt-4" keyboardDismissMode="on-drag">
        <Text variant="title" trim accessibilityRole="header">
          Help
        </Text>
        {/* `mt-*` on the SIBLING of a trimmed serif, never on the trimmed
            element itself — the cap-trim's negative margins eat its own
            margin-top. See editorial-frame.tsx:103-108. */}
        <Text variant="note" className="mt-3">
          The questions people actually ask, answered here rather than on a
          website. If yours is not below, write to us.
        </Text>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search help"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-4"
        />

        {nothingFound ? (
          <NothingFound query={trimmed} onSelect={openArticle} onWrite={() => openComposer({ query: trimmed })} />
        ) : searching ? (
          <View className="mt-5">
            <HelpArticleList questions={results} onSelect={openArticle} />
          </View>
        ) : (
          <>
            {HELP_GROUPS.map((group) => (
              <View key={group.id} className="mt-6">
                <SectionHeader title={group.title} className="mb-1" />
                <HelpArticleList questions={articlesInGroup(group.id)} onSelect={openArticle} />
              </View>
            ))}

            <View className="mt-8">
              <HelpContactCard
                title="Still stuck?"
                body={`Write to ${SUPPORT_ADDRESS}. A person reads it, usually inside a day.`}
                onPress={() => openComposer()}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * HS-03. The headline is fixed; the sentence under it is not.
 *
 * The atlas answers "apple watch" specifically, and that specificity is the
 * best thing on the screen — so `emptyAnswerFor` keeps it for the handful of
 * things Cinch genuinely has not built and falls back to one honest sentence
 * for everything else. Neither branch apologises, and neither promises a date.
 */
function NothingFound({
  query,
  onSelect,
  onWrite,
}: {
  query: string;
  onSelect: (id: string) => void;
  onWrite: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <View className="mt-9 px-2.5">
        <Text variant="plate" trim accessibilityRole="header" className="text-center">
          {EMPTY_HEADLINE}
        </Text>
        {/* Inline colour, never a second `text-*` class: `body` already
            carries `text-ink`, and NativeWind resolves two colour utilities on
            one element by key order rather than by intent (text.tsx:63-68). */}
        <Text variant="body" className="mt-4 text-center" style={{ color: theme.muted }}>
          {emptyAnswerFor(query)}
        </Text>
      </View>

      <SectionHeader title="People also ask" className="mb-1 mt-9" />
      <HelpArticleList questions={alsoAsk(query)} onSelect={onSelect} />

      <View className="mt-7">
        <HelpContactCard
          title="Ask us instead"
          body="Your search is carried into the note, so you do not have to type it twice."
          onPress={onWrite}
        />
      </View>
    </View>
  );
}
