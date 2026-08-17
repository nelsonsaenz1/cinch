import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { COLLECTIONS } from '@/features/saved-looks/copy';
import { classifySavedError } from '@/features/saved-looks/errors';
import { useCreateCollection } from '@/features/saved-looks/mutations';
import { COLLECTION_NAME_MAX } from '@/features/saved-looks/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * OS-05b — naming a collection, which is the whole of making one.
 *
 * A collection is a name and an owner. There is no cover image to choose, no
 * description, no colour and no privacy toggle — the first three because
 * `boards`' own migration says so in as many words ("KP-05 is the whole
 * specification… the column list IS the contract"), and the fourth because a
 * collection has exactly one visibility and a switch that could only ever be in
 * one position implies the other position exists.
 *
 * ── FORTY CHARACTERS, ENFORCED WHERE THE SENTENCE IS PRINTED ───────────────
 *
 * `maxLength` is `COLLECTION_NAME_MAX`, and the helper under the field says the
 * same number. `boards.name` admits SIXTY: the schema was not narrowed, because
 * tightening a live check constraint would refuse to load boards that already
 * exist with 41-60 character names — a migration that breaks somebody's own data
 * to make a newer sentence true. So the field is the ceiling, the field is where
 * the promise is printed, and the two cannot drift because they are the same
 * constant.
 *
 * A field that let somebody type a forty-first character would spend that
 * character on a refusal with no sentence to explain it — which is why this
 * caps rather than validating afterwards.
 *
 * ── AND IT GOES BACK, NOT ONWARD ───────────────────────────────────────────
 *
 * `router.back()` on success rather than a push into the new collection. A
 * collection with nothing in it is a real, finished, usable collection, and
 * marching somebody into an empty one would make it look like the creation was
 * only half done. The manage list they came from is where the new row appears.
 */
export default function NewCollectionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const create = useCreateCollection();

  const [name, setName] = useState('');
  /** Why the last attempt was refused, or null. Cleared on the next attempt. */
  const [note, setNote] = useState<string | null>(null);

  const trimmed = name.trim();
  const armed = trimmed.length > 0 && !create.isPending;

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/saved-looks/collections');
  }, [router]);

  const submit = useCallback(() => {
    if (!armed) return;
    setNote(null);
    create.mutate(
      { name: trimmed },
      {
        onSuccess: close,
        /**
         * The name stays on screen and the button goes live again, with the
         * reason under the field — the thing to change is in the box above.
         *
         * `invalid_input` is the length check, which fires BEFORE the row
         * exists, so "wasn't created" is a fact and may be stated. The
         * catch-all cannot make that claim: the reply may have been lost after
         * the server committed, so it sends the reader to look rather than
         * telling them a state it cannot know.
         */
        onError: (error) => {
          const failure = classifySavedError(error);
          setNote(
            failure.kind === 'invalid_input'
              ? `A collection needs a name of ${COLLECTION_NAME_MAX} characters or fewer. It wasn’t created.`
              : 'Cinch couldn’t finish that. Check your collections before trying it again.',
          );
        },
      },
    );
  }, [armed, create, trimmed, close]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={COLLECTIONS.create} onBack={close} backLabel={COLLECTIONS.cancel} />

      <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {COLLECTIONS.create}
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          editable={!create.isPending}
          autoFocus
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          placeholderTextColor={theme.muted}
          selectionColor={theme.accent}
          accessibilityLabel={COLLECTIONS.create}
          maxLength={COLLECTION_NAME_MAX}
          style={{
            marginTop: 20,
            minHeight: MIN_TAP_TARGET,
            paddingBottom: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: theme.rule,
            color: theme.ink,
            fontSize: 17,
          }}
        />

        <Text variant="note" className="mt-3 text-muted">
          {COLLECTIONS.nameHint}
        </Text>

        {note ? <Notice message={note} tone="critical" className="mt-4" /> : null}

        <Button
          title={COLLECTIONS.save}
          variant="primary"
          onPress={submit}
          disabled={!armed}
          loading={create.isPending}
          className="mt-8"
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
