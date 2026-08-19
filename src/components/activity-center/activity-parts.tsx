import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  BACK_TILE,
  BACK_TILE_RADIUS,
  CLEAR_BAR_HEIGHT,
  CLEAR_BAR_RADIUS,
  MASTHEAD_TITLE_GAP,
  NOTE_RADIUS,
  REMOVE_DISC,
} from '@/features/activity-center/activity-spec';
import {
  CLEAR_ALL,
  EDIT,
  EDIT_DONE,
  EDIT_NOTE,
  FOOTER_MARK,
  FOOTER_PRIVACY,
  NAV_TITLE,
  RETENTION_NOTE,
  ROW_REMOVE,
} from '@/features/activity-center/copy';
import { haptics } from '@/lib/haptics';
import { capTrim, leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * What `variant="display" trim` takes off the top, in points — the same call
 * `components/ui/text.tsx` makes to build its `TRIMS` table, read here rather
 * than copied as a digit so the two can never drift.
 *
 * Negative by construction: the trim exists to collapse Instrument Serif's tall
 * line box to the cap height. Adding it back below is what turns
 * `MASTHEAD_TITLE_GAP` from a margin nobody can predict into the gap the reader
 * actually sees.
 */
const DISPLAY_TRIM_TOP = capTrim('instrument', 40, leading('instrument', 40, 1.05)).marginTop;

/**
 * The furniture of redesign 28's Activity page — everything that is not a row.
 *
 * Split out of `app/activity.tsx` so the eight `dev-av-*` fixtures can pose the
 * page against the components the app actually mounts rather than against a
 * second drawing of them. Same parts idiom as `components/circles/room-parts`
 * and `components/stylist/sheet-parts`.
 */

// ---------------------------------------------------------------------------
// The masthead
// ---------------------------------------------------------------------------

/**
 * The back tile and the serif title — redesign 28's own header, and the first
 * thing every frame draws.
 *
 * ── A TILE, NOT THE APP'S 36pt DISC ───────────────────────────────────────
 *
 * `ScreenHeader`'s `BackButton` is a 36pt hairline-bordered circle, and it is
 * what nine other pushed screens carry. This page draws a 44pt rounded square
 * filled with `tray` instead, because that is what every frame in the atlas
 * shows and because the reasoning is visible once the page is on screen: this
 * is a column of 44pt DISCS, and a 36pt disc in the corner above them reads as
 * the first row of the list rather than as the way out. The square is the one
 * shape on the page that is not a row.
 *
 * The tile is 44 square, so the visual size IS the tap target and there is no
 * `hitSlop` compensating for a control drawn under the floor.
 *
 * ── EDIT IS DRAWN, THOUGH THE DEFAULT FRAME OMITS IT ──────────────────────
 *
 * `activity-list-populated-new-and-earlier` shows no Edit control; only
 * `edit-mode-visible-row-removal` shows `Done`. Taken literally that leaves Edit
 * mode unreachable, and Edit mode is not a convenience — §11's gesture rule says
 * swipe-to-dismiss and long-press each need a visible equivalent, and this pair
 * is it. A surface whose only way to remove a row is a swipe is a surface a
 * VoiceOver user cannot clear. So `Edit` is drawn where `Done` is drawn, in the
 * same oxblood, and the deviation is listed rather than silently taken.
 */
export function ActivityMasthead({
  editing,
  onToggleEdit,
  onBack,
}: {
  /** Absent entirely on an empty, loading or failed page — see `app/activity.tsx`. */
  onToggleEdit?: () => void;
  editing: boolean;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="px-gutter pt-1">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          className="items-center justify-center bg-tray active:opacity-60"
          style={{ width: BACK_TILE, height: BACK_TILE, borderRadius: BACK_TILE_RADIUS }}>
          <SymbolView name="chevron.left" size={17} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>

        {onToggleEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? EDIT_DONE : EDIT}
            accessibilityHint={editing ? undefined : 'Reveals Remove on each item, and Clear all'}
            onPress={() => {
              haptics.selection();
              onToggleEdit();
            }}
            hitSlop={10}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            <Text style={{ fontSize: 17, color: theme.accent }}>{editing ? EDIT_DONE : EDIT}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* The gap is carried by a wrapper, not by a class on the title.
          `mt-3` on the Text itself was competing with the trim's own negative
          `marginTop` on the same element — twelve minus eleven, one point of
          air, and the two touched. Outside the trim, the number means what it
          says. See `MASTHEAD_TITLE_GAP`. */}
      <View style={{ marginTop: MASTHEAD_TITLE_GAP - DISPLAY_TRIM_TOP }}>
        <Text variant="display" trim accessibilityRole="header">
          {NAV_TITLE}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The section heading
// ---------------------------------------------------------------------------

/**
 * `NEW` · `EARLIER` — the tracked eyebrow, in OXBLOOD.
 *
 * Not `SectionHeader`, and the one difference is the whole reason: that
 * component sets `variant="eyebrow"`, which is `muted` by contract, and every
 * frame here sets these headings in the accent. It is the redesign's "colour
 * becomes structural" in the smallest possible dose — two words per page, at
 * 11px, marking the one boundary on the surface that means anything (unseen
 * from seen). `accent` on `canvas` is 8.6:1, so it clears AA at this size with
 * room to spare; `eyebrow`'s own tracking, casing and size are untouched.
 *
 * `trailing` carries the oldest section's Show / Hide. When it is present the
 * WHOLE heading is one button — the label and the word are a single accessible
 * element with `expanded` on it, so VoiceOver announces the state without the
 * reader having to find a separate 40-point control at the end of a row.
 */
export function ActivitySectionHeading({
  title,
  toggleLabel,
  expanded,
  onToggle,
  className = '',
}: {
  title: string;
  /** `Show` / `Hide`. Absent on a section that does not fold. */
  toggleLabel?: string;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const theme = useTheme();

  const label = (
    <Text variant="eyebrow" style={{ color: theme.accent }}>
      {title}
    </Text>
  );

  if (!toggleLabel || !onToggle) {
    return (
      <View className={`px-gutter ${className}`} accessibilityRole="header">
        {label}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${toggleLabel}`}
      accessibilityState={{ expanded }}
      onPress={() => {
        haptics.selection();
        onToggle();
      }}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center justify-between px-gutter active:opacity-60 ${className}`}>
      {label}
      <Text style={{ fontSize: 17, color: theme.accent }}>{toggleLabel}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The colophon
// ---------------------------------------------------------------------------

/**
 * `PRIVATE TO YOU · KEPT 30 DAYS`, pinned to the foot of the screen.
 *
 * ── IT IS IN EVERY STATE NOW, AND THAT IS THE POINT ───────────────────────
 *
 * It shipped inside the scroll view, under the last row, so it existed only on
 * a populated page. Every frame in redesign 28 — empty, loading, failed,
 * offline, editing — carries it at the same height off the home indicator, and
 * the loading frame's caption says why: "the colophon holds its position so the
 * page does not jump when content lands."
 *
 * There is also a claim in it that matters MOST on the states that used to lack
 * it. A reader looking at a blank inbox or a failed read is entitled to know
 * that this surface is theirs alone and that its window is thirty days; those
 * are exactly the two questions an empty inbox raises.
 *
 * ── THE TWO SENTENCES SURVIVE VERBATIM ────────────────────────────────────
 *
 * `FOOTER_PRIVACY` and `RETENTION_NOTE` are the real copy; the colophon is
 * their mark. Both hang on this element's `accessibilityLabel`, unchanged, so a
 * screen reader is still told the whole of both rather than five tracked words.
 * That arrangement is inherited exactly as shipped and is the reason the
 * thirty-day line can be a colophon at all.
 */
export function ActivityColophon() {
  return (
    <View
      accessible
      accessibilityLabel={`${FOOTER_PRIVACY} ${RETENTION_NOTE}`}
      className="px-gutter pb-1 pt-3">
      <Text variant="colophon">{FOOTER_MARK}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

/** The scope note above the list while Edit is on. See `EDIT_NOTE` for why it exists. */
export function ActivityEditNote() {
  return (
    <View
      accessibilityRole="summary"
      className="mx-gutter mt-3 bg-tray px-4 py-3.5"
      style={{ borderRadius: NOTE_RADIUS }}>
      <Text variant="body" className="text-muted" style={{ fontSize: 15, lineHeight: 21 }}>
        {EDIT_NOTE}
      </Text>
    </View>
  );
}

/**
 * Edit mode's Clear all bar — a 56pt tinted block above the colophon.
 *
 * TINTED, NOT FILLED, and the label is the only oxblood on it. The redesign
 * asks for primaries with presence, and this is a primary; it is also the one
 * irreversible control on the surface, and a solid oxblood block at the foot of
 * an inbox is a page that looks like it is about to delete something. The tint
 * plus the accent label is how the app already draws a destructive action that
 * has a confirmation behind it — the sheet is where the weight belongs, and it
 * is where `destructiveConfirm()` fires.
 */
export function ActivityClearAllBar({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <View className="px-gutter pt-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CLEAR_ALL}
        accessibilityHint="Opens a confirmation. Clearing cannot be undone."
        onPress={() => {
          // §10 asks for a warning on present — the reader is being shown
          // something irreversible, before they have chosen it.
          haptics.warning();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}>
        <Animated.View
          style={[
            press.style,
            {
              height: CLEAR_BAR_HEIGHT,
              borderRadius: CLEAR_BAR_RADIUS,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.tray,
            },
          ]}>
          <Text style={{ fontSize: 17, color: theme.accent }}>{CLEAR_ALL}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * The per-row Remove disc Edit mode reveals.
 *
 * ── A GLYPH, WHICH THE SHIPPED ROW REFUSED ────────────────────────────────
 *
 * The previous build drew this as the WORD "Remove" and argued it: "a glyph
 * here would be the one destructive control on the page identified by shape
 * alone." That argument is answered rather than overruled. Every frame in
 * redesign 28 draws the minus disc, and it is safe here because the shape is
 * not the only carrier — the control's `accessibilityLabel` is
 * `Remove — <the row's whole sentence>`, so a reader who cannot see the disc is
 * told both the verb and exactly which row it belongs to, which is more than
 * the bare word ever said. The disc is 28pt with a 44pt hit target.
 *
 * `armed` paints it oxblood: the frame shows one row's disc filled, which is
 * the row whose removal is a tap away. It is a press state, not a mode.
 */
export function ActivityRemoveDisc({
  onPress,
  label,
  armed = false,
}: {
  onPress: () => void;
  /** The composed `Remove — <sentence>` label. Never the bare verb. */
  label: string;
  armed?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.commit();
        onPress();
      }}
      hitSlop={(MIN_TAP_TARGET - REMOVE_DISC) / 2}
      className="items-center justify-center active:opacity-70"
      style={{
        width: REMOVE_DISC,
        height: REMOVE_DISC,
        borderRadius: REMOVE_DISC / 2,
        backgroundColor: armed ? theme.accent : theme.tray,
      }}>
      {/* The minus, drawn as a bar rather than set as a hyphen: a text glyph
          here scales with Dynamic Type and turns the disc into an ellipse. */}
      <View
        style={{
          width: 12,
          height: 1.6,
          borderRadius: 1,
          backgroundColor: armed ? theme.canvas : theme.muted,
        }}
      />
    </Pressable>
  );
}

/** The label a Remove disc announces — the verb, then the row it belongs to. */
export const removeLabel = (spoken: string): string => `${ROW_REMOVE} — ${spoken}`;
