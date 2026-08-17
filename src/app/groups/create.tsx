import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { CIRCLE_EVENTS, circleCreatedProps } from '@/features/circles/analytics';
import { CREATE } from '@/features/circles/copy';
import { useCreateCircle } from '@/features/circles/mutations';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PC-02 — naming it, which is the whole of making one.
 *
 * A group is a name and an owner. There is no description, no photo, no
 * privacy toggle and no "who can invite" setting: every one of those is a
 * decision the schema already made and cannot be talked out of — groups are
 * invite-only, the owner is the only inviter, and `can_see_circle` means a
 * non-member's query returns nothing at all. A switch that could only ever be
 * in one position is a switch that implies the other position exists.
 *
 * ── THE ROOM IS EMPTY WHEN THIS FINISHES, AND THAT IS CORRECT ───────────────
 *
 * `handle_new_circle` writes the owner in as `joined` in the same transaction,
 * so the group created here has exactly one member. This route hands off to the
 * group's own screen, which resolves that to `alone` — the liveness state, with
 * its own copy asking for one person. It is deliberately NOT a wizard that
 * marches on to the picker: a group with nobody in it is a real, finished,
 * usable group, and forcing an invitation before the thing exists would make
 * "two to twelve people" read as a floor the schema does not enforce.
 */
export default function CreateGroupScreen() {
  const router = useRouter();
  const theme = useTheme();
  const terms = useSocialTermsGate();
  const create = useCreateCircle();

  const [name, setName] = useState('');

  const trimmed = name.trim();
  const armed = trimmed.length > 0 && !create.isPending;

  const submit = useCallback(() => {
    if (!armed) return;
    const run = () => {
      create.mutate(
        { name: trimmed },
        {
          onSuccess: (circle) => {
            track(CIRCLE_EVENTS.created, circleCreatedProps());
            // `replace`, not `push`: going back from a group you just made
            // should reach the list, never the naming screen that would offer
            // to make it a second time.
            router.replace({ pathname: '/groups/[circleId]', params: { circleId: circle.id } });
          },
          // The name is still on screen and the button is live again. The two
          // refusals this can carry — a name the text filter rejected, and one
          // outside 1-60 characters — have no sentence in the copy module, so
          // this states nothing rather than inventing a sentence for them.
          onError: (error) => {
            terms.intercept(error, run);
          },
        },
      );
    };
    run();
  }, [armed, create, trimmed, router, terms]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={CREATE.title} backLabel={CREATE.cancel} />

      <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {CREATE.title}
        </Text>

        <Text variant="note" className="mt-4">
          {CREATE.fieldLabel}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          editable={!create.isPending}
          autoFocus
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="go"
          placeholder={CREATE.placeholder}
          placeholderTextColor={theme.muted}
          selectionColor={theme.accent}
          accessibilityLabel={CREATE.fieldLabel}
          /**
           * Sixty, because `circles.name` carries
           * `check (char_length(name) between 1 and 60)` and a field that let
           * somebody type a sixty-first character would spend that character
           * on a database refusal with no sentence to explain it.
           */
          maxLength={60}
          style={{
            marginTop: 8,
            minHeight: MIN_TAP_TARGET,
            paddingBottom: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: theme.rule,
            color: theme.ink,
            fontSize: 17,
          }}
        />

        <Text variant="note" className="mt-3 text-muted">
          {CREATE.helper}
        </Text>

        <Button
          title={CREATE.action}
          variant="primary"
          onPress={submit}
          disabled={!armed}
          loading={create.isPending}
          className="mt-8"
        />

        {/* Nothing states the twelve-seat cap here, and nothing should: PC-01's
            body already said "Two to twelve people" on the way in, and the only
            other sentence about the cap in the copy module is PC-10's, which is
            about a group that is ALREADY full. Writing a third would be new
            copy nobody reviewed. */}
      </KeyboardAwareScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
