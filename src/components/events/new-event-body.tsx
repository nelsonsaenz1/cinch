import { SymbolView } from 'expo-symbols';
import type { RefObject } from 'react';
import { useEffect } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { formatMinutes } from '@/components/events/time-sheet';
import {
  KeyboardAvoidingScreen,
  KeyboardAwareScrollView,
} from '@/components/ui/keyboard-aware-scroll-view';
import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  canCreateEvent,
  CHECK_RADIUS,
  CHECK_TILE,
  COPY,
  CTA_MIN_HEIGHT,
  CTA_RADIUS,
  dateRowValue,
  GUEST_DISC,
  guestDiscs,
  guestSummary,
  NAME_MAX,
  ROW_GAP,
  ROW_GAP_LARGE,
  ROW_MIN_HEIGHT,
  ROW_RADIUS,
  TITLE_SIZE_NAMED,
  TITLE_SIZE_PROMPT,
  venueRowValue,
} from '@/features/events/new-event-spec';
import { capTrim, leading } from '@/theme/font-metrics';
import { GUTTER, MIN_TAP_TARGET, useTheme, warningAlpha } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

/**
 * New Event — the drawn surface. Redesign 02, accepted 2026-08-17.
 *
 * Split from the route for the reason every other rebuilt page in this repo
 * is: a screen that reaches for `useCreateEvent` and an AsyncStorage draft at
 * the top cannot be posed, and a state nobody can open is a state nobody
 * checks. Everything here is a function of the `view` object, so
 * `dev-ne-01…06` draw the six accepted frames out of `new-event-fixtures.ts`
 * without a session, a network, or one writable row on the other end.
 *
 * ── WHAT THE SHEET IS ─────────────────────────────────────────────────────
 *
 * A sheet-based composer, not a form. The serif title IS the name field — it
 * stands as the prompt "What's the occasion?" until somebody answers it — and
 * everything below is a generous tappable row that opens exactly one question.
 * An answered row tints `blush`, takes a clay uppercase eyebrow over its value
 * and carries a small oxblood check tile; an unanswered row sits on `tray` and
 * prints its label. That is the whole state vocabulary, and it is why nothing
 * on this page needs a hint, a helper line or a red border.
 *
 * The page spends ONE oxblood ground: the CTA. The check tiles are 20pt marks,
 * which is what the artifact draws and what the constitution means by the
 * distinction between a mark and a ground.
 *
 * ── LARGE TYPE ────────────────────────────────────────────────────────────
 *
 * `large` is the accepted AX3 frame, not a smaller version of the standard
 * one. Rows stop being label-beside-mark and become label-over-value across
 * the full measure; the check tile stands down, because at that size it is
 * furniture competing with the reader's own words for the same points; values
 * stop truncating and are allowed to wrap; the CTA grows and the rows scroll
 * under a ruled footer. Nothing is capped, ellipsised or scaled below its
 * documented size, and NOTHING on this page has a fixed height — the clipping
 * bug this page is known for was a `height` standing where a `minHeight`
 * belonged.
 */

export type NewEventView = {
  /** The occasion's name. Empty is the prompt state, not an error. */
  name: string;
  onChangeName: (name: string) => void;
  nameRef?: RefObject<TextInput | null>;
  onCancel: () => void;

  /** Null is a real answer: an event may float with no date at all. */
  day: Date | null;
  onPickDate: () => void;
  /** Minutes from midnight, or null. Meaningless without a day. */
  minutes: number | null;
  onPickTime: () => void;

  venueName: string;
  venueAddress: string | null;
  onPickVenue: () => void;

  /** Display names, in the order the host chose them. */
  guestNames: readonly string[];
  onPickGuests: () => void;

  note: string;
  onEditNote: () => void;

  onCreate: () => void;
  /** The insert is in flight: the sheet holds its shape and dims. */
  pending: boolean;
  /** One sentence, or null. Present only after a create actually failed. */
  error: string | null;
};

/** The dimming the loading frame applies to the chrome and to the rows. */
const DIM_CHROME = 0.4;
const DIM_ROWS = 0.45;

