import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
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
import { HANDLE_MAX, HANDLE_MIN, handleProblem, normaliseHandle } from './handle';
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

/**
 * A handful of alternatives when the handle she wants is held.
 *
 * Derived locally — a compressed display name, the `_wears` suffix, a short
 * number — and NOT availability-checked here: tapping one fills the field,
 * and the real check answers as it does for anything typed. The number is a
 * deterministic function of the base so the rail does not reshuffle on every
 * keystroke.
 */
function suggestHandles(taken: string, displayName: string): string[] {
  const base = normaliseHandle(taken);
  const fromName = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const digits = String(((base.charCodeAt(0) || 0) + base.length) % 90 + 10);
  const candidates = [fromName, `${base}_wears`, `${base}${digits}`];
  return [...new Set(candidates)]
    .filter((c) => c !== base && handleProblem(c) === null && c.length > 0)
    .slice(0, 3);
}

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

  /**
   * The line under the handle field. One line, four things it can say, in
   * order of how much the user needs to hear it: what is malformed, what is
   * taken, that the check is in flight, and — when there is nothing to
   * report — what the field is for.
   *
   * The last one is the important one. Eleven screens READ `username` and
   * until now nothing could write it, so friend search has been searching a
   * column nobody could fill. This sentence is what tells a user why claiming
   * one matters. (A free handle says so INSIDE the field — the check mark —
   * so the helper keeps explaining rather than repeating it.)
   */
  const normal = normaliseHandle(handle);
  // If the length is fine, the problem handleProblem found is the characters.
  const formatProblem =
    handleError !== null && normal.length >= HANDLE_MIN && normal.length <= HANDLE_MAX;
  const handleHint: { text: string; tone: 'error' | 'quiet' } = handleError
    ? {
        text: formatProblem
          ? 'Spaces and punctuation will not work here. Letters, numbers and underscores only.'
          : handleError,
        tone: 'error',
      }
    : availability === 'taken'
      ? { text: 'Someone has this one. Try adding a word or a number.', tone: 'error' }
      : availability === 'checking'
        ? { text: 'Hold on a second.', tone: 'quiet' }
        : {
            text: 'Letters, numbers and underscores. This is how friends find your closet.',
            tone: 'quiet',
          };

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

  /**
   * The one border, in its three states: a 1px rule at rest, 1.5px ink while
   * focused, 1.5px oxblood when the field holds something that cannot save.
   * Inline because the width changes with the state — a class pair would
   * leave a seam where NativeWind resolves precedence, not the state.
   */
  const frame = (state: 'rest' | 'focus' | 'error') =>
    state === 'error'
      ? { borderWidth: 1.5, borderColor: theme.accent }
      : state === 'focus'
        ? { borderWidth: 1.5, borderColor: theme.ink }
        : { borderWidth: 1, borderColor: theme.rule };

  const handleState =
    handleError || availability === 'taken' ? 'error' : focused === 'handle' ? 'focus' : 'rest';

  // Fields share one shape — white ground, the same 12px radius as buttons.
  const fieldClassName = 'rounded-md bg-surface dark:bg-surface-dark';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
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
                className="text-muted dark:text-muted-dark">
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
                  <Text variant="caption" className="text-muted dark:text-muted-dark">
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
              className={`${fieldClassName} px-3.5 font-body text-callout text-ink dark:text-ink-dark`}
              style={[{ minHeight: FIELD_HEIGHT }, frame(focused === 'name' ? 'focus' : 'rest')]}
            />

            <SectionHeader title="Handle" className="mb-2 mt-5" />
            <View
              className={`${fieldClassName} flex-row items-center px-3.5`}
              style={[{ minHeight: FIELD_HEIGHT }, frame(handleState)]}>
              {/* The `@` belongs to the field, not to the value — storing it
                  would break the format constraint on the column. */}
              <Text variant="callout" className="text-faint dark:text-faint-dark">
                @
              </Text>
              <TextInput
                value={handle}
                // Normalised as it is typed, not on save: uniqueness is
                // enforced on lower(username), so showing the user a capital
                // she is not going to keep is a small lie the field can
                // simply not tell.
                onChangeText={(next) => setHandle(normaliseHandle(next))}
                onFocus={() => setFocused('handle')}
                onBlur={() => setFocused(null)}
                placeholder="handle"
                placeholderTextColor={theme.faint}
                maxLength={HANDLE_MAX}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Handle"
                style={{
                  flex: 1,
                  minHeight: FIELD_HEIGHT - 3, // inside the widest border
                  paddingLeft: 2,
                  fontFamily: 'HelveticaNeue',
                  fontSize: 16,
                  color: theme.ink,
                }}
              />
              {/* The verdict lives IN the field — a check, a spinner, or the
                  one word "Taken" — with the helper below carrying the fix. */}
              {availability === 'free' ? (
                <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
                  <SymbolView
                    name="checkmark"
                    size={12}
                    tintColor={theme.ink}
                    resizeMode="scaleAspectFit"
                  />
                  <Text variant="label" className="text-ink dark:text-ink-dark">
                    Available
                  </Text>
                </View>
              ) : availability === 'checking' ? (
                <View className="flex-row items-center gap-1.5" accessibilityLiveRegion="polite">
                  <ActivityIndicator size="small" color={theme.faint} />
                  <Text variant="label" className="text-faint dark:text-faint-dark">
                    Checking
                  </Text>
                </View>
              ) : availability === 'taken' ? (
                <Text variant="label" accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
                  Taken
                </Text>
              ) : null}
            </View>
            <Text
              variant="caption"
              accessibilityLiveRegion={handleHint.tone === 'quiet' ? 'none' : 'polite'}
              className={handleHint.tone === 'error' ? 'mt-2' : 'mt-2 text-muted dark:text-muted-dark'}
              style={handleHint.tone === 'error' ? { color: theme.accent } : undefined}>
              {handleHint.text}
            </Text>
            {suggestions.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-2.5"
                contentContainerStyle={{ gap: 7 }}>
                {/* Alternatives that fill the field on tap. `rounded-chip`
                    rather than the atlas's 15px capsule: labelled controls in
                    this app are 12px rectangles by rule (tailwind.config.js on
                    `full`), and one radius grammar beats a 3px match. */}
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setHandle(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use handle ${s}`}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={{ height: 30, justifyContent: 'center' }}
                    className="rounded-chip border border-rule px-3 active:opacity-60 dark:border-rule-dark">
                    <Text variant="label" style={{ color: theme.ink }}>
                      @{s}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

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
              className={`${fieldClassName} px-3.5 py-3 font-body text-callout text-ink dark:text-ink-dark`}
              style={[
                { minHeight: 104, textAlignVertical: 'top' },
                frame(bioOver ? 'error' : focused === 'bio' ? 'focus' : 'rest'),
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
              <Text variant="caption" className="mt-2 text-muted dark:text-muted-dark">
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

            <Text variant="caption" className="mt-7 text-muted dark:text-muted-dark">
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
