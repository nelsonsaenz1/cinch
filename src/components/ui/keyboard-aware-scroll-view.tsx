import { forwardRef, type ElementRef } from 'react';
import { KeyboardAvoidingView, ScrollView, type KeyboardAvoidingViewProps, type ScrollViewProps } from 'react-native';

/**
 * The one shared keyboard mechanism for every text-entry screen.
 *
 * `react-native-keyboard-controller` is not installed, and adding it means a
 * new native module — a dev-client rebuild — for a problem RN's own iOS APIs
 * already solve. Two small pieces cover every layout shape in the app:
 *
 * `KeyboardAwareScrollView` — a scrollable FORM (planning an occasion, invite
 * search, the friend-request ask, an outfit caption). `automaticallyAdjustKeyboardInsets`
 * is UIScrollView's own keyboard-avoidance (iOS 13+, RN 0.71+): as the
 * keyboard rises, the scroll view insets itself and carries the focused field
 * up above it automatically — no manual offset math, no measuring the field's
 * position by hand. That IS "the bubble comes to the top of the keyboard."
 *
 * `KeyboardAvoidingScreen` — a screen with a DOCKED composer pinned below a
 * message list (the stylist, event comments, the borrow-request sheet). Here
 * the field never scrolls; the whole screen's bottom edge has to lift, which
 * is what `KeyboardAvoidingView behavior="padding"` does. The app is iOS-only
 * (app.config.ts `userInterfaceStyle`), so `behavior` is never conditional on
 * `Platform.OS` here the way ad-hoc call sites used to write it.
 *
 * Both default `keyboardShouldPersistTaps="handled"` so a tap on a chip or a
 * button elsewhere on the form doesn't require a first tap to dismiss the
 * keyboard, and `keyboardDismissMode="interactive"` so a drag-to-dismiss feels
 * native. Every prop stays overridable per screen.
 */
export const KeyboardAwareScrollView = forwardRef<ElementRef<typeof ScrollView>, ScrollViewProps>(
  function KeyboardAwareScrollView(
    { keyboardShouldPersistTaps = 'handled', keyboardDismissMode = 'interactive', ...rest },
    ref,
  ) {
    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        automaticallyAdjustKeyboardInsets
        {...rest}
      />
    );
  },
);

export function KeyboardAvoidingScreen({
  keyboardVerticalOffset = 0,
  behavior = 'padding',
  ...rest
}: KeyboardAvoidingViewProps) {
  return (
    <KeyboardAvoidingView behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset} {...rest} />
  );
}
