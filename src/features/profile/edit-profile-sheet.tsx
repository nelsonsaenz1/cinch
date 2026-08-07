import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  KeyboardAwareScrollView,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { pickAvatar } from './avatar';
import { HANDLE_MAX, handleProblem, normaliseHandle } from './handle';
import { BIO_MAX, NAME_MAX, saveProfileDenialCopy, useSaveProfile } from './mutations';
import { useHandleAvailability, useMyProfile } from './queries';

/**
 * Editing who you are — reached from the closet's identity block and from the
 * account modal, and identical from both.
 *
 * A `Modal`, not a route. Two screens open it, one of which (`app/profile.tsx`)
 * is itself a modal, and a second registered route would have to be declared
 * in the root Stack's options — a file three other sessions are editing this
 * week. A page-sheet modal is the same presentation the router would give it,
 * owned by the feature instead of the navigator.
 *
 * The Plate grammar throughout: hard-left on the gutter, caps kickers over
 * every field, the serif reserved for the page's one title, and the single
 * accent spend on Save.
 */

/** The photograph, at the size the closet draws it. */
const AVATAR_SIZE = 76;

export function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const profile = useMyProfile();
  const save = useSaveProfile();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  /** A freshly picked local file, not yet uploaded. Null means "remove the
   *  stored one"; undefined means "leave whatever is stored alone". */
  const [pickedAvatar, setPickedAvatar] = useState<
    { uri: string; width: number; height: number } | null | undefined
  >(undefined);

  // Seed once, from the first successful read. Re-seeding on every data change
  // would wipe what the user has typed the moment a background refetch lands.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !profile.data) return;
    seeded.current = true;
    setName(profile.data.displayName);
    setHandle(profile.data.username);
    setBio(profile.data.bio);
  }, [profile.data]);

  const storedAvatar = profile.data?.avatarUrl ?? null;
  // What the disc shows right now: the pick, the removal, or what is stored.
  const shownAvatar = pickedAvatar === undefined ? storedAvatar : (pickedAvatar?.uri ?? null);

  const handleError = handleProblem(handle);
  const availability = useHandleAvailability(handle, profile.data?.username ?? '');
  const bioOver = bio.length > BIO_MAX;

  const dirty =
    pickedAvatar !== undefined ||
    name !== (profile.data?.displayName ?? '') ||
    handle !== (profile.data?.username ?? '') ||
    bio !== (profile.data?.bio ?? '');

  const canSave =
    dirty &&
    !handleError &&
    availability !== 'taken' &&
    availability !== 'checking' &&
    !bioOver &&
    !save.isPending &&
    profile.isSuccess;

  /**
   * The line under the handle field. One line, four things it can say, in
   * order of how much the user needs to hear it: what is malformed, what is
   * taken, what is free, and — when there is nothing to report — what the
   * field is for.
   *
   * The last one is the important one. Eleven screens READ `username` and
   * until now nothing could write it, so friend search has been searching a
   * column nobody could fill. This sentence is what tells a user why claiming
   * one matters.
   */
  const handleHint: { text: string; tone: 'error' | 'good' | 'quiet' } = handleError
    ? { text: handleError, tone: 'error' }
    : availability === 'taken'
      ? { text: `@${normaliseHandle(handle)} is taken. Try another.`, tone: 'error' }
      : availability === 'checking'
        ? { text: 'Checking…', tone: 'quiet' }
        : availability === 'free'
          ? { text: `@${normaliseHandle(handle)} is yours.`, tone: 'good' }
          : { text: 'How friends find you. Letters, numbers and underscores.', tone: 'quiet' };

  const choosePhoto = async () => {
    try {
      const asset = await pickAvatar();
      // A dismissed picker is not a failure and must not be reported as one.
      if (!asset) return;
      setPickedAvatar({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch {
      Alert.alert('Could not open your photos', 'Try again in a moment.');
    }
  };

  const confirmRemovePhoto = () => {
    Alert.alert('Remove your photo', 'Your initials go back to standing in for it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPickedAvatar(null) },
    ]);
  };

  const submit = () => {
    save.mutate(
      {
        displayName: name,
        username: handle,
        bio,
        avatar: pickedAvatar,
        currentAvatarUrl: storedAvatar,
      },
      {
        onSuccess: () => {
          setPickedAvatar(undefined);
          onClose();
        },
      },
    );
  };

  /**
   * Leaving with unsaved changes asks first. Everything on this form was
   * typed by hand, and a page sheet is one careless swipe from gone.
   */
  const close = () => {
    if (!dirty || save.isPending) {
      onClose();
      return;
    }
    Alert.alert('Discard changes?', 'What you have typed here will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  // Fields share one shape — the same 12px radius as buttons and chips.
  const inputClassName =
    'rounded-md border border-hairline px-3.5 py-2.5 font-body text-body text-ink dark:border-hairline-dark dark:text-ink-dark';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
        {/* Cancel · title · Save. Save is a text button rather than a bar
            button so the accent lands on it and nowhere else on the sheet. */}
        <View className="flex-row items-center justify-between px-gutter pt-2">
          {/* Inert while the save is in flight: leaving mid-upload would tear
              down the screen that is supposed to report how it went. */}
          <Pressable
            onPress={close}
            disabled={save.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityState={{ disabled: save.isPending }}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className={`active:opacity-60 ${save.isPending ? 'opacity-30' : ''}`}>
            <Text variant="label" className="text-muted dark:text-muted-dark">
              Cancel
            </Text>
          </Pressable>
          <Text variant="colophon">Edit profile</Text>
          <Pressable
            onPress={submit}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: !canSave, busy: save.isPending }}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className={`active:opacity-60 ${canSave ? '' : 'opacity-30'}`}>
            <Text variant="label" style={{ color: theme.accent }}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        {profile.isLoading ? (
          <View accessibilityLabel="Loading your profile" className="px-gutter pt-8">
            <Skeleton className="h-[76px] w-[76px] rounded-full" />
            <Skeleton className="mt-8 h-3 w-20 rounded-chip" />
            <Skeleton className="mt-3 h-11 w-full rounded-md" />
            <Skeleton className="mt-7 h-3 w-20 rounded-chip" />
            <Skeleton className="mt-3 h-11 w-full rounded-md" />
          </View>
        ) : profile.isError ? (
          // A failed read is not an empty profile. Seeding the form from
          // nothing here would let a save wipe a name the app simply could
          // not read.
          <View className="px-gutter pt-10">
            {/* No `trim` — it collapses the line box to the cap height, which
                clips a title long enough to wrap. */}
            <Text variant="title" accessibilityRole="header">
              Couldn&rsquo;t open your profile
            </Text>
            <Text variant="body" className="mt-3 text-muted dark:text-muted-dark">
              Nothing has changed. Check your connection and try again.
            </Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => void profile.refetch()}
              loading={profile.isRefetching}
              className="mt-6 self-start px-6"
            />
          </View>
        ) : (
          <KeyboardAwareScrollView
            contentContainerClassName="px-gutter pb-16"
            showsVerticalScrollIndicator={false}>
            <View className="mt-4">
              <Text variant="title" trim accessibilityRole="header">
                Your profile
              </Text>
            </View>

            {/* The photograph. Hard-left beside its own two actions, not a
                centred hero — this is a field like the others, at the top. */}
            <View className="mt-7 flex-row items-center gap-5">
              <Pressable
                onPress={() => void choosePhoto()}
                accessibilityRole="button"
                accessibilityLabel={shownAvatar ? 'Change your photo' : 'Add a photo'}
                className="active:opacity-70">
                <Avatar
                  name={name}
                  size={AVATAR_SIZE}
                  tone="accent"
                  imageUri={shownAvatar}
                  fallback="?"
                />
                {/* The affordance, said in a glyph rather than a caption —
                    a disc with no visible way in reads as decoration. */}
                <View
                  className="absolute bottom-0 right-0 h-7 w-7 items-center justify-center rounded-full border border-surface bg-ink dark:border-surface-dark dark:bg-ink-dark">
                  <SymbolView
                    name="camera"
                    size={12}
                    tintColor={theme.canvas}
                    resizeMode="scaleAspectFit"
                  />
                </View>
              </Pressable>
              <View className="flex-1">
                <Pressable
                  onPress={() => void choosePhoto()}
                  accessibilityRole="button"
                  style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                  className="active:opacity-60">
                  <Text variant="body" className="text-ink dark:text-ink-dark">
                    {shownAvatar ? 'Change photo' : 'Add a photo'}
                  </Text>
                </Pressable>
                {shownAvatar ? (
                  <Pressable
                    onPress={confirmRemovePhoto}
                    accessibilityRole="button"
                    hitSlop={8}
                    className="active:opacity-60">
                    <Text variant="caption" className="text-muted dark:text-muted-dark">
                      Remove
                    </Text>
                  </Pressable>
                ) : (
                  <Text variant="caption" className="text-faint dark:text-faint-dark">
                    Your initials stand in until you do.
                  </Text>
                )}
              </View>
            </View>

            <SectionHeader title="Name" className="mb-3 mt-8" />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="What friends call you"
              placeholderTextColor={theme.faint}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel="Display name"
              className={inputClassName}
            />

            <SectionHeader title="Handle" className="mb-3 mt-7" />
            <View
              className={`flex-row items-center rounded-md border px-3.5 ${
                handleHint.tone === 'error'
                  ? 'border-critical'
                  : 'border-hairline dark:border-hairline-dark'
              }`}>
              {/* The `@` belongs to the field, not to the value — storing it
                  would break the format constraint on the column. */}
              <Text variant="body" className="text-faint dark:text-faint-dark">
                @
              </Text>
              <TextInput
                value={handle}
                // Normalised as it is typed, not on save: uniqueness is
                // enforced on lower(username), so showing the user a capital
                // she is not going to keep is a small lie the field can
                // simply not tell.
                onChangeText={(next) => setHandle(normaliseHandle(next))}
                placeholder="handle"
                placeholderTextColor={theme.faint}
                maxLength={HANDLE_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Handle"
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  paddingLeft: 2,
                  fontFamily: 'HelveticaNeue',
                  fontSize: 17,
                  color: theme.ink,
                }}
              />
            </View>
            <Text
              variant="caption"
              accessibilityLiveRegion={handleHint.tone === 'quiet' ? 'none' : 'polite'}
              className={`mt-2 ${
                handleHint.tone === 'error'
                  ? 'text-critical'
                  : handleHint.tone === 'good'
                    ? 'text-muted dark:text-muted-dark'
                    : 'text-faint dark:text-faint-dark'
              }`}>
              {handleHint.text}
            </Text>

            <SectionHeader
              title="Bio"
              className="mb-3 mt-7"
              // The count only appears once it is worth watching — a counter
              // standing at 0/280 over an empty field is pressure, not help.
              trailing={
                bio.length > BIO_MAX - 60 ? (
                  <Text
                    variant="colophon"
                    className={bioOver ? 'text-critical' : 'text-faint dark:text-faint-dark'}>
                    {bio.length}/{BIO_MAX}
                  </Text>
                ) : null
              }
            />
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="A line about how you dress."
              placeholderTextColor={theme.faint}
              multiline
              maxLength={BIO_MAX}
              accessibilityLabel="Bio"
              className={`${inputClassName} h-24`}
              style={{ textAlignVertical: 'top' }}
            />
            <Text variant="caption" className="mt-2 text-faint dark:text-faint-dark">
              Sits under your name on your closet. Leave it empty and nothing shows.
            </Text>

            {save.isError ? (
              <Text
                variant="label"
                accessibilityLiveRegion="polite"
                className="mt-7 text-critical dark:text-critical">
                {saveProfileDenialCopy(save.error) ??
                  'That didn’t save. Nothing has changed — check your connection and try again.'}
              </Text>
            ) : null}

            <Button
              title={save.isError ? 'Try again' : 'Save changes'}
              haptic
              loading={save.isPending}
              disabled={!canSave}
              onPress={submit}
              className="mt-8"
            />
          </KeyboardAwareScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
