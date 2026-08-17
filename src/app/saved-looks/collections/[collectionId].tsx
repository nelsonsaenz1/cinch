import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteCollectionDialog } from '@/components/saved-looks';
import { Button } from '@/components/ui/button';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Notice } from '@/components/ui/notice';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { COLLECTIONS, DELETE_COLLECTION, collectionCountLine } from '@/features/saved-looks/copy';
import { classifySavedError } from '@/features/saved-looks/errors';
import { useDeleteCollection, useRenameCollection } from '@/features/saved-looks/mutations';
import { useSavedCollections, useSavedLooks } from '@/features/saved-looks/queries';
import { collectionCounts } from '@/features/saved-looks/states';
import { COLLECTION_NAME_MAX } from '@/features/saved-looks/types';
import { haptics } from '@/lib/haptics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * OS-05b and OS-05c — renaming a collection, and deleting one.
 *
 * ── ONE SCREEN FOR BOTH, BECAUSE THEY ARE ONE DECISION ─────────────────────
 *
 * OS-05a's hint sends the reader here for either: "tap into it, to rename or
 * delete". Splitting them into two routes would mean choosing which one to do
 * before seeing the collection's name and how many looks are in it — which is
 * exactly the information the choice turns on.
 *
 * ── THE COUNT IS THE ONE FROM THE LIST BEHIND ──────────────────────────────
 *
 * `collectionCounts` over the loaded saves, and it is passed straight into the
 * confirm dialog's body. The reader sees the same number on this screen, in the
 * sheet, and on the manage list they came from — three places, one derivation.
 * A count re-read at confirm time from a different source could contradict the
 * sentence they just read, on the one screen where the sentence is the whole
 * argument for pressing the button.
 *
 * ── DELETING KEEPS THE LOOKS, AND THAT IS THE SCHEMA'S DOING ───────────────
 *
 * `saved_looks.collection_id` is `on delete set null`, asserted in
 * 21_saved_looks.sql at 23. `useDeleteCollection` paints the detachment so the
 * grid does not briefly show cards belonging to a shelf that no longer exists,
 * but the guarantee is the constraint's rather than the mutation's.
 *
 * ── A COLLECTION THAT IS NOT THERE IS NOT AN ERROR ─────────────────────────
 *
 * Deleted here or on another device: the screen leaves, silently. An apology for
 * a thing the reader themselves deleted is noise, and one for a thing deleted on
 * their other phone is a mystery.
 */
export default function EditCollectionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();

  const collections = useSavedCollections();
  const saves = useSavedLooks();
  const rename = useRenameCollection();
  const remove = useDeleteCollection();

  const collection = useMemo(
    () => (collections.data ?? []).find((row) => row.id === collectionId) ?? null,
    [collections.data, collectionId],
  );

  const memberCount = useMemo(
    () => (collectionId ? (collectionCounts(saves.data ?? []).get(collectionId) ?? 0) : 0),
    [saves.data, collectionId],
  );

  /**
   * The field, seeded once from the row.
   *
   * `useState(initialiser)` rather than an effect that copies the query into
   * state: an effect would overwrite what somebody is typing every time a
   * background refetch landed. The seed is `''` until the list arrives, and the
   * `key` on the screen's own route means a different collection remounts.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? collection?.name ?? '';

  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const trimmed = name.trim();
  const changed = collection ? trimmed !== collection.name && trimmed.length > 0 : false;

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/saved-looks/collections');
  }, [router]);

  const submit = useCallback(() => {
    if (!collectionId || !changed || rename.isPending) return;
    setNote(null);
    rename.mutate(
      { collectionId, name: trimmed },
      {
        onSuccess: close,
        onError: (error) => {
          const failure = classifySavedError(error);
          setNote(
            failure.kind === 'invalid_input'
              ? `A collection needs a name of ${COLLECTION_NAME_MAX} characters or fewer. It wasn’t renamed.`
              : 'Cinch couldn’t finish that. Check your collections before trying it again.',
          );
        },
      },
    );
  }, [collectionId, changed, trimmed, rename, close]);

  /** §8: the warning fires when the sheet OPENS, never on the confirm. */
  const askToDelete = useCallback(() => {
    haptics.warning();
    setConfirming(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!collectionId) return;
    haptics.destructiveConfirm();
    remove.mutate(
      { collectionId, memberCount },
      {
        onSuccess: () => {
          setConfirming(false);
          close();
        },
        // The dialog stays open with its buttons live again. A confirm that
        // closed on a failed delete would say the collection is gone when it is
        // not — and the reader's next act would be to look for it.
        onError: () => setConfirming(false),
      },
    );
  }, [collectionId, memberCount, remove, close]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader
        title={COLLECTIONS.renameTitle}
        onBack={close}
        backLabel={COLLECTIONS.cancel}
      />

      <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-24">
        <Text variant="display" trim accessibilityRole="header" className="mt-3">
          {COLLECTIONS.renameTitle}
        </Text>

        <TextInput
          value={name}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          editable={!rename.isPending && Boolean(collection)}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          placeholderTextColor={theme.muted}
          selectionColor={theme.accent}
          accessibilityLabel={COLLECTIONS.renameTitle}
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

        <Text variant="caption" className="mt-2 text-muted">
          {collectionCountLine(memberCount)}
        </Text>

        {note ? <Notice message={note} tone="critical" className="mt-4" /> : null}

        <View className="mt-8 gap-3">
          <Button
            title={COLLECTIONS.save}
            variant="primary"
            onPress={submit}
            disabled={!changed || rename.isPending}
            loading={rename.isPending}
          />
          {/*
            The destructive control is a peer of Save rather than hidden behind
            an overflow: OS-05a's hint promised both verbs live behind this row,
            and an action somebody was told about that then needs finding is
            worse than one drawn plainly. `haptic={false}` — the tick belongs to
            the confirm, not to the button that OPENS the confirm, which is
            still perfectly safe (lib/haptics says so in as many words).
          */}
          <Button
            title={DELETE_COLLECTION.confirm}
            variant="secondary"
            haptic={false}
            onPress={askToDelete}
            disabled={!collection}
          />
        </View>
      </KeyboardAwareScrollView>

      {collection ? (
        <DeleteCollectionDialog
          visible={confirming}
          name={collection.name}
          memberCount={memberCount}
          pending={remove.isPending}
          onKeep={() => setConfirming(false)}
          onDelete={confirmDelete}
        />
      ) : null}
    </SafeAreaView>
  );
}
