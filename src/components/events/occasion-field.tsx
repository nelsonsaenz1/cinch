import { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme, type ThemeColors } from '@/theme/tokens';

/**
 * The labelled field the New Occasion form is built out of (N-03).
 *
 * Every row on that page — the name, the two When buttons, the place search,
 * the note — is one of the pieces below, so the label grammar and the border
 * ramp are written once and cannot drift between five fields on one screen.
 *
 * ── The border ramp ───────────────────────────────────────────────────────
 *
 * The whole point of the component. The atlas states it in prose: "Answered
 * fields darken their border rather than growing a checkmark." So a field
 * reports its own state entirely through its edge —
 *
 *   empty    1px   `rule`         nothing typed
 *   filled   1px   `rule-strong`  answered
 *   focused  1.5px `ink`          under the cursor
 *   cap      1px   `accent`       at the character limit, eyebrow turns too
 *
 * — and never through a tick, a green, or a second line of chrome. The focused
 * state is the one that has to be paid for: a border growing from 1 to 1.5
 * eats half a point of the box on each side, so the horizontal padding drops
 * from 14 to 13 and the text does not shift under the cursor. That
 * compensation is the atlas's own number, not a derivation.
 *
 * `cap` and `focused` can both be true at once — you are usually typing when
 * you reach the limit — and the atlas draws only the unfocused case. They
 * compose rather than compete: `cap` decides the colour, `focused` decides the
 * weight and the padding. Reaching the cap while typing therefore keeps the
 * heavier focused edge and turns it oxblood, which is the reading that loses
 * the least information.
 */
export type FieldTone = 'empty' | 'filled' | 'focused' | 'cap';

/** The box's own 14px inset, and the 13 it drops to under a 1.5px border. */
const PAD_X = 14;
const PAD_X_FOCUSED = 13;

/**
 * ── Vertical metrics (LP-03) ───────────────────────────────────────────────
 *
 * The accepted atlas gives the single-line field a FLEXIBLE 48pt minimum
 * height — a floor, never a height. A fixed `height` is a promise about how
 * tall a line of text is, and the app does not get to make that promise:
 * Dynamic Type at AX5 renders `text-body` well past 40pt of line box, and a
 * fixed container then clips descenders and shifts the baseline off centre.
 * That clipping IS the launch-polish bug.
 *
 * So: a minimum height, symmetric vertical padding, and no assumption about
 * the font at all. At default sizes the floor governs and the field looks
 * exactly as drawn; at accessibility sizes the text's own measured height
 * governs and the box grows under it. Nothing is derived from a point size,
 * so nothing has to be recalculated when the type scale moves. 48 also sits
 * clear of the 44pt minimum control target with the inset below to spare.
 */
const BOX_MIN_HEIGHT = 48;
/** A note field starts at three-ish lines and grows from there. */
const BOX_MIN_HEIGHT_MULTILINE = 58;
/**
 * The vertical inset, mirroring the horizontal ramp: a 1.5px focused border
 * eats half a point on each edge, so the padding gives half a point back and
 * the text does not shift under the cursor.
 */
const PAD_Y = 12;
const PAD_Y_FOCUSED = 11;

/**
 * The border and padding for a tone, as a computed style rather than classes.
 *
 * Four states that differ in colour AND width AND padding cannot be four
 * `border-*` utilities — two of the same kind on one element resolve by key
 * order in tailwind.config.js, not by intent — so the edge is one object.
 */
function boxStyle(tone: FieldTone, theme: ThemeColors, multiline: boolean): ViewStyle {
  const focused = tone === 'focused';
  const borderWidth = focused ? 1.5 : 1;
  const borderColor =
    tone === 'cap'
      ? theme.accent
      : focused
        ? theme.ink
        : tone === 'filled'
          ? theme.ruleStrong
          : theme.rule;

  return {
    borderWidth,
    borderColor,
    paddingHorizontal: focused ? PAD_X_FOCUSED : PAD_X,
    paddingVertical: focused ? PAD_Y_FOCUSED : PAD_Y,
    // A floor in both cases. The single-line field is 48 until the text needs
    // more; the note is 58 and grows with what is typed into it.
    minHeight: multiline ? BOX_MIN_HEIGHT_MULTILINE : BOX_MIN_HEIGHT,
  };
}

/**
 * The text control's own reset.
 *
 * iOS gives `UITextView` (which is what a multiline `TextInput` is) a text
 * container inset of its own, on top of whatever padding the box already
 * carries — so the note's first line sits low and its last line sits against
 * the border. Zeroing it makes the box's padding the ONLY vertical inset,
 * which is the only way the two fields can be centred by the same rule.
 */
export const INPUT_RESET = { padding: 0, margin: 0 } as const;

