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
import { sendEmailCode } from '@/features/auth/actions';
import {
  AX_STACK_SCALE,
  EMAIL_CTA,
  EMAIL_CTA_SENDING,
  EMAIL_FIELD_LABEL,
  EMAIL_HEADLINE,
  EMAIL_INVALID,
  EMAIL_PLACEHOLDER,
  EMAIL_STEP,
  EMAIL_SUBLINE,
  LEGAL_PREFIX,
  LEGAL_SIZE,
  PAD,
  RATE_LIMIT_S,
  offlineTrouble,
  rateLimitedTrouble,
  sendFailedTrouble,
  showsOwnCta,
  thrownTrouble,
  type Trouble,
} from '@/features/auth/auth-run-spec';
import { useConnectivity } from '@/features/auth/use-connectivity';
import { isValidEmail, normalizeEmail } from '@/features/auth/email';
import { describeThrownSignInError } from '@/features/auth/sign-in-errors';
import { haptics } from '@/lib/haptics';

/**
 * Redesign 19, step one — the address.
 *
 * ── WHAT MOVED, AND WHAT DID NOT ────────────────────────────────────────────
 *
 * Moved: the composition. Header wordmark → back well plus progress bar; the
 * underline field → a boxed one; the label-line-that-doubles-as-an-error and
 * the tray callout → a refusal line and a trouble card; the pill → one filled
 * capsule CTA. Copy is the frame's, which is shorter everywhere.
 *
 * Did NOT move: the send. `sendEmailCode` is called with the same argument,
 * raced against the same 8s ceiling, and its three outcomes (ok, rate-limited,
 * anything else) are read exactly as before. Validation still runs on blur or
 * submit and never per keystroke. A thrown failure still surfaces rather than
 * going silent.
 *
 * ── THE ONE BEHAVIOUR THIS ADDS ─────────────────────────────────────────────
 *
 * The frames draw an offline state and a counting rate limit, neither of which
 * the shipped screen had. Both are refusals to START a request that was going
 * to fail; neither changes what happens when a request IS made. `RATE_LIMIT_S`
 * is the five minutes the shipped sentence already promised, now counted out
 * loud instead of asserted once and left to go stale.
 */
export default function EmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const online = useConnectivity();

  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [trouble, setTrouble] = useState<Trouble | null>(null);
  const [rateLimitLeft, setRateLimitLeft] = useState(0);
  const fieldRef = useRef<TextInput>(null);

  const large = fontScale >= AX_STACK_SCALE;
  const armed = isValidEmail(email);

  // The rate limit counts itself down. Presentation only — see the spec's note
  // on `rateLimitBody`; nothing here decides whether a send is permitted.
  useEffect(() => {
    if (rateLimitLeft <= 0) return;
    const id = setTimeout(() => setRateLimitLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [rateLimitLeft]);

  /**
   * The rate-limit card is DERIVED from the count, never stored beside it.
   *
   * Holding it in state would mean writing a new card object every second from
   * inside an effect — a cascading render per tick, and two facts (the number
   * and the sentence quoting it) that can disagree. It outranks a stored
   * trouble because it is the one the user must act on: the others all say
   * "try again", and while the window is open trying again is exactly what
   * cannot happen.
   */
  const shownTrouble = rateLimitLeft > 0 ? rateLimitedTrouble(rateLimitLeft) : trouble;

  const validateNow = useCallback(() => {
    setInvalid(email.trim().length > 0 && !isValidEmail(email));
  }, [email]);

  const onSubmit = useCallback(async () => {
    if (sending || rateLimitLeft > 0) return;
    if (!isValidEmail(email)) {
      setInvalid(true);
      return;
    }
    haptics.selection();
    setInvalid(false);

    // Refusing before the request, not after it — the frame's offline card says
    // "Nothing has been sent", and that has to be true when it is drawn.
    if (!online) {
      haptics.warning();
      setTrouble(offlineTrouble());
      return;
    }

    setTrouble(null);
    setSending(true);
    try {
      // An open request past 8s is a failure the user can act on — the button
      // must never sit on "Sending…" forever. Unchanged from the shipped race.
      const result = await Promise.race([
        sendEmailCode(email),
        new Promise<{ ok: false; reason: 'failed' }>((resolve) =>
          setTimeout(() => resolve({ ok: false, reason: 'failed' }), 8000),
        ),
      ]);
      if (result.ok) {
        setSending(false);
        router.push({ pathname: '/(auth)/code', params: { email: normalizeEmail(email) } });
        return;
      }
      haptics.failure();
      if (result.reason === 'rate-limited') setRateLimitLeft(RATE_LIMIT_S);
      else setTrouble(sendFailedTrouble());
    } catch (err) {
      // Thrown, not returned — the storage layer escaping. Surface it.
      haptics.failure();
      setTrouble(thrownTrouble(describeThrownSignInError(err)));
    } finally {
      setSending(false);
    }
  }, [email, sending, rateLimitLeft, online, router]);

  const fieldTone = sending ? 'busy' : invalid ? 'refused' : focused ? 'active' : 'rest';
  const ownCta = showsOwnCta(shownTrouble);

  return (
    <View style={{ flex: 1, backgroundColor: atlas.paper, paddingTop: insets.top }}>
      <StatusBar style="dark" />
      <RunHeader step={EMAIL_STEP} onBack={() => router.back()} backDisabled={sending} />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 26, paddingBottom: 40 }}>
        <RunPrompt headline={EMAIL_HEADLINE}>
          <RunSubline>{EMAIL_SUBLINE}</RunSubline>
        </RunPrompt>

        <View style={{ marginTop: 26 }}>
          <RunField
            ref={fieldRef}
            tone={fieldTone}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
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
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            placeholder={EMAIL_PLACEHOLDER}
            accessibilityLabel={EMAIL_FIELD_LABEL}
          />
        </View>

        {invalid && !sending ? <RunFieldError>{EMAIL_INVALID}</RunFieldError> : null}

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
              label={sending ? EMAIL_CTA_SENDING : EMAIL_CTA}
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
      </KeyboardAwareScrollView>
    </View>
  );
}

/**
 * A legal link inside the consent sentence.
 *
 * Still a text span rather than a `RunInlineAction`: these two are part of a
 * sentence the user is agreeing to, and lifting them out into boxes would break
 * the sentence into three controls. The 44pt floor does not apply to a link
 * inside running prose — WCAG's target-size rule exempts text-flow links, and
 * the paragraph itself is the target.
 */
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
