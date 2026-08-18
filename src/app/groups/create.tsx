import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { CIRCLE_EVENTS, circleCreatedProps } from '@/features/circles/analytics';
import { CREATE, NAME_REFUSED, WRITE_FAILED } from '@/features/circles/copy';
import { classifyCircleError } from '@/features/circles/errors';
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
  /** Why the last attempt was refused, or null. Cleared on the next attempt. */
  const [note, setNote] = useState<string | null>(null);

  const trimmed = name.trim();
  const armed = trimmed.length > 0 && !create.isPending;

  const submit = useCallback(() => {
    if (!armed) return;
    setNote(null);
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
          /**
           * The name stays on screen and the button goes live again, with the
           * reason under the field.
           *
           * The two NAME refusals belong there rather than in a banner: the
           * thing to change is in the box directly above, and both may say the
           * group was not created because `assert_clean_ugc` and the length
           * check both fire before the row exists. `unknown` cannot make that
           * claim — the reply may simply have been lost after the server
           * committed — so it sends the reader to look instead.
           */
          onError: (error) => {
            if (terms.intercept(error, run)) return;
            const failure = classifyCircleError(error);
            if (failure.kind === 'blocked_text') setNote(NAME_REFUSED.blockedText);
            else if (failure.kind === 'invalid_name') setNote(NAME_REFUSED.invalidName);
            else if (failure.kind === 'rate_limited') setNote(WRITE_FAILED.rateLimited);
            else if (failure.kind !== 'stale') setNote(WRITE_FAILED.unknown);
          },
        },
      );
    };
    run();
  }, [armed, create, trimmed, router, terms]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/*
        CANCEL AND CREATE IN THE NAV BAR, WHICH IS PC-02's WHOLE CHROME.

        The frame draws no full-width button anywhere: the commit is the
        top-right control and abandoning is the top-left one, iOS's own
        create-sheet grammar. The back control stays the house 36pt disc rather
        than becoming a text "Cancel" — nine screens share `ScreenHeader` and a
        tenth spelling of the back affordance is how the app grows dialects —
        but it announces itself as "Cancel", which is the act it performs here.
      */}
      <ScreenHeader
        backLabel={CREATE.cancel}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CREATE.actionSpoken}
            accessibilityState={{ disabled: !armed, busy: create.isPending }}
            disabled={!armed}
            onPress={submit}
            hitSlop={8}
            // Dimmed only when there is genuinely nothing to submit. While the
            // write is in flight the control is inert too, but it is showing a
            // spinner, and a 40% spinner reads as a rendering fault.
            style={{ minHeight: MIN_TAP_TARGET, opacity: armed || create.isPending ? 1 : 0.4 }}
            className="justify-center px-2 active:opacity-60">
            {create.isPending ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text variant="label" style={{ color: theme.accent }}>
                {CREATE.action}
              </Text>
            )}
          </Pressable>
        }
      />

      <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {CREATE.title}
        </Text>

        {/* The tracked micro-label PC-02 sets over the field, and deliberately
            not `note`: this is a field's name, not a sentence about it, and the
            helper underneath is the sentence. */}
        <SectionHeader title={CREATE.fieldLabel} className="mt-6" />

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
          /**
           * A BORDERED WELL, WHERE THIS USED TO BE AN UNDERLINE.
           *
           * Redesign 27's frame draws the name field as a rounded box with a
           * ring around it, and the change is worth more here than on any other
           * field in the app: this screen has exactly one input on it, no
           * placeholder text below the fold, and a nav-bar commit rather than a
           * button under the thumb. An underline on an otherwise empty page is
           * a hairline somebody has to find. A well is a place to type.
           *
           * `ruleStrong` rather than `rule` for the same reason — the ring IS
           * the affordance here, and at 12% ink over canvas it was closer to
           * absent than to quiet. Radius and padding come from the concentric
           * family the plates use, so the field belongs to the same page.
           */
          style={{
            marginTop: 8,
            minHeight: MIN_TAP_TARGET + 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderWidth: 1,
            borderRadius: 14,
            borderColor: theme.ruleStrong,
            color: theme.ink,
            fontSize: 17,
          }}
        />

        <Text variant="note" className="mt-3 text-muted">
          {CREATE.helper}
        </Text>

        {/* Under the field, because the field is what has to change. */}
        {note ? <Notice message={note} tone="critical" className="mt-4" /> : null}

        {/*
          PC-02's second half: what the reader is about to make, before they
          make it.

          Three facts and no fourth. Two of them are the ones this screen's
          absence of controls would otherwise leave unexplained — there is no
          size field and no "who can invite" setting because the schema already
          decided both — and the third names the one role that exists. The cap
          is stated here rather than beside the name field, which is where the
          old screen deliberately said nothing at all: this card is a definition
          of the thing, so the number belongs in it.
        */}
        <SectionHeader title={CREATE.aboutHeading} className="mt-8" />
        <Card padding="lg" className="mt-2.5">
          <View style={{ gap: 8 }}>
            {CREATE.about.map((line) => (
              <Text key={line} variant="callout">
                {line}
              </Text>
            ))}
          </View>
        </Card>
      </KeyboardAwareScrollView>

      {terms.sheet}
    </SafeAreaView>
  );
}
