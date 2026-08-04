import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import { SUGGESTED_PROMPTS } from '@/features/stylist/intent';
import { useChat } from '@/features/stylist/use-chat';
import { canGenerate, useStyleProfile, useWardrobe } from '@/features/styling/queries';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Stylist — conversational styling.
 *
 * The model never receives the closet. Each question is parsed on-device into a
 * styling context, the beam search assembles real outfits for it, and only a
 * shortlist plus a digest goes up. That is what stops the stylist recommending
 * a coat the user does not own — the failure mode that would make the whole
 * feature untrustworthy.
 */
export default function StylistScreen() {
  const router = useRouter();
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');

  const wardrobe = useWardrobe();
  const profileQuery = useStyleProfile();
  const { context } = useStyleContext();

  const items = wardrobe.data ?? [];
  const profile = profileQuery.data ?? {
    weights: DEFAULT_WEIGHTS,
    affinities: EMPTY_AFFINITIES,
    feedbackCount: 0,
    summary: [],
  };

  const { messages, ask, isSending } = useChat({ wardrobe: items, context, profile });

  const { resolve } = useSignedUrls(
    messages.flatMap((m) =>
      m.outfits.flatMap((o) => o.items.flatMap((g) => [g.cutoutPath, g.thumbPath])),
    ),
  );

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || isSending) return;
      setDraft('');
      void ask(text);
      // Let the new bubble mount before scrolling to it.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    },
    [ask, isSending],
  );

  if (!wardrobe.isLoading && !canGenerate(items)) {
    return (
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        <View className="px-gutter pb-2 pt-2">
          <Text variant="display">Stylist</Text>
        </View>
        <EmptyState
          symbol="bubble.left.and.bubble.right"
          title="Ask for anything"
          body="Dinner at 7 and drinks after? A trip to pack for? Add about ten pieces first — the stylist only ever answers with clothes you actually own."
          actionTitle="Add clothes"
          onAction={() => router.push('/capture')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        <View className="px-gutter pb-3 pt-2">
          <Text variant="display">Stylist</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="pb-4"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 ? (
            <View className="px-gutter pt-4">
              <Text variant="body" className="text-muted dark:text-muted-dark">
                Ask about anything you have on. The stylist answers using only the
                clothes in your closet — and will tell you when you do not own the
                right thing.
              </Text>

              <View className="mt-6 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => submit(prompt)}
                    accessibilityRole="button"
                    style={{ minHeight: MIN_TAP_TARGET }}
                    className="justify-center rounded-card border border-hairline px-4 py-3 active:opacity-60 dark:border-hairline-dark">
                    <Text variant="body">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                resolveImage={resolve}
                onPressOutfit={() => router.push('/')}
              />
            ))
          )}
        </ScrollView>

        {messages.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 px-gutter pb-2">
            <Chip label="Something warmer" onPress={() => submit('Something warmer')} />
            <Chip label="Dressier" onPress={() => submit('A bit dressier')} />
            <Chip label="More casual" onPress={() => submit('More casual')} />
          </View>
        ) : null}

        <View className="flex-row items-end gap-2 border-t border-hairline px-gutter pb-2 pt-3 dark:border-hairline-dark">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit(draft)}
            placeholder="What are you doing today?"
            placeholderTextColor={theme.muted}
            multiline
            returnKeyType="send"
            blurOnSubmit
            accessibilityLabel="Ask the stylist"
            style={{ maxHeight: 110 }}
            className="flex-1 rounded-card border border-hairline px-3.5 py-2.5 text-ink dark:border-hairline-dark dark:text-ink-dark"
          />
          <Pressable
            onPress={() => submit(draft)}
            disabled={!draft.trim() || isSending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={{ minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET }}
            className={`items-center justify-center rounded-full ${
              draft.trim() && !isSending
                ? 'bg-accent dark:bg-accent-dark'
                : 'bg-tray dark:bg-tray-dark'
            }`}>
            <SymbolView
              name="arrow.up"
              size={17}
              tintColor={draft.trim() && !isSending ? theme.canvas : theme.muted}
              resizeMode="scaleAspectFit"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
