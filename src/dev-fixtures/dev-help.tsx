import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiagnosticsPanel } from '@/components/help/diagnostics-panel';
import { HelpSentView } from '@/components/help/sent-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow } from '@/components/ui/settings-row';
import { Text } from '@/components/ui/text';
import { HELP_ARTICLES } from '@/features/help/articles';
import {
  appVersionLabel,
  collectDiagnostics,
  deviceLabel,
  osLabel,
} from '@/features/help/diagnostics';
import { EMPTY_HEADLINE, alsoAsk, emptyAnswerFor, searchHelp } from '@/features/help/search';

/**
 * DEV ONLY — the Help atlas's states at `cinch://dev-help`.
 *
 * "Any state without a dev route is a state nobody has looked at." Three of
 * this feature's states cannot be reached by tapping through the app:
 *
 *   * HS-03's empty answers, which depend on the exact query typed;
 *   * HS-05 in both branches, which depends on what `support-mail` returns —
 *     and that function is another unit's, so this is the only way to see the
 *     screen before it exists;
 *   * the real diagnostics values, which is also this wave's one genuine
 *     unknown: `expo-device` is compiled into the binary (`ios/Podfile.lock`)
 *     but had zero callers in `src/` before this feature, so what
 *     `Device.modelName` actually returns on this device is a thing to look at
 *     rather than assume.
 */

/** The five things Cinch has not built, plus one query that resembles nothing. */
const EMPTY_QUERIES: readonly string[] = [
  'apple watch',
  'ipad',
  'android',
  'web app',
  'widget',
  'zzzz nothing like this',
];

export default function DevHelpScreen() {
  const router = useRouter();
  const [copySent, setCopySent] = useState<string | null | 'closed'>('closed');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  if (copySent !== 'closed') {
    return <HelpSentView copySentTo={copySent} onBack={() => setCopySent('closed')} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-2">
        <SectionHeader title="The live screens" className="mb-2.5" />
        <Card padding="none">
          <SettingsRow label="HS-01 · the index" onPress={() => router.push('/help')} />
          <SettingsRow label="HS-04 · write to us" onPress={() => router.push('/help/write')} />
          <SettingsRow
            label="HS-04 · started from a search"
            onPress={() =>
              router.push({ pathname: '/help/write', params: { query: 'apple watch' } })
            }
          />
          <SettingsRow
            label="HS-04 · started from “Not quite”"
            onPress={() =>
              router.push({ pathname: '/help/write', params: { articleId: 'who-sees-my-closet' } })
            }
          />
        </Card>

        <SectionHeader title="HS-02 · every article" className="mb-2.5 mt-8" />
        <Card padding="none">
          {HELP_ARTICLES.map((a) => (
            <SettingsRow key={a.id} label={a.question} onPress={() => router.push(`/help/${a.id}`)} />
          ))}
        </Card>

        <SectionHeader title="HS-05 · both branches" className="mb-2.5 mt-8" />
        <View className="flex-row" style={{ gap: 10 }}>
          <Button
            title="With a copy"
            variant="secondary"
            className="flex-1"
            onPress={() => setCopySent('you@example.com')}
          />
          <Button
            title="Without one"
            variant="secondary"
            className="flex-1"
            onPress={() => setCopySent(null)}
          />
        </View>

        <SectionHeader title="What is really attached" className="mb-2.5 mt-8" />
        <DiagnosticsPanel diagnostics={collectDiagnostics('sim')} attachmentName="screenshot.jpg" />
        <Card padding="md" className="mt-3">
          <View style={{ gap: 6 }}>
            <Text variant="note">appVersionLabel(): {appVersionLabel()}</Text>
            <Text variant="note">deviceLabel(): {deviceLabel() ?? '(null)'}</Text>
            <Text variant="note">osLabel(): {osLabel() ?? '(null)'}</Text>
          </View>
        </Card>

        <SectionHeader title="HS-03 · the empty answers" className="mb-2.5 mt-8" />
        <Card padding="md">
          <View style={{ gap: 16 }}>
            {EMPTY_QUERIES.map((q) => (
              <View key={q}>
                <Text variant="caption">
                  “{q}” — {searchHelp(q).length} results
                </Text>
                <Text variant="body" className="mt-1">
                  {EMPTY_HEADLINE}
                </Text>
                <Text variant="note" className="mt-1">
                  {emptyAnswerFor(q)}
                </Text>
                <Text variant="noteSmall" className="mt-1.5">
                  Also asks: {alsoAsk(q).map((a) => a.question).join(' · ')}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionHeader title="Search, spot checks" className="mb-2.5 mt-8" />
        <Card padding="md">
          <View style={{ gap: 10 }}>
            {['photo', 'borrow', 'cancel', 'hide a piece', 'wear count', 'apple'].map((q) => (
              <Text key={q} variant="note">
                “{q}” → {searchHelp(q).map((a) => a.id).join(', ') || '(nothing)'}
              </Text>
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