/** The tone a text control is in, given what is in it and whether it is focused. */
export function toneFor(value: string, focused: boolean, maxLength?: number): FieldTone {
  if (maxLength !== undefined && value.length >= maxLength) return 'cap';
  if (focused) return 'focused';
  return value.trim().length > 0 ? 'filled' : 'empty';
}

export type FieldGroupProps = {
  /** The eyebrow — `NAME`, `WHEN`. Uppercased by the variant, not by the
   *  caller. `null` omits the label row altogether. */
  label: string | null;
  /**
   * Prints `Optional` at the right of the label row. The name field is the only
   * field on the form without it, and that absence is how the atlas shows which
   * field is required — so there is deliberately no `required` marker to pair
   * with this.
   */
  optional?: boolean;
  /** Turns the eyebrow oxblood, for the at-cap state. */
  alert?: boolean;
  children: React.ReactNode;
  className?: string;
};

/**
 * The label row and whatever sits under it.
 *
 * Split out from `OccasionField` because the When row is one label over *two*
 * controls, and the place field is one label over a control plus a results
 * panel. Repeating the eyebrow per control would say there are two questions
 * where there is one.
 */
export function FieldGroup({
  label,
  optional = false,
  alert = false,
  children,
  className = '',
}: FieldGroupProps) {
  const theme = useTheme();

  // `null` omits the row entirely — for the one caller where the label is
  // already the sheet's own title and printing it twice would read as two
  // questions. An empty string would still reserve the row's height.
  if (label === null) return <View className={className}>{children}</View>;

  return (
    <View className={className}>
      {/* 8px, carried by the row rather than by a margin on the control, so a
          caller can put anything at all underneath without knowing the gap. */}
      <View className="mb-2 flex-row items-baseline justify-between">
        {/* Inline colour, never a second `text-*` class: `eyebrow` already
            carries `text-muted`, and NativeWind gives no precedence between
            two colour utilities on one element. */}
        <Text variant="eyebrow" style={alert ? { color: theme.accent } : undefined}>
          {label}
        </Text>
        {/* `noteSmall`, not `caption` — `caption` is `font-medium` and renders
            this as bold grey. `muted`, not the atlas's #C7C1B4: `ghost` is
            ~1.9:1 on canvas, an AA failure for content. It stays quieter than
            the eyebrow beside it by casing and tracking rather than contrast. */}
        {optional ? <Text variant="noteSmall">Optional</Text> : null}
      </View>
      {children}
    </View>
  );
}

