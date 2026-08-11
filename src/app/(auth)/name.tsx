import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, Text as RNText, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  atlas,
  AuthHeader,
  MAX_DISPLAY_SCALE,
  MAX_TEXT_SCALE,
  PillSpinner,
} from '@/components/auth/chrome';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { supabase } from '@/lib/supabase';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * W-13 — email path, new accounts only. Apple hands us a name already, so
 * this screen is skipped on that path. First name only; it is the one thing
 * Cinch asks for before it starts. No back chevron: the account already
 * exists, there is nothing behind this screen to return to.
 */
export default function NameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const armed = name.trim().length > 0;

  const onContinue = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    void Haptics.selectionAsync().catch(() => {});
    setSaving(true);
    setFailure(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed, given_name: trimmed },
      });
      if (error) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setFailure(error.message);
        return;
      }
      router.replace({ pathname: '/(auth)/handoff', params: { isNew: '1', name: trimmed } });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFailure(describeThrownSignInError(err));
    } finally {
      setSaving(false);
    }
  }, [name, saving, router]);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <AuthHeader />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 34, paddingTop: 40, paddingBottom: 40 }}>
        <RNText
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 36,
            lineHeight: 40,
            color: atlas.ink,
          }}>
          What should we call you?
        </RNText>
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 12,
            fontFamily: 'HelveticaNeue',
            fontSize: 15,
            lineHeight: 23,
            color: atlas.muted,
          }}>
          It goes on your morning greeting and on anything a friend borrows from you.
        </RNText>

        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void onContinue()}
          editable={!saving}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="go"
          selectionColor={atlas.oxblood}
          accessibilityLabel="First name"
          style={{
            marginTop: 36,
            paddingBottom: 10,
            paddingTop: 0,
            minHeight: MIN_TAP_TARGET,
            borderBottomWidth: 1.5,
            borderBottomColor: saving ? 'rgba(28,26,22,0.3)' : atlas.ink,
            fontFamily: 'HelveticaNeue',
            fontSize: 20,
            color: saving ? atlas.label : atlas.ink,
          }}
        />

        {failure ? (
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            accessibilityLiveRegion="polite"
            style={{
              marginTop: 12,
              fontFamily: 'HelveticaNeue',
              fontSize: 13,
              lineHeight: 20,
              color: atlas.oxblood,
            }}>
            {failure}
          </RNText>
        ) : null}

        <Pressable
          onPress={() => void onContinue()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !armed || saving, busy: saving }}
          style={{
            marginTop: 30,
            minHeight: Math.max(MIN_TAP_TARGET, 51),
            // `md`, like every other labelled control — the same capsule the
            // sign-in and email buttons carried (§1.3, reference board C).
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 17,
            paddingHorizontal: 16,
            backgroundColor: armed || saving ? atlas.ink : atlas.pillDisabled,
          }}>
          {saving ? <PillSpinner /> : null}
          <RNText
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            style={{
              fontFamily: 'HelveticaNeue-Medium',
              fontSize: 15,
              color: armed || saving ? atlas.cream : atlas.pillDisabledLabel,
            }}>
            {saving ? 'Saving' : 'Continue'}
          </RNText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
