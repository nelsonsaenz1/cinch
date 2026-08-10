import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * HS-05 — sent.
 *
 * ── The one sentence this screen is not allowed to guess ──────────────────
 *
 * The atlas draws "A copy is in your mail, sent to sophie@mail.com" as a fact.
 * It is a claim about what the `support-mail` Edge Function did, and the agreed
 * response is `{ ok: true }`, which says nothing about a copy. So the sentence
 * is printed only when the function returns the address it copied
 * (`copySentTo`), and the escalation footnote — "replying to that mail bumps it
 * up the pile" — goes with it, because replying to a mail nobody received is
 * not a route.
 *
 * Without the copy, the confirmation still says the two things it can back: it
 * arrived, and roughly when an answer will. The weekend case is named because
 * "usually within a day" quietly becomes a broken promise every Saturday.
 *
 * A component rather than a branch inside the route, so `dev-help.tsx` can show
 * both halves of that decision without a working function behind it.
 */
export function HelpSentView({
  copySentTo,
  onBack,
}: {
  copySentTo: string | null;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <View
          className="items-center justify-center rounded-full bg-ink"
          style={{ width: 56, height: 56 }}>
          <SymbolView
            name="checkmark"
            size={22}
            tintColor={theme.canvas}
            weight="semibold"
            resizeMode="scaleAspectFit"
          />
        </View>

        {/* Not `trim`: the headline is centred over a paragraph rather than
            pinned to a rule, and collapsing its line box would pull it onto
            the disc above. */}
        <Text variant="title" accessibilityRole="header" className="mt-6 text-center">
          That is with us
        </Text>

        <Text variant="body" className="mt-3 text-center" style={{ color: theme.muted }}>
          {copySentTo
            ? `A copy is in your mail, sent to ${copySentTo}. We answer in the order they arrive, usually inside a day — two if it lands on a weekend.`
            : 'We answer in the order they arrive, usually inside a day — two if it lands on a weekend.'}
        </Text>

        <Button
          title="Back to Help"
          variant="secondary"
          onPress={onBack}
          className="mt-8 self-stretch"
        />
      </View>

      {copySentTo ? (
        <Text variant="noteSmall" className="px-8 pb-8 text-center">
          If it is urgent, replying to that mail bumps it up the pile.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