export function NewEventBody({ view, large = false }: { view: NewEventView; large?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const named = view.name.trim().length > 0;
  const live = canCreateEvent(view.name, view.pending);
  const gap = large ? ROW_GAP_LARGE : ROW_GAP;

  const date = dateRowValue(view.day);
  const time = view.minutes === null ? null : formatMinutes(view.minutes);
  const venue = venueRowValue(view.venueName, view.venueAddress);
  const guests = guestSummary(view.guestNames);
  const note = view.note.trim() || null;

  return (
    <View className="flex-1 bg-canvas">
      {/* Cancel, the chrome mark, and a spacer holding the mark centred. The
          spacer goes at the accessibility sizes: two things that cannot both
          fit are not laid out with a third between them. */}
      <View
        className="flex-row items-center justify-between px-gutter"
        style={{ paddingTop: 14, gap: 12, opacity: view.pending ? DIM_CHROME : 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={COPY.cancel}
          onPress={view.onCancel}
          disabled={view.pending}
          hitSlop={12}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', flexShrink: 0 }}
          className="active:opacity-60">
          <Text variant="body" style={{ color: theme.accent }}>
            {COPY.cancel}
          </Text>
        </Pressable>
        {/* CLAY, IN THE ARTIFACT — `muted` here, and everywhere this page
            draws an eyebrow. `accentWarm` is 2.98:1 on canvas and 2.71:1 on
            blush, and `theme/contrast.ts` declares it `text: false` with the
            reason in as many words: "Fills, chart halves and `blush`; never
            type." The constitution's census names the remedy too — "a lane
            that needs a new entry is a lane that should have used `muted`" —
            so this is the one place the frames are overruled, by a constraint
            the directive lists as surviving every redesign. The variant
            carries `muted` itself; there is nothing to set. */}
        <Text variant="eyebrow">{COPY.eyebrow}</Text>
        {large ? null : <View style={{ width: 52, flexShrink: 0 }} />}
      </View>

      {/* `flex-1` is load-bearing: a ScrollView declares no flex of its own, so
          inside this column it would size to its CONTENT — and a scroll view
          whose frame equals its content scrolls nowhere. At the accessibility
          sizes that is the difference between a usable sheet and a cut one. */}
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        <TitleField
          name={view.name}
          onChangeName={view.onChangeName}
          nameRef={view.nameRef}
          pending={view.pending}
          named={named}
        />

        <View
          style={{
            paddingHorizontal: GUTTER,
            gap,
            opacity: view.pending ? DIM_ROWS : 1,
          }}>
          {/* The name row exists only while the title is still the prompt. Once
              there is a name the serif above IS the answer, and a tray row
              repeating the question would be the same ask twice. */}
          {named ? null : (
            <FieldRow
              label={COPY.name}
              value={null}
              onPress={() => view.nameRef?.current?.focus()}
              large={large}
              accessibilityLabel={COPY.name}
            />
          )}

          <FieldRow
            label={COPY.date}
            hint={COPY.optional}
            value={date}
            onPress={view.onPickDate}
            disabled={view.pending}
            large={large}
            accessibilityLabel={COPY.date}
          />

          <FieldRow
            label={COPY.time}
            hint={COPY.optional}
            value={time}
            onPress={view.onPickTime}
            // A time with no day is not an answer to anything, and the write
            // has nowhere to put it — `startsAt` is one instant built from
            // both halves. The row is drawn exactly as the frame draws it and
            // says why it cannot act, rather than dimming into something that
            // reads as broken.
            disabled={view.pending || view.day === null}
            accessibilityHint={view.day === null ? COPY.timeNeedsDate : undefined}
            large={large}
            accessibilityLabel={COPY.time}
          />

          <FieldRow
            label={COPY.venue}
            value={venue}
            onPress={view.onPickVenue}
            disabled={view.pending}
            large={large}
            accessibilityLabel={COPY.venue}
          />

          <GuestRow view={view} summary={guests} large={large} />

          <FieldRow
            label={COPY.note}
            value={note}
            onPress={view.onEditNote}
            disabled={view.pending}
            large={large}
            // The note is the group's, not the host's aside — the label alone
            // does not say whose note it is or who reads it.
            accessibilityLabel="Note for the group"
            // The one answered row the artifact leaves on `tray` with a muted
            // eyebrow: it is prose rather than a picked fact, and it carries
            // no check tile.
            tone="quiet"
          />
        </View>
      </KeyboardAwareScrollView>

      {/* `KeyboardAvoidingScreen` wraps the footer ALONE so the CTA rides above
          the keyboard and stays tappable — the accepted keyboard frame — while
          the scroll above keeps insetting itself. Two mechanisms, one thing
          each, never compounding. */}
      <KeyboardAvoidingScreen>
      <View
        className="bg-canvas px-gutter"
        style={{
          paddingTop: 16,
          // The artifact's 26pt floor under the CTA, raised by the home
          // indicator where there is one rather than added on top of it.
          paddingBottom: Math.max(insets.bottom, 26),
          gap: 14,
          // The rule appears only where content actually runs under the
          // footer, which at standard sizes it does not.
          ...(large ? { borderTopWidth: 1, borderTopColor: theme.tray } : null),
        }}>
        {view.error ? <ErrorNotice sentence={view.error} /> : null}
        <CreateButton
          label={view.error ? COPY.tryAgain : COPY.create}
          enabled={live}
          pending={view.pending}
          onPress={view.onCreate}
        />
      </View>
      </KeyboardAvoidingScreen>
    </View>
  );
}

/**
 * The serif title, which is the name field.
 *
 * The prompt is the field's PLACEHOLDER, in ink rather than the placeholder
 * grey every other field uses — the frame draws "What's the occasion?" at full
 * strength because it is the page's headline as well as its first question,
 * and a grey headline would read as a disabled control.
 *
 * Multiline, because a name that wraps is the frame's own default state, and
 * `submitBehavior` is what gives a multiline field a Done key that dismisses
 * rather than typing a newline into somebody's event name.
 */
function TitleField({
  // Destructured rather than read off `view` in the JSX: `react-hooks/refs`
  // reads a `ref={obj.x}` as a claim that `obj` is itself a ref, and then
  // reports every other property of it as a ref access during render.
  name,
  onChangeName,
  nameRef,
  pending,
  named,
}: {
  name: string;
  onChangeName: (name: string) => void;
  nameRef: NewEventView['nameRef'];
  pending: boolean;
  named: boolean;
}) {
  const theme = useTheme();
  const size = named ? TITLE_SIZE_NAMED : TITLE_SIZE_PROMPT;
  const line = leading('instrument', size, named ? 1.12 : 1.08);

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 }}>
      <TextInput
        ref={nameRef}
        value={name}
        onChangeText={onChangeName}
        editable={!pending}
        placeholder={COPY.prompt}
        placeholderTextColor={theme.ink}
        accessibilityLabel="Name of the occasion"
        maxLength={NAME_MAX}
        multiline
        // A Done key that blurs rather than typing a newline into a name.
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        // Display type in a cell the layout draws around it — the same ceiling
        // `Text` applies to `variant="display"`, which a raw TextInput does not
        // inherit.
        maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
        className="font-display"
        style={{
          color: theme.ink,
          fontSize: size,
          lineHeight: line,
          padding: 0,
          margin: 0,
          // The serif's 1.30 line box is trimmed to the cap height so the
          // title sits where the frame puts it; the glyph box is untouched,
          // which is what keeps descenders whole.
          ...capTrim('instrument', size, line),
          // …and given back below the baseline, because `g`, `y` and `p` all
          // occur in the frame's own fixture name.
          paddingBottom: 6,
        }}
      />
    </View>
  );
}

