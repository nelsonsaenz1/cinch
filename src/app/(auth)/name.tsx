import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas } from '@/components/auth/chrome';
import {
  RunButton,
  RunField,
  RunHeader,
  RunPrompt,
  RunSubline,
  TroubleCard,
} from '@/components/auth/run-parts';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import {
  AX_STACK_SCALE,
  NAME_CTA,
  NAME_CTA_SAVING,
  NAME_FIELD_LABEL,
  NAME_HEADLINE,
  NAME_PLACEHOLDER,
  NAME_STEP,
  NAME_SUBLINE,
  PAD,
  nameFailedTrouble,
  showsOwnCta,
  type Trouble,
} from '@/features/auth/auth-run-spec';
import { supabase } from '@/lib/supabase';
import { haptics } from '@/lib/haptics';

/**
 * Redesign 19, step three — the name. Email path, new accounts only.
 *
 * Apple hands us a name already, so this screen is skipped on that path and
 * nothing here can affect it. No back control: the account exists by now, and
 * there is nothing behind this screen to return to — which is why the header
 * draws the progress bar alone.
 *
 * The failure card is the frame's, and its sentence is the important part: a
 * name that would not save is not a sign-in that failed. The session is already
 * written, so the card says so rather than implying the run has to start again.
 */
export default function NameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trouble, setTrouble] = useState<Trouble | null>(null);

  const large = fontScale >= AX_STACK_SCALE;
  const armed = name.trim().length > 0;

  const onContinue = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    haptics.selection();
    setSaving(true);
    setTrouble(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmed, given_name: trimmed },
      });
      if (error) {
        haptics.failure();
        setTrouble(nameFailedTrouble());
        return;
      }
      router.replace({ pathname: '/(auth)/handoff', params: { isNew: '1', name: trimmed } });
    } catch {
      // Same card either way. The thrown sentence from the storage layer is a
      // developer's fact, and this is the one failure on the run where it
      // cannot help: the account is already made and the only thing at stake is
      // a first name, which the card says outright.
      haptics.failure();
      setTrouble(nameFailedTrouble());
    } finally {
      setSaving(false);
    }
  }, [name, saving, router]);

  const fieldTone = saving ? 'busy' : focused ? 'active' : 'rest';

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <RunHeader step={NAME_STEP} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={NAME_HEADLINE}>
          <RunSubline>{NAME_SUBLINE}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 26 }}>
          <RunField
            tone={fieldTone}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => void onContinue()}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="go"
            placeholder={NAME_PLACEHOLDER}
            accessibilityLabel={NAME_FIELD_LABEL}
          />
        </View>

        {trouble ? (
          <View style={{ marginTop: 16 }}>
            <TroubleCard
              trouble={trouble}
              large={large}
              busy={saving}
              onAction={() => void onContinue()}
            />
          </View>
        ) : null}

        {showsOwnCta(trouble) ? (
          <View style={{ marginTop: 16 }}>
            <RunButton
              label={saving ? NAME_CTA_SAVING : NAME_CTA}
              onPress={() => void onContinue()}
              disabled={!armed}
              busy={saving}
              large={large}
            />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}
