import { SymbolView } from 'expo-symbols';
import { Pressable, Switch, View } from 'react-native';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Card, Rule, SectionHeader, Text } from '@/components/ui';
import { SHOPPABLE_DETAIL, SHOPPABLE_LABEL } from '@/features/commerce/copy';
import {
  LINK_HANDLING_ROW,
  SELLS_NOTHING_FOOTER,
  STORED_ROWS,
  type DisclosureRow,
} from '@/features/privacy/copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PD-01 — the page. Two groups and a closing line.
 *
 * "What is stored" is an inventory in full sentences, and the row descriptions
 * ARE the App Privacy disclosure — the atlas's own rule is that each line of
 * the store card maps to one row here, and that a disclosure added to the
 * listing is added to this page in the same release. That is why the prose
 * lives in `features/privacy/copy.ts` beside its citations rather than inline.
 *
 * Purely presentational: props in, callbacks out. `dev-privacy.tsx` renders
 * this exact component from fixtures, so nothing verified there is an
 * approximation of what ships.
 *
 * commerce-directive.md C-05 adds one real switch — "Let friends find where
 * your pieces are from" — between the two existing groups. A switch, not
 * another `ChoiceRow`: every `ChoiceRow` here hands off to a sub-page, and
 * this setting has no sub-page to hand off to, only a state to flip in
 * place, the same shape `profile.tsx`'s "Show where to buy" switch already
 * uses for C-03. The two are deliberately not the same switch — see
 * `use-shoppable.ts`'s header.
 */

/** One row of the inventory — a titled sentence, ruled off from the next. */
function InventoryRow({ row, first }: { row: DisclosureRow; first: boolean }) {
  return (
    <View className={`px-4 py-3.5 ${first ? '' : 'border-t border-hairline'}`}>
      <Text variant="body" className="font-medium">
        {row.title}
      </Text>
      {/* `note`, not `caption`: this is running secondary prose, and `caption`
          carries `font-medium` — it would render the atlas's regular weight as
          bold grey, shouting a disclosure meant to be read calmly. Set in
          `muted`, which `note` already carries; the atlas's #8A8578 is 3.52:1
          on canvas and fails AA. */}
      <Text variant="note" className="mt-1">
        {row.body}
      </Text>
    </View>
  );
}

/**
 * One row of "Your choices" — title, a quiet sentence, a chevron.
 *
 * Not `ui/settings-row.tsx`: that row is a single label with an optional
 * trailing value, and every row here carries a description underneath. Same
 * anatomy otherwise — 44pt floor, `chevron.right` at 13 in `faint`, the
 * pressed opacity the rest of the app uses.
 */
function ChoiceRow({
  title,
  detail,
  tone = 'ink',
  first,
  onPress,
}: {
  title: string;
  detail: string;
  tone?: 'ink' | 'accent';
  first: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-60 ${
        first ? '' : 'border-t border-hairline'
      }`}>
      <View className="flex-1">
        <Text
          variant="body"
          className="font-medium"
          style={tone === 'accent' ? { color: theme.accent } : undefined}>
          {title}
        </Text>
        <Text variant="note" className="mt-1">
          {detail}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={13}
        tintColor={theme.faint}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

/**
 * The one real toggle on the page — commerce-directive.md C-05. Same anatomy
 * as `ChoiceRow` minus the chevron, plus a `Switch`: label and description on
 * the left, the control on the right, 44pt floor.
 */
function ToggleRow({
  title,
  detail,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="flex-1">
        <Text variant="body" className="font-medium">
          {title}
        </Text>
        <Text variant="note" className="mt-1">
          {detail}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.rule, true: theme.ink }}
        accessibilityLabel={title}
        accessibilityHint={detail}
      />
    </View>
  );
}

export type PrivacyIndexPageProps = {
  /** "Given 12 March 2026" / "Not given" — the real state, never a placeholder. */
  consentDetail: string;
  /**
   * Whether the binary can attribute a cold install to an invite.
   *
   * The Link handling row renders if and only if this is true. The attribution
   * SDK's stable release predates the New Architecture and its New-Arch rewrite
   * pins `react-native <0.85` against this app's 0.86, so it may never land
   * (`src/features/invite/native.ts:33-45`) — and disclosing something the app
   * does not do is exactly as wrong as concealing something it does. Same gate
   * Profile puts on its Notifications row with `NOTIFICATION_SETTINGS_AVAILABLE`.
   */
  deferredLinksAvailable: boolean;
  /** C-05 — `profiles.shoppable`'s current value. */
  shoppable: boolean;
  onToggleShoppable: (value: boolean) => void;
  /** True only while the write itself is in flight — the read never blocks the switch. */
  shoppablePending?: boolean;
  onBack: () => void;
  onOpenConsent: () => void;
  onOpenExport: () => void;
  onOpenDelete: () => void;
};

export function PrivacyIndexPage({
  consentDetail,
  deferredLinksAvailable,
  shoppable,
  onToggleShoppable,
  shoppablePending = false,
  onBack,
  onOpenConsent,
  onOpenExport,
  onOpenDelete,
}: PrivacyIndexPageProps) {
  const stored = deferredLinksAvailable ? [...STORED_ROWS, LINK_HANDLING_ROW] : STORED_ROWS;

  return (
    <PrivacyPage
      parent="Settings"
      title="Privacy & data"
      intro="What Cinch holds, what it does with it, and how to take it back. Written out here rather than linked to a policy page."
      onBack={onBack}>
      <SectionHeader title="What is stored" className="mb-2 mt-7 px-gutter" />
      <Card className="mx-gutter">
        {stored.map((row, index) => (
          <InventoryRow key={row.title} row={row} first={index === 0} />
        ))}
      </Card>

      {/* commerce-directive.md C-05 — a switch, not a ChoiceRow: there is no
          sub-page, only a state. Off by default, the opposite direction from
          every other switch on this page, because it is consent to be sold
          to rather than a display preference. */}
      <SectionHeader title="Selling your pieces" className="mb-2 mt-7 px-gutter" />
      <Card className="mx-gutter">
        <ToggleRow
          title={SHOPPABLE_LABEL}
          detail={SHOPPABLE_DETAIL}
          value={shoppable}
          onValueChange={onToggleShoppable}
          disabled={shoppablePending}
        />
      </Card>

      <SectionHeader title="Your choices" className="mb-2 mt-7 px-gutter" />
      <Card className="mx-gutter">
        <ChoiceRow
          first
          title="AI consent"
          detail={consentDetail}
          onPress={onOpenConsent}
        />
        <ChoiceRow
          first={false}
          title="Export your data"
          detail="A file with your closet, wears and plans, emailed to you."
          onPress={onOpenExport}
        />
        {/* The one oxblood row on the page — the rule `ui/settings-row.tsx`
            states for Delete account, applied inside this list. */}
        <ChoiceRow
          first={false}
          title="Delete your account"
          detail="What goes, what stays, and how quickly."
          tone="accent"
          onPress={onOpenDelete}
        />
      </Card>

      <View className="mt-7 px-gutter">
        <Rule />
        <Text variant="note" className="mt-4">
          {SELLS_NOTHING_FOOTER}
        </Text>
      </View>
    </PrivacyPage>
  );
}