/**
 * One row of the composer.
 *
 * Three parts, all of them stated: the text column grows AND shrinks
 * (`flex: 1` with `minWidth: 0`), the check tile keeps its points
 * (`flexShrink: 0`), and the value truncates at standard size only. Declaring
 * only one of the three is the defect People Search was rebuilt to close, and
 * it is the same defect here — a long venue name and a 20pt tile negotiating
 * the same measure with neither of them saying which gives.
 */
function FieldRow({
  label,
  hint,
  value,
  onPress,
  disabled = false,
  large,
  accessibilityLabel,
  accessibilityHint,
  tone = 'answered',
}: {
  label: string;
  hint?: string;
  value: string | null;
  onPress: () => void;
  disabled?: boolean;
  large: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** `quiet` is the note's ground: answered, but on tray with a muted eyebrow
   *  and no mark. The artifact draws exactly one row that way. */
  tone?: 'answered' | 'quiet';
}) {
  const theme = useTheme();
  const answered = value !== null;
  const quiet = tone === 'quiet';

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={answered ? { text: value } : undefined}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: ROW_RADIUS,
        // A FLOOR. Never a height — this is the page whose launch-polish bug
        // was a fixed row clipping descenders at the accessibility sizes.
        minHeight: ROW_MIN_HEIGHT,
        backgroundColor: answered && !quiet ? theme.blush : theme.tray,
      }}
      contentStyle={{
        // The row's own content box. `flex: 1` fills the target; `minWidth: 0`
        // is what lets everything inside it actually shrink — the same pair,
        // for the same reason, as the value column below.
        flex: 1,
        minWidth: 0,
        flexDirection: large || !answered ? 'column' : 'row',
        alignItems: large || !answered ? 'stretch' : 'center',
        justifyContent: 'center',
        gap: answered ? (large ? 6 : 14) : 0,
        paddingHorizontal: large ? 20 : 18,
        paddingTop: large ? 16 : 13,
        // More below than above, on every row: the descender of a `g` or a `y`
        // lands under the baseline and the frame's own note says so.
        paddingBottom: large ? 20 : 15,
      }}>
      {answered ? (
        <>
          <View style={{ flex: large ? undefined : 1, minWidth: 0, gap: large ? 6 : 2 }}>
            {/* `muted`, from the variant — see the note on the chrome mark
                above for why the artifact's clay does not survive here. */}
            <Text variant="eyebrow" numberOfLines={large ? undefined : 1}>
              {label}
            </Text>
            <Text
              variant="body"
              numberOfLines={large ? undefined : 1}
              style={{
                fontSize: quiet ? 16 : 19,
                lineHeight: quiet ? 23 : 26,
                color: theme.ink,
              }}>
              {value}
            </Text>
          </View>
          {/* The mark stands down at the accessibility sizes and on the quiet
              row — the frame's own answer, and the honest one: 20 points of
              furniture is not worth a line of somebody's venue. */}
          {quiet || large ? null : <CheckTile />}
        </>
      ) : (
        <View
          style={{
            flexDirection: large ? 'column' : 'row',
            alignItems: large ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: large ? 4 : 12,
          }}>
          <Text
            variant="body"
            style={{ fontSize: 17, lineHeight: 23, color: theme.muted, flexShrink: 1 }}>
            {label}
          </Text>
          {hint ? (
            <Text
              variant="label"
              style={{ fontSize: 15, lineHeight: 21, color: theme.muted, flexShrink: 0 }}>
              {hint}
            </Text>
          ) : null}
        </View>
      )}
    </PressableSurface>
  );
}

