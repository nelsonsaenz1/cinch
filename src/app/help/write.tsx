import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiagnosticsPanel } from '@/components/help/diagnostics-panel';
import { HelpSentView } from '@/components/help/sent-view';
import { SUPPORT_ADDRESS } from '@/components/help/contact-card';
import { Chip } from '@/components/ui/chip';
import { KeyboardAvoidingScreen, KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { articleById } from '@/features/help/articles';
import { collectDiagnostics } from '@/features/help/diagnostics';
import {
  MAX_ATTACHMENT_BYTES,
  SUPPORT_TOPICS,
  SupportMailError,
  sendSupportMail,
  type SupportAttachment,
  type SupportTopic,
} from '@/features/help/support-mail';
import { useMyProfile } from '@/features/profile/queries';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * HS-04 (write to us) and HS-05 (sent), one route.
 *
 * They are one route because the confirmation is what this screen becomes, not
 * a place it sends you: HS-05's only way onward is "Back to Help", so a second
 * route would exist solely to be popped, and a back-swipe on it would land the
 * reader in a composer holding a note they have already sent.
 *
 * The composer never leaves the app. Mail, not a ticket system — no ticket
 * number is shown because none is issued.
 */
export default function WriteToUsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ query?: string; articleId?: string }>();

  const profile = useMyProfile();
  const handle = profile.data?.username ?? null;

  const carriedQuery = typeof params.query === 'string' ? params.query.trim() : '';
  const carriedArticle = articleById(
    typeof params.articleId === 'string' ? params.articleId : null,
  );

  const [topic, setTopic] = useState<SupportTopic>(carriedArticle ? 'question' : 'broken');
  // The search that found nothing is a real first sentence, so it is put in the
  // field rather than only in the payload — "carried into the note, so you do
  // not have to type it twice" is HS-03's promise, and a value the reader can
  // see and edit is the only version of that promise they can check.
  const [body, setBody] = useState(carriedQuery ? `${carriedQuery}\n\n` : '');
  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<{ copySentTo: string | null } | null>(null);

  const diagnostics = useMemo(() => collectDiagnostics(handle), [handle]);

  /** Send stays inert until the body has text. The atlas says so in as many words. */
  const canSend = body.trim().length > 0 && !sending;

  const pickScreenshot = async () => {
    setAttachError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // 0.7 is the app's own thumbnail quality (lib/image.ts) and keeps a
      // screenshot well inside the byte ceiling below.
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return; // Dismissal is not an error — avatar.ts:54.

    const asset = result.assets[0];
    if (!asset?.base64) {
      setAttachError('That image could not be read. Another one will work.');
      return;
    }
    if (asset.base64.length > MAX_ATTACHMENT_BYTES) {
      setAttachError('That one is too large to send. A screenshot rather than a photograph fits.');
      return;
    }
    setAttachment({
      filename: asset.fileName ?? 'screenshot.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
      base64: asset.base64,
    });
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setFailure(null);
    try {
      const result = await sendSupportMail({
        topic,
        body: body.trim(),
        ...(carriedQuery ? { query: carriedQuery } : null),
        ...(carriedArticle ? { articleId: carriedArticle.id } : null),
        diagnostics,
        ...(attachment ? { attachment } : null),
      });
      setSent({ copySentTo: result.copySentTo });
    } catch (error) {
      // The server's own sentence, verbatim, whenever it sent one — above all
      // for a throttle, which is the one refusal with a reason behind it.
      setFailure(
        error instanceof SupportMailError ? error.message : 'The note did not go through.',
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <HelpSentView copySentTo={sent.copySentTo} onBack={() => router.dismissTo('/help')} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Cancel / Send. `label` at both ends with an inline colour, matching
          profile.tsx's own header action (:255) — and inline rather than a
          `text-*` class, because `label` already carries `text-muted`. */}
      <View className="flex-row items-center justify-between px-gutter pb-1 pt-5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" style={{ color: theme.muted }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          onPress={() => void send()}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className={canSend ? 'active:opacity-60' : ''}>
          {/* Inert Send is `byline`, the app's nearest token to the atlas's
              #C4C0B6, and WCAG exempts a disabled control from the contrast
              floor. No explanatory line under it: the reason is the empty field
              two inches below, and iOS's own Mail says nothing here either. */}
          <Text variant="label" style={{ color: canSend ? theme.accent : theme.byline }}>
            {sending ? 'Sending…' : 'Send'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingScreen style={{ flex: 1 }}>
        <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-16 pt-2">
          <Text variant="title" trim accessibilityRole="header">
            Write to us
          </Text>
          {/* The headcount is the founder's, confirmed 2026-08-10, and it is
              the atlas's original line restored. It was briefly softened to
              "a person reads it" because no code can prove how many people
              open an inbox — the right instinct under this wave's claim-trace
              rule, but the wrong target: the rule exists to stop the app
              asserting things about ITSELF that its own code contradicts, and
              this is a fact about the company that only the founder can
              source. It is now sourced.

              It also has to STAY sourced. If the inbox ever grows a third
              reader or shrinks to one, this sentence is wrong and nothing in
              the build will notice. */}
          <Text variant="note" className="mt-3">
            This goes to {SUPPORT_ADDRESS}. Two of us read that inbox, and you will hear back from
            one of them. There is no ticket system behind it and no number to quote back at you.
          </Text>

          {/* What the note is already carrying, said plainly and early —
              the same principle as the diagnostics panel, applied to context. */}
          {carriedArticle ? (
            <Text variant="note" className="mt-2">
              Attached: “{carriedArticle.question}”
            </Text>
          ) : null}

          <SectionHeader title="What is it about" className="mb-2.5 mt-6" />
          {/* The app's `Chip` at the app's radius, `size="tap"` for 44pt of real
              geometry in a wrapped row. The atlas draws 18px capsules; a
              labelled capsule is the one shape the radius scale rules out
              (tailwind.config.js, `borderRadius.full`). */}
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {SUPPORT_TOPICS.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                size="tap"
                selected={topic === t.id}
                selectedGround="ink"
                onPress={() => setTopic(t.id)}
              />
            ))}
          </View>

          {/* A bordered surface rather than a `Card`: the field IS the card, so
              the `TextInput` has to fill it, and `Card` would put its padding
              between the border and a box the finger then has to find. */}
          <View
            className="mt-5 rounded-lg border border-rule bg-surface p-4"
            style={{ minHeight: 150 }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              placeholder="Tell us what happened, in whatever detail you have. Screenshots help."
              // `muted`, not the atlas's #A29D92. This placeholder is the only
              // instruction on the screen — it tells the reader what to write —
              // so it is text, and text does not go below AA. The contrast pass
              // moves text off `faint` and `byline`; decorative strokes stay.
              placeholderTextColor={theme.muted}
              accessibilityLabel="Your note"
              // No hand-written `lineHeight`. `text.tsx` bans it on the type
              // scale, and on a multiline iOS `TextInput` it also drags the
              // caret out of alignment with the glyphs.
              style={{
                flex: 1,
                minHeight: 118,
                fontFamily: 'HelveticaNeue',
                fontSize: 17,
                color: theme.ink,
              }}
            />
          </View>

          <View className="mt-4">
            <DiagnosticsPanel diagnostics={diagnostics} attachmentName={attachment?.filename ?? null} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={attachment ? 'Replace the attached screenshot' : 'Attach a screenshot'}
            onPress={() => void pickScreenshot()}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-5 flex-row items-center gap-3 active:opacity-60">
            <View
              className="items-center justify-center rounded-md border border-dashed"
              style={{ width: 44, height: 44, borderColor: theme.ruleStrong }}>
              <SymbolView
                name={attachment ? 'checkmark' : 'plus'}
                size={14}
                tintColor={attachment ? theme.ink : theme.muted}
                resizeMode="scaleAspectFit"
              />
            </View>
            <Text variant="note" className="flex-1">
              {attachment ? 'Screenshot attached. Tap to swap it.' : 'Attach a screenshot'}
            </Text>
          </Pressable>

          {attachError ? (
            <Text variant="note" className="mt-2" style={{ color: theme.critical }}>
              {attachError}
            </Text>
          ) : null}

          {failure ? (
            <Text variant="body" className="mt-5" style={{ color: theme.critical }}>
              {failure}
            </Text>
          ) : null}
        </KeyboardAwareScrollView>
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
