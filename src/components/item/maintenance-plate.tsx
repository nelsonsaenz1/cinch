import { SymbolView } from 'expo-symbols';
import { Fragment } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type MaintenanceRow = {
  label: string;
  /**
   * The sentence UNDER the label — optional, and mostly absent.
   *
   * The plate carried one on every row, and five stacked explanations at the
   * foot of a page about a garment is prose where a list should be. A caption
   * is now spent where the tap has a consequence the label does not name: the
   * destructive row, and the listing-photo row whose caption is live data
   * (which retailer the image came from). Everything else says what it does in
   * its own label, and its old sentence rides `hint` for a screen reader.
   */
  caption?: string;
  /**
   * The VoiceOver hint, when it is not the caption.
   *
   * Rows that dropped their visible sentence pass it here verbatim, so nothing
   * a reader could have read is lost to someone who cannot see the row at all.
   * Falls back to `caption` for the two rows that still print one.
   */
  hint?: string;
  onPress: () => void;
  tone?: 'ink' | 'accent';
  loading?: boolean;
};

export type MaintenancePlateProps = { rows: MaintenanceRow[] };

/**
 * The plate's radius — `plate`, 20, which is what `Card` draws anyway.
 *
 * WAS 14, on the stated ground that it "is between `md` (12) and `lg` (16) and
 * is not a token". That was the argument for the value, and reference board C
 * withdraws it: every container resolves to a documented flat band, `md`,
 * `plate` or `sheet`, and there is no in-between radius to be between.
 *
 * Kept as an inline style rather than deleted in favour of Card's own class
 * because a `rounded-plate` utility here would land beside Card's with no
 * guaranteed precedence — the same coin-toss hazard the text variants
 * document. An inline style always wins, and now it wins with the right value.
 */
const PLATE_RADIUS = 20;

/**
 * The header strip's ground. #F5F1E9 sits between `canvas` (#FBFAF6) and
 * `tray` (#F0ECE3) and has no token — taken straight from the atlas, and
 * deliberately NOT promoted: one strip on one screen does not earn a fourth
 * warm surface in a palette that already has three.
 */
const STRIP_GROUND = '#F5F1E9';

/**
 * The row label — 15px medium, per the atlas.
 *
 * `label` is the right VOICE (HelveticaNeue-Medium) at the wrong size (13px),
 * so only the size and the colour move, inline. Both have to be inline: a
 * second `text-*` class for either would collide with the variant's own.
 */
const LABEL_STYLE = { fontSize: 15, lineHeight: leading('helvetica', 15, 1.35) };
/** The caption — 12px against `caption`'s 11px; same reasoning as the label. */
const CAPTION_STYLE = { fontSize: 12, lineHeight: leading('helvetica', 12, 1.4) };

/**
 * One row of the maintenance plate: a named action, the sentence that says
 * what it does, and a chevron — or a spinner while it is happening.
 *
 * Same shape as the account screen's `AccountRow` (app/profile.tsx), which is
 * the app's established grammar for "a list of things you can do". The caption
 * is where a consequence gets said before anybody taps — a sentence read
 * BEFORE the tap costs nothing, where a dialog after it trains the thumb to
 * dismiss — but it is drawn ONLY when the caller passes one: a row whose label
 * already says what it does was, five times over, a paragraph. Without it the
 * row is a clean single line and keeps its 44pt floor from `minHeight`, so the
 * plate's rhythm does not change. `tone="accent"` is the destructive one,
 * matching Delete account rather than introducing a second destructive colour.
 *
 * Disabled while loading, so a slow re-read cannot be fired twice — the server
 * would refuse the second with a 409 anyway, but a control that visibly does
 * nothing is worse than one that is visibly busy. `accessibilityState` says
 * both `busy` and `disabled`, because VoiceOver has no way to see the spinner.
 */
function Row({ label, caption, hint, onPress, tone = 'ink', loading = false }: MaintenanceRow) {
  const theme = useTheme();
  const accent = tone === 'accent';
  // The atlas draws the chevron at 35% ink (and 45% oxblood on the destructive
  // row) — `faint` and `accent` are the tokenised equivalents, and are what
  // every other chevron in the app already uses.
  const iconColor = accent ? theme.accent : theme.faint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint ?? caption}
      accessibilityState={{ busy: loading, disabled: loading }}
      onPress={onPress}
      disabled={loading}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center justify-between gap-3 px-[14px] py-[13px] active:opacity-60">
      <View className="flex-1">
        <Text
          variant="label"
          style={{ ...LABEL_STYLE, color: accent ? theme.accent : theme.ink }}>
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" className="mt-0.5" style={CAPTION_STYLE}>
            {caption}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <SymbolView name="chevron.right" size={13} tintColor={iconColor} resizeMode="scaleAspectFit" />
      )}
    </Pressable>
  );
}

/**
 * The bordered plate of things done TO a piece — I-01's MAINTENANCE block.
 *
 * The atlas puts this at the very bottom, inside its own frame, under a header
 * strip that names it. That is not decoration: everything above on this page is
 * a reading of the garment, and this is the one region where a tap changes or
 * destroys it. The strip and the border are the boundary — "where nothing is
 * reached by accident", in the atlas's own words — so the destructive row is
 * never adjacent to something a browsing thumb might be aiming at.
 *
 * Purely presentational. Every row is a label, a sentence and a callback; what
 * the callback does, whether it is allowed to exist for this item, and the
 * order they appear in are all the caller's.
 *
 * LAYOUT CONTRACT: carries its own `mx-gutter`, matching the other blocks on
 * the rebuilt page. Expects a full-bleed parent.
 */
export function MaintenancePlate({ rows }: MaintenancePlateProps) {
  if (rows.length === 0) return null;

  return (
    <Card
      padding="none"
      border="rule"
      fill="none"
      className="mx-gutter"
      style={{ borderRadius: PLATE_RADIUS }}>
      <View
        className="border-b border-hairline"
        style={{ backgroundColor: STRIP_GROUND, paddingVertical: 11, paddingHorizontal: 14 }}>
        {/* `colophon` IS this setting — 10px, uppercase, 1.4px tracked, muted —
            so the eyebrow needs no override at all. */}
        <Text variant="colophon">Maintenance</Text>
      </View>

      {rows.map((row, index) => (
        // Keyed by label: `MaintenanceRow` carries no id, and the labels are
        // the distinct actions of one plate, so they are unique by
        // construction. Index alone would be wrong — rows appear and disappear
        // with the item's state (a local piece has no AI rows), and a stale key
        // would leave a spinner attached to the wrong action.
        <Fragment key={row.label}>
          {/* No hairline after the last row — the plate's own border closes it,
              and a rule sitting on top of a border reads as a doubled line. */}
          {index > 0 ? <Rule tone="hairline" /> : null}
          <Row {...row} />
        </Fragment>
      ))}
    </Card>
  );
}
