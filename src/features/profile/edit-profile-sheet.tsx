import { Alert, Modal, Pressable, TextInput, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { AvatarCropSheet, type CropAsset } from './avatar-crop-sheet';
import { pickAvatar } from './avatar';
import { fieldFrame } from './field-frame';
import { handleProblem, normaliseHandle, suggestHandles } from './handle';
import { HandleField } from './handle-field';
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
 * The atlas grammar (E-01/E-02): Cancel · serif title · Save across the top,
 * the photograph centred over its oxblood "Change photo", caps kickers over
 * white 46px fields, and the single accent spend on Save. The header Save is
 * the only save — no bottom button.
 */

/** The photograph, at the size the sheet's centred disc draws it. */
const AVATAR_SIZE = 88;

/** Field height, per the atlas. */
const FIELD_HEIGHT = 46;

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
  /** The picker's asset while the crop sheet is up; null keeps it closed. */
  const [cropAsset, setCropAsset] = useState<CropAsset | null>(null);
  const [focused, setFocused] = useState<'name' | 'handle' | 'bio' | null>(null);

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

  // EP-02's four validation states (checking / taken / not-allowed / the
  // quiet default) and the helper sentence under the field both live in
  // `HandleField` now — this component only supplies the data.
  const suggestions = useMemo(
    () => (availability === 'taken' ? suggestHandles(handle, name) : []),
    [availability, handle, name],
  );

  const choosePhoto = async () => {
    try {
      const asset = await pickAvatar();
      // A dismissed picker is not a failure and must not be reported as one.
      if (!asset) return;
      // Into the "Move and scale" step — nothing is committed until Use photo.
      setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height });
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

  // The one border, in its three states — see `field-frame.ts`.

  // Fields share one shape — white ground, the same 12px radius as buttons.
  const fieldClassName = 'rounded-md bg-surface';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        {/* Cancel · serif title · Save. Save is a text button rather than a
            bar button so the accent lands on it and nowhere else; inert it
            reads in the byline grey, not a dimmed oxblood. */}
        <View className="flex-row items-center px-gutter pb-2 pt-2">
          <View className="flex-1 items-start">
            {/* Inert while the save is in flight: leaving mid-upload would
                tear down the screen that is supposed to report how it went. */}
            <Pressable
              onPress={close}
              disabled={save.isPending}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityState={{ disabled: save.isPending }}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className={`active:opacity-60 ${save.isPending ? 'opacity-30' : ''}`}>
              <Text
                variant="label"
                style={{ fontSize: 15, lineHeight: 20 }}
                className="text-muted">
                Cancel
              </Text>
            </Pressable>
          </View>
          <Text variant="plate" style={{ fontSize: 20, lineHeight: 26 }} accessibilityRole="header">
            Edit profile
          </Text>
          <View className="flex-1 items-end">
            <Pressable
              onPress={submit}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              accessibilityState={{ disabled: !canSave, busy: save.isPending }}
              style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
              className="active:opacity-60">
              <Text
                variant="label"
                style={{ fontSize: 15, lineHeight: 20, color: canSave || save.isPending ? theme.accent : theme.byline }}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>

        {profile.isLoading ? (
          <View accessibilityLabel="Loading your profile" className="px-gutter pt-4">
            <View className="items-center">
              <Skeleton className="h-[88px] w-[88px] rounded-full" />
            </View>
            <Skeleton className="mt-8 h-3 w-24 rounded-chip" />
            <Skeleton className="mt-2 h-[46px] w-full rounded-md" />
            <Skeleton className="mt-6 h-3 w-24 rounded-chip" />
            <Skeleton className="mt-2 h-[46px] w-full rounded-md" />
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
            <Text variant="body" className="mt-3 text-muted">
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
            {/* The photograph, centred over its one oxblood text action. The
                Remove affordance stays quiet — a caption that exists only
                when there is a photo to remove. */}
            <View className="items-center pb-5 pt-1.5">
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
              </Pressable>
              <Pressable
                onPress={() => void choosePhoto()}
                accessibilityRole="button"
                style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
                className="active:opacity-60">
                <Text variant="label" style={{ color: theme.accent }}>
                  {shownAvatar ? 'Change photo' : 'Add a photo'}
                </Text>
              </Pressable>
              {shownAvatar ? (
                <Pressable
                  onPress={confirmRemovePhoto}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="active:opacity-60">
                  <Text variant="caption" className="text-muted">
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <SectionHeader title="Display name" className="mb-2" />
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              placeholder="What friends call you"
              placeholderTextColor={theme.faint}
              maxLength={NAME_MAX}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel="Display name"
              className={`${fieldClassName} px-3.5 font-body text-callout text-ink`}
              style={[{ minHeight: FIELD_HEIGHT }, fieldFrame(theme, focused === 'name' ? 'focus' : 'rest')]}
            />

            <HandleField
              value={handle}
              // Normalised as it is typed, not on save: uniqueness is
              // enforced on lower(username), so showing the user a capital
              // she is not going to keep is a small lie the field can simply
              // not tell.
              onChangeText={(next) => setHandle(normaliseHandle(next))}
              focused={focused === 'handle'}
              onFocus={() => setFocused('handle')}
              onBlur={() => setFocused(null)}
              handleError={handleError}
              availability={availability}
              suggestions={suggestions}
              onPressSuggestion={setHandle}
            />

            <SectionHeader
              title="Bio"
              className="mb-2 mt-5"
              trailing={
                <Text
                  variant="caption"
                  style={{ color: bioOver ? theme.accent : theme.faint }}>
                  {bio.length} / {BIO_MAX}
                </Text>
              }
            />
            {/* No maxLength: typing past the limit is allowed, the counter and
                border say so, and Save stays inert. The atlas highlights the
                overflow substring inside the field; RN's nested-Text children
                fight a controlled TextInput's selection on iOS, so this ships
                the sanctioned fallback — counter, border, helper — rather
                than a glitchy overlay. */}
            <TextInput
              value={bio}
              onChangeText={setBio}
              onFocus={() => setFocused('bio')}
              onBlur={() => setFocused(null)}
              placeholder="A line about how you dress."
              placeholderTextColor={theme.faint}
              multiline
              accessibilityLabel="Bio"
              className={`${fieldClassName} px-3.5 py-3 font-body text-callout text-ink`}
              style={[
                { minHeight: 104, textAlignVertical: 'top' },
                fieldFrame(theme, bioOver ? 'error' : focused === 'bio' ? 'focus' : 'rest'),
              ]}
            />
            {bioOver ? (
              <Text
                variant="caption"
                accessibilityLiveRegion="polite"
                className="mt-2"
                style={{ color: theme.accent }}>
                {bio.length - BIO_MAX === 1
                  ? '1 character past the limit.'
                  : `${bio.length - BIO_MAX} characters past the limit.`}
              </Text>
            ) : (
              <Text variant="noteSmall" className="mt-2 text-muted">
                Sits under your name on your closet. Leave it empty and nothing shows.
              </Text>
            )}

            {save.isError ? (
              <Text
                variant="label"
                accessibilityLiveRegion="polite"
                className="mt-6"
                style={{ color: theme.accent }}>
                {saveProfileDenialCopy(save.error) ??
 'That didn’t save. Nothing has changed — check your connection and try again.'}
              </Text>
            ) : null}

            <Text variant="noteSmall" className="mt-7 text-muted">
              Your handle and bio are visible to anyone you share a closet link with. Everything
              else stays private.
            </Text>
          </KeyboardAwareScrollView>
        )}

        {/* Picker → Move and scale → pickedAvatar. Back leaves everything
            exactly as it was. */}
        <AvatarCropSheet
          asset={cropAsset}
          onCancel={() => setCropAsset(null)}
          onUse={(cropped) => {
            setPickedAvatar(cropped);
            setCropAsset(null);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