/** The answered mark: a 20pt oxblood square carrying one white check. */
function CheckTile() {
  const theme = useTheme();
  return (
    <View
      style={{
        width: CHECK_TILE,
        height: CHECK_TILE,
        borderRadius: CHECK_RADIUS,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <SymbolView
        name="checkmark"
        size={11}
        tintColor={theme.canvas}
        resizeMode="scaleAspectFit"
      />
    </View>
  );
}

/**
 * Who's going — the one answered row drawn as faces rather than as a value.
 *
 * Three discs and an overflow tile, with the given names beside them. No check
 * tile: the discs ARE the mark, and a tick beside four faces would be the
 * screen saying the same thing twice.
 */
function GuestRow({
  view,
  summary,
  large,
}: {
  view: NewEventView;
  summary: string | null;
  large: boolean;
}) {
  const theme = useTheme();

  if (summary === null) {
    return (
      <FieldRow
        label={COPY.guests}
        value={null}
        onPress={view.onPickGuests}
        disabled={view.pending}
        large={large}
        accessibilityLabel={COPY.guests}
      />
    );
  }

  const { initials, overflow } = guestDiscs(view.guestNames);

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={COPY.guests}
      accessibilityValue={{ text: summary }}
      disabled={view.pending}
      onPress={view.onPickGuests}
      style={{
        borderRadius: ROW_RADIUS,
        minHeight: ROW_MIN_HEIGHT,
        backgroundColor: theme.blush,
      }}
      contentStyle={{
        flex: 1,
        minWidth: 0,
        gap: large ? 10 : 8,
        paddingHorizontal: large ? 20 : 18,
        paddingTop: large ? 16 : 12,
        paddingBottom: large ? 20 : 14,
      }}>
      <Text variant="eyebrow">{COPY.guests}</Text>
      <View
        style={{
          flexDirection: large ? 'column' : 'row',
          alignItems: large ? 'flex-start' : 'center',
          gap: 10,
        }}>
        <View style={{ flexDirection: 'row', gap: 10, flexShrink: 0 }}>
          {[...initials, ...(overflow ? [overflow] : [])].map((mark, i) => (
            <View
              key={`${mark}:${i}`}
              style={{
                width: GUEST_DISC,
                height: GUEST_DISC,
                borderRadius: GUEST_DISC / 2,
                backgroundColor: theme.sand,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
              <Text variant="label" style={{ fontSize: 12, lineHeight: 16, color: theme.ink }}>
                {mark}
              </Text>
            </View>
          ))}
        </View>
        <Text
          variant="label"
          numberOfLines={large ? undefined : 1}
          style={{
            fontSize: 15,
            lineHeight: 21,
            color: theme.muted,
            flex: large ? undefined : 1,
            minWidth: 0,
          }}>
          {summary}
        </Text>
      </View>
    </PressableSurface>
  );
}

/**
 * The create failed, and nothing was lost.
 *
 * Warmed amber, derived from the palette's own `warning` at an alpha rather
 * than eyedropped out of the artifact — the same move People Search's OFFLINE
 * pill makes, and for the same reason: `warning` is a fill, the contrast
 * record says ink goes on it, and a fourth amber nobody can trace is how a
 * palette stops being one.
 */
function ErrorNotice({ sentence }: { sentence: string }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: warningAlpha(0.22),
      }}>
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          marginTop: 6,
          backgroundColor: theme.warning,
          flexShrink: 0,
        }}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="body" style={{ fontSize: 15, lineHeight: 21, color: theme.ink }}>
          {COPY.errorTitle}
        </Text>
        <Text variant="label" style={{ fontSize: 14, lineHeight: 20, color: theme.ink }}>
          {sentence}
        </Text>
      </View>
    </View>
  );
}

