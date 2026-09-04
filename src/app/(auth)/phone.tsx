import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text as RNText, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { atlas, MAX_TEXT_SCALE, PRIVACY_URL, TERMS_URL } from '@/components/auth/chrome';
import {
  RunButton,
  RunField,
  RunFieldError,
  RunHeader,
  RunPrompt,
  RunSubline,
  TroubleCard,
} from '@/components/auth/run-parts';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { sendPhoneCode } from '@/features/auth/actions';
import {
  AX_STACK_SCALE,
  LEGAL_PREFIX,
  LEGAL_SIZE,
  PAD,
  PHONE_CTA,
  PHONE_CTA_SENDING,
  PHONE_FIELD_LABEL,
  PHONE_HEADLINE,
  PHONE_INVALID,
  PHONE_PLACEHOLDER,
  PHONE_STEP,
  PHONE_SUBLINE,
  PHONE_TAGLINE,
  RATE_LIMIT_S,
  offlineTrouble,
  phoneSendFailedTrouble,
  rateLimitedTrouble,
  showsOwnCta,
  thrownTrouble,
  type Trouble,
} from '@/features/auth/auth-run-spec';
import { isValidPhone, normalizePhone } from '@/features/auth/phone';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { useConnectivity } from '@/features/auth/use-connectivity';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';

/**
 * The phone run, step one — the number. `email.tsx` with the channel swapped.
 *
 * Deliberately a separate file rather than a mode on the email screen: the two
 * differ in keyboard, autofill hints, validation, spec copy and the SMS
 * consent sentence, and a screen forked five ways on a `channel` prop is
 * harder to read than two screens that each say one thing. Everything they
 * genuinely share is already shared — `run-parts`, the spec, the trouble
 * grammar, and the code screen after it.
 *
 * NOT reachable from the welcome screen yet: `PHONE_SIGN_IN_ENABLED` in the
 * spec stays false until the Twilio provider is live in Supabase (see that
 * constant's note). The route exists so the flow can be exercised end-to-end
 * against a dashboard Test OTP before any real user is shown the door.
 *
 * The subline carries "Message and data rates may apply" — the carrier
 * consent sentence toll-free verification reviewers look for at the point the
 * number is collected, said once, where it is true.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const online = useConnectivity();

  const [phone, setPhone] = useState('');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [rateLimitLeft, setRateLimitLeft] = useState(0);
  const fieldRef = useRef<TextInput>(null);

  const large = fontScale >= AX_STACK_SCALE;
  const armed = isValidPhone(phone);

  // The rate limit counts itself down — presentation only, exactly as the
  // email screen holds it. Nothing here decides whether a send is permitted.
  useEffect(() => {
    if (rateLimitLeft <= 0) return;
    const id = setTimeout(() => setRateLimitLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [rateLimitLeft]);

  const shownTrouble = rateLimitLeft > 0 ? rateLimitedTrouble(rateLimitLeft) : trouble;

  const validateNow = useCallback(() => {
    setInvalid(phone.trim().length > 0 && !isValidPhone(phone));
  }, [phone]);

  const onSubmit = useCallback(async () => {
    if (sending || rateLimitLeft > 0) return;
    const number = normalizePhone(phone);
    if (!number) {
      setInvalid(true);
      // A42, as on the email screen. Never the number.
      track('auth_address_refused', { method: 'phone', reason: 'invalid' });
      return;
    }
    haptics.selection();
    setInvalid(false);

    // Refusing before the request — the offline card says "Nothing has been
    // sent", and that has to be true when it is drawn.
    if (!online) {
      haptics.warning();
      setTrouble(offlineTrouble());
      track('auth_address_refused', { method: 'phone', reason: 'offline' });
      return;
    }

    setTrouble(null);
    setSending(true);
    try {
      // The same 8s ceiling the email screen races — a button must never sit
      // on "Sending…" forever.
      const result = await Promise.race([
        sendPhoneCode(number),
        new Promise<{ ok: false; reason: 'failed' }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: 'failed' }), 8000),
        ),
      ]);
      if (result.ok) {
        track('auth_code_sent', { method: 'phone', resend: false });
        setSending(false);
        router.push({ pathname: '/(auth)/code', params: { phone: number } });
        return;
      }
      haptics.failure();
      if (result.reason === 'rate-limited') setRateLimitLeft(RATE_LIMIT_S);
      else setTrouble(phoneSendFailedTrouble());
    } catch (err) {
      // Thrown, not returned — the storage layer escaping. Surface it.
      haptics.failure();
      setTrouble(thrownTrouble(describeThrownSignInError(err)));
    } finally {
      setSending(false);
    }
  }, [phone, sending, rateLimitLeft, online, router]);

  const fieldTone = sending ? 'busy' : invalid ? 'refused' : focused ? 'active' : 'rest';
  const ownCta = showsOwnCta(shownTrouble);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <RunHeader step={PHONE_STEP} onBack={() => router.back()} backDisabled={sending} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={PHONE_HEADLINE}>
          <RunSubline>{PHONE_TAGLINE}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 26 }}>
          <RunField
            ref={fieldRef}
            tone={fieldTone}
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              // Only CLEARING here — flagging waits for blur or submit.
              if (invalid) setInvalid(false);
              if (trouble && rateLimitLeft <= 0) setTrouble(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              validateNow();
            }}
            onSubmitEditing={() => void onSubmit()}
            autoFocus
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="go"
            placeholder={PHONE_PLACEHOLDER}
            accessibilityLabel={PHONE_FIELD_LABEL}
          />
        </View>

        {invalid && !sending ? <RunFieldError>{PHONE_INVALID}</RunFieldError> : null}

        {shownTrouble ? (
          <View style={{ marginTop: 16 }}>
            <TroubleCard
              trouble={shownTrouble}
              large={large}
              busy={sending}
              onAction={() => void onSubmit()}
            />
          </View>
        ) : null}

        {ownCta ? (
          <View style={{ marginTop: 16 }}>
            <RunButton
              label={sending ? PHONE_CTA_SENDING : PHONE_CTA}
              onPress={() => void onSubmit()}
              disabled={!armed || rateLimitLeft > 0}
              busy={sending}
              large={large}
            />
          </View>
        ) : null}

        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 14,
            fontFamily: 'HelveticaNeue',
            fontSize: LEGAL_SIZE,
            lineHeight: 20,
            color: atlas.muted,
          }}>
          {LEGAL_PREFIX}
          <LegalLink label="Terms" url={TERMS_URL} />
          {' and '}
          <LegalLink label="Privacy Policy" url={PRIVACY_URL} />.
        </RNText>

        {/* P2 #41 — the carrier-required SMS consent text, as a footnote
            rather than the headline's own subline. Twilio toll-free
            verification requires this exact wording be readable at the point
            the number is collected; nothing in it is reworded or shortened —
            it is only set at the same compact weight as the Terms/Privacy
            line above, so it stops competing with "Send code" for the
            reader's attention. */}
        <RNText
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          style={{
            marginTop: 8,
            fontFamily: 'HelveticaNeue',
            fontSize: LEGAL_SIZE,
            lineHeight: 20,
            color: atlas.muted,
          }}>
          {PHONE_SUBLINE}
        </RNText>
      </KeyboardAwareScrollView>
    </View>
  );
}

/** The consent sentence's links — see email.tsx for why these stay text spans. */
function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <RNText
      accessibilityRole="link"
      suppressHighlighting
      onPress={() => void Linking.openURL(url)}
      style={{ color: atlas.oxblood, textDecorationLine: 'underline' }}>
      {label}
    </RNText>
  );
}
