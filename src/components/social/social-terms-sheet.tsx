import { SymbolView } from 'expo-symbols';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The community terms moment — Apple Guideline 1.2 (user-generated content).
 *
 * Raised the first time someone reaches a social surface: creating an event,
 * joining one, sharing a look, voting, commenting, asking to borrow. Guideline
 * 1.2 requires an agreement accepted *before* posting, and requires it to say
 * in so many words that there is no tolerance for objectionable content or
 * abusive users — so the second line below is not decoration, it is the clause
 * Apple is looking for.
 *
 * Deliberately shaped like ConsentSheet (the 5.1.2(i) AI disclosure): the
 * plain-list-then-two-buttons form is already the app's idiom for "here is
 * what you are agreeing to, before it happens". Accepting writes a version and
 * timestamp to profiles; the database gate in migration 20260808101000 is what
 * actually enforces it.
 *
 * Voice: `docs/stylist-voice.md` §3 — no exclamation marks, no jokes in a
 * consequential moment, and the promise stated as a fact rather than a
 * reassurance.
 */
const TERMS = [
  {
    symbol: 'hand.raised',
    line: 'No harassment, hate, or content that targets someone. We remove it and we remove the accounts behind it.',
  },
  {
    symbol: 'flag',
    line: 'Report anything that crosses the line. Reports are reviewed within 24 hours.',
  },
  {
    symbol: 'person.slash',
    line: 'Block anyone, at any time. They are not told, and it takes effect immediately.',
  },
  {
    symbol: 'lock',
    line: 'What you share stays with the friends and events you share it with.',
  },
] as const;

export function SocialTermsSheet({
  visible,
  onAccept,
  onDecline,
  busy,
  termsUrl,
}: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
  termsUrl?: string;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-canvas">
        <ScrollView contentContainerClassName="px-8 pb-8 pt-10">
          <Text variant="title" trim>
            Before you post
          </Text>
          <Text variant="body" className="mt-3 text-muted">
            Cinch&apos;s social side is small by design — friends you invited, events you joined.
            Four rules hold it together.
          </Text>

          <View className="mt-7 gap-4">
            {TERMS.map(({ symbol, line }) => (
              <View key={line} className="flex-row items-start gap-3">
                <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-accent-light">
                  <SymbolView
                    name={symbol}
                    size={14}
                    tintColor={theme.accent}
                    resizeMode="scaleAspectFit"
                  />
                </View>
                <Text variant="callout" className="flex-1">
                  {line}
                </Text>
              </View>
            ))}
          </View>

          {/* The zero-tolerance clause, stated plainly. Guideline 1.2 asks for
              this sentence to exist; burying it in a linked PDF is what gets
              apps rejected. */}
          <Text variant="body" className="mt-7 text-muted">
            There is no tolerance for objectionable content or abusive users. Accounts that post it
            lose access to everything social in Cinch — their closet stays theirs.
          </Text>

          <View className="mt-8 gap-2">
            {/* The shared `Button`'s `ink` variant IS this control — a filled
                workhorse action. Hand-rolled here at plate 20 and 56 tall,
                which reference board A puts at `md` 12 and 52, with the label
                at `body` 17 rather than `callout` 16. */}
            <Button
              title="Agree and continue"
              variant="ink"
              loading={busy}
              onPress={onAccept}
            />
            <Button title="Not now" variant="ghost" onPress={onDecline} />
          </View>

          {termsUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(termsUrl)}
              className="mt-3">
              <Text variant="label" className="text-center text-muted">
                Read the full terms
              </Text>
            </Pressable>
          ) : null}

          {/* Declining costs nothing that isn't social: the closet, the daily
              outfit and the stylist all keep working. Saying so here is what
              makes "Not now" a real option rather than a dead end. */}
          <Text variant="note" className="mt-3 text-center text-muted">
            Your closet and your daily outfits work either way.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