/**
 * The page's one oxblood ground.
 *
 * Three states, all drawn by the artifact: sand-on-sand while there is no name
 * to create anything with, oxblood once there is, and — while the insert is in
 * flight — a blush track under a clay fill that moves. The fill is
 * indeterminate rather than a percentage, because the insert reports no
 * progress and a bar claiming 62% of one would be inventing it; under Reduce
 * Motion the animation settles instead of looping, which `ReduceMotion.System`
 * handles a layer below this file.
 */
function CreateButton({
  label,
  enabled,
  pending,
  onPress,
}: {
  label: string;
  enabled: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = pending
      ? withRepeat(
          withTiming(1, { duration: 1100, reduceMotion: ReduceMotion.System }),
          -1,
          false,
        )
      : 0;
  }, [pending, sweep]);

  const fill = useAnimatedStyle(() => ({ width: `${18 + sweep.value * 82}%` }));

  if (pending) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={COPY.creating}
        style={{
          minHeight: CTA_MIN_HEIGHT,
          borderRadius: CTA_RADIUS,
          backgroundColor: theme.blush,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}>
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.accentWarm },
            fill,
          ]}
        />
        <Text variant="body" style={{ color: theme.canvas }}>
          {COPY.creating}
        </Text>
      </View>
    );
  }

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled}
      // The commit haptic belongs to the SERVER's answer, not to the tap —
      // the route fires `haptics.success()` on the insert coming back. Nothing
      // here.
      onPress={onPress}
      style={{
        borderRadius: CTA_RADIUS,
        backgroundColor: enabled ? theme.accent : theme.sand,
      }}
      contentStyle={{
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: CTA_MIN_HEIGHT,
        paddingHorizontal: 20,
        paddingVertical: 16,
      }}>
      <Text
        variant="body"
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        style={{ color: enabled ? theme.canvas : theme.byline }}>
        {label}
      </Text>
    </PressableSurface>
  );
}
