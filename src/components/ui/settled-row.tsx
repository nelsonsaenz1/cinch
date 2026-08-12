import { Switch, View } from 'react-native';

import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { Text } from './text';

/**
 * The settled row — the one object every list in group 6 is made of.
 *
 * "A ruled row at least 44 pt tall with a Medium label, an optional regular
 * value on the right, and one affordance." `SettingsRow` is already this row
 * with a chevron on it, and it stays exactly as it is; these two are the other
 * affordances the group needs, which `SettingsRow` cannot grow without becoming
 * a component that does four things.
 *
 * ── THE ONE RULE AT LARGER TYPE (PR-01 / AX) ──────────────────────────────
 *
 * When a label and its value can no longer share a line, the value moves
 * UNDERNEATH. Neither is ever truncated: a settings value is the answer to the
 * question its label asks, and a truncated answer is worse than a taller row.
 * `flex-wrap` on the row plus `flex-none` on the value is what does it — no
 * measurement, no breakpoint, and it behaves identically at every Dynamic Type
 * size rather than at the one somebody tested.
 *
 * ── WHY A TOGGLE PRINTS ITS STATE AS A WORD ───────────────────────────────
 *
 * Because otherwise the preference is carried by the track colour alone, which
 * is one channel and the wrong one. The word is under the label, in `muted`
 * — never `faint`, which fails AA on canvas and is the constitution's one
 * absolute about colour.
 */

/** A label with a quiet value beside it. No affordance: this row is a fact. */
export function ValueRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}, ${value}`}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row flex-wrap items-center justify-between gap-x-3 px-4 py-3 ${className}`}>
      <Text variant="body">{label}</Text>
      <Text variant="caption" className="flex-none text-muted">
        {value}
      </Text>
    </View>
  );
}

/**
 * A label, its state printed as a word, and the switch.
 *
 * `overridden` is NT-02: the system has denied notifications, so the control
 * cannot act. The track goes tray and the switch goes inert, but the label
 * stays at full strength and the wording moves to the conditional — an
 * overridden control still has to be readable, and WCAG's exemption for a
 * disabled control has never covered the prose beside one.
 */
export function ToggleRow({
  label,
  /** The sub-line. "On — merchants under a gap", or a conditional under NT-02. */
  state,
  value,
  onValueChange,
  overridden = false,
  /** Named once at the top of the page, and repeated into every switch's hint. */
  overriddenReason,
  className = '',
}: {
  label: string;
  state: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  overridden?: boolean;
  overriddenReason?: string;
  className?: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-start gap-3.5 px-4 py-3 ${className}`}>
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        <Text variant="note" className="mt-1">
          {state}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={overridden}
        // The remembered value is still drawn. A switch that snapped to off
        // because the phone refused delivery would be the app rewriting a
        // preference nobody changed — and NT-02 promises in as many words that
        // the preferences are kept.
        trackColor={{ false: overridden ? theme.tray : theme.rule, true: overridden ? theme.tray : theme.ink }}
        thumbColor={overridden ? theme.surface : undefined}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: overridden }}
        accessibilityLabel={label}
        accessibilityHint={overridden ? overriddenReason : state}
      />
    </View>
  );
}