export type FieldBoxProps = {
  tone: FieldTone;
  multiline?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** The bordered box itself — 12px radius, the ramp above, nothing else. */
export function FieldBox({
  tone,
  multiline = false,
  children,
  className = '',
  style,
}: FieldBoxProps) {
  const theme = useTheme();

  return (
    <View
      // `rounded-md`, like every labelled control in the app. The 12px radius
      // is also the atlas's, so there is nothing to reconcile here.
      className={`rounded-md ${multiline ? '' : 'flex-row items-center'} ${className}`}
      style={[boxStyle(tone, theme, multiline), style]}>
      {children}
    </View>
  );
}

export type FieldNoteProps = {
  children: React.ReactNode;
  /** Announce the line when it appears — the character counter does. */
  live?: boolean;
};

/** The quiet line under a control: the counter, the forecast clause. */
export function FieldNote({ children, live = false }: FieldNoteProps) {
  return (
    <View className="mt-2" accessibilityLiveRegion={live ? 'polite' : 'none'}>
      <Text variant="note">{children}</Text>
    </View>
  );
}

/**
 * The line under a control that reports something went wrong: an 8px oxblood
 * dot and the sentence in `ink`.
 *
 * Not `critical`, and not red. The atlas draws every one of these — the failed
 * save, the failed geocode — in the accent, and it is a statement about what
 * happened rather than a warning about what the user did. Ink for the sentence
 * because it is the most important text on the screen at that moment; the dot
 * carries the alarm on its own.
 */
export function FieldAlert({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <View className="mt-3 flex-row items-start gap-2.5" accessibilityLiveRegion="polite">
      <View
        className="rounded-full"
        style={{ width: 8, height: 8, marginTop: 6, backgroundColor: theme.accent }}
      />
      {/* `note` overridden to ink with an inline style — the variant carries
          `text-muted`, so a `text-ink` class here would be a second colour
          utility racing it. */}
      <Text variant="note" className="flex-1" style={{ color: theme.ink }}>
        {children}
      </Text>
    </View>
  );
}

export type FieldButtonProps = {
  /** What the control reads when it has an answer. */
  value?: string | null;
  /** What it reads when it does not — set in `faint`, the placeholder colour. */
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A control that reads as a field but opens a sheet — the date and time
 * buttons on the When row.
 *
 * It is a `FieldBox` and not a `Button` on purpose: the When row is a field
 * whose answer happens to be picked rather than typed, and drawing it as two
 * buttons would make the one optional row on the form look like the only place
 * with actions in it. It gets the same border ramp as its neighbours, so a
 * dated occasion darkens exactly the way a named one does.
 */
export function FieldButton({
  value,
  placeholder,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  className = '',
  style,
}: FieldButtonProps) {
  const theme = useTheme();
  const answered = Boolean(value);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      accessibilityValue={answered ? { text: value! } : undefined}
      disabled={disabled}
      onPress={onPress}
      className={`active:opacity-60 ${className}`}
      style={style}>
      <FieldBox tone={answered ? 'filled' : 'empty'}>
        {/* A disabled control keeps the placeholder colour rather than dimming
            the box: the time button is disabled only until a date exists, and
            a 40% box would read as broken instead of as not-yet. */}
        {/* Two lines, not one. `Sat 9 Aug` fits on one line at every size the
            atlas draws; at AX3 and above it does not, and a date the user
            cannot read is a date they cannot check. The box grows to hold it
            (see the metrics above) rather than truncating it. */}
        <Text
          variant="body"
          numberOfLines={2}
          className="flex-1"
          style={{ color: answered ? theme.ink : theme.faint }}>
          {answered ? value : placeholder}
        </Text>
      </FieldBox>
    </Pressable>
  );
}

export type OccasionFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  optional?: boolean;
  multiline?: boolean;
  /**
   * The cap, enforced at the keyboard. Validation on this form is a count and
   * never a refusal — "typing past the cap is prevented at the keyboard, so
   * the field never has to reject something already typed."
   */
  maxLength?: number;
  /**
   * Show the counter only within the last N characters. Omit it and no counter
   * ever appears. The atlas is emphatic about the threshold: "a counter that
   * watches from the first keystroke reads as a warning."
   */
  counterFrom?: number;
  /**
   * The counter's sentence. The name field passes the atlas's own wording
   * ("Names cap at 60 characters — 4 left."); the default is the generic form,
   * because a note field is not full of names.
   */
  counterCopy?: (remaining: number, cap: number) => string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  className?: string;
};

const defaultCounterCopy = (remaining: number, cap: number) =>
  `Caps at ${cap} characters — ${remaining} left.`;

/**
 * The labelled text field — N-03 assembled.
 *
 * Focus is tracked here rather than by the caller because the border ramp is
 * the component's whole job and nothing outside it needs to know. Text is
 * `body` (17), not the atlas's 15: 15 is the browser mock's default and the
 * app's control text is 17 everywhere, settled on the Stylist page.
 */
export function OccasionField({
  label,
  value,
  onChangeText,
  placeholder,
  optional = false,
  multiline = false,
  maxLength,
  counterFrom,
  counterCopy = defaultCounterCopy,
  accessibilityLabel,
  accessibilityHint,
  autoFocus,
  editable = true,
  returnKeyType,
  autoCapitalize,
  onSubmitEditing,
  className = '',
}: OccasionFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const tone = toneFor(value, focused, maxLength);
  const remaining = maxLength === undefined ? Infinity : maxLength - value.length;
  const showCounter =
    maxLength !== undefined && counterFrom !== undefined && remaining <= counterFrom;

  return (
    <FieldGroup label={label} optional={optional} alert={tone === 'cap'} className={className}>
      <FieldBox tone={tone} multiline={multiline}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          // The one sanctioned use of `faint` as text. Placeholders are the
          // app-wide convention and iOS's own, and the string is duplicated by
          // the label above it.
          placeholderTextColor={theme.faint}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          autoFocus={autoFocus}
          editable={editable}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          onSubmitEditing={onSubmitEditing}
          // The type scale by class; the colour inline, for the reason recorded
          // throughout this file.
          //
          // `flex-1` on the SINGLE-LINE field so the caret reaches the far
          // edge, and deliberately NOT on the note: `flex-1` is
          // `flex-basis: 0`, which tells the parent this child contributes no
          // height — a note that grows would then grow inside a box that does
          // not. `w-full` gives the same full width and lets the measured text
          // drive the box, which is what "the note grows naturally" means.
          className={`font-body text-body ${multiline ? 'w-full' : 'flex-1'}`}
          style={{ color: theme.ink, ...INPUT_RESET }}
        />
      </FieldBox>
      {showCounter ? (
        <FieldNote live>{counterCopy(Math.max(remaining, 0), maxLength!)}</FieldNote>
      ) : null}
    </FieldGroup>
  );
}
