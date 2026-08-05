import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import { Text } from '@/components/ui/text';
import type { ChatMessage } from '@/features/stylist/use-chat';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Stylist fixture — `cinch://dev-stylist`.
 *
 * Mirrors src/app/stylist.tsx (header, message thread, input bar) against a
 * hardcoded conversation lifted from the handoff's Frame 06, so the screen
 * can be judged signed-out. The real screen's data comes from
 * useWardrobe/useStyleProfile/useChat, which all hit Supabase — this fixture
 * has no session-dependent hooks, and instead renders the same MessageBubble
 * component the real screen uses against a fixed FIXTURE_MESSAGES array.
 *
 * Dev-only, like dev-plate and dev-closet: __DEV__-gated in the auth gate.
 */
const FIXTURE_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    text: 'Morning. Ask me anything — I only answer with clothes you actually own.',
    outfits: [],
    followUp: null,
  },
  {
    id: 'm2',
    role: 'user',
    text: 'Dinner then drinks tonight. What works with my leather derbies?',
    outfits: [],
    followUp: null,
  },
  {
    id: 'm3',
    role: 'assistant',
    text: "Your slate trousers and the cream fine-knit sit well with the derbies — a quiet palette that reads for both halves of the night. I'd leave the linen shorts out; nothing you own pairs with them for an evening like this.",
    outfits: [],
    followUp: null,
  },
];

/**
 * Same markup as StylistScreen's header in src/app/stylist.tsx, duplicated
 * here rather than imported since the real one isn't exported — keep the two
 * in step by hand if either changes.
 */
function DevStylistHeader() {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3 border-b border-hairline px-gutter pb-3 pt-5 dark:border-hairline-dark">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-light">
        <SymbolView name="sparkles" size={15} tintColor={theme.accent} resizeMode="scaleAspectFit" />
      </View>
      <View>
        <Text variant="plate" trim accessibilityRole="header">
          Stylist
        </Text>
        <Text variant="caption" className="mt-0.5 text-faint dark:text-faint-dark">
          Only your clothes — nothing invented
        </Text>
      </View>
    </View>
  );
}

export default function DevStylistScreen() {
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['bottom']}>
      <DevStylistHeader />

      <ScrollView contentContainerClassName="pb-4" keyboardShouldPersistTaps="handled">
        {FIXTURE_MESSAGES.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            resolveImage={() => undefined}
            onPressOutfit={() => {}}
          />
        ))}
      </ScrollView>

      <View className="flex-row items-end gap-2 border-t border-hairline px-gutter pb-2 pt-3 dark:border-hairline-dark">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your clothes…"
          placeholderTextColor={theme.muted}
          multiline
          returnKeyType="send"
          blurOnSubmit
          accessibilityLabel="Ask the stylist"
          style={{ maxHeight: 110 }}
          className="flex-1 rounded-full border border-rule bg-surface px-4 py-2.5 text-ink dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
        />
        <Pressable
          onPress={() => setDraft('')}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
          className={`items-center justify-center rounded-full ${
            draft.trim() ? 'bg-ink dark:bg-ink-dark' : 'bg-tray dark:bg-tray-dark'
          }`}>
          <SymbolView
            name="arrow.up"
            size={17}
            tintColor={draft.trim() ? theme.canvas : theme.muted}
            resizeMode="scaleAspectFit"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
