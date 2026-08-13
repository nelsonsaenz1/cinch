import { View } from 'react-native';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Button, Text } from '@/components/ui';
import { DELETION_HORIZONS, EXPORT_FIRST_NOTE } from '@/features/privacy/copy';
import { useTheme } from '@/theme/tokens';

/**
 * PD-06 / PV-04 — Delete your closet and account.
 *
 * Three sections rather than one paragraph of legal text. The shape is the
 * atlas's and it is a good one; the contents are this repository's, and two of
 * the drawn claims were false when they were first drawn and one of them is
 * still false now:
 *
 *   * "Within thirty days" — deletion is immediate and in-app, and that
 *     immediacy is precisely what satisfies App Store Guideline 5.1.1(v).
 *     `supabase/functions/delete-account/index.ts:8-13` names "we will process
 *     this within 30 days" as a thing that does NOT satisfy it. PV-04 withdrew
 *     this one itself (correction 16) and its first section is now "While you
 *     wait", which is what this page has said all along.
 *   * "Comments you left in other people's events stay, shown without your
 *     name" — PV-04's third section. Comments, votes and event posts all
 *     cascade from `auth.users` (`20260807102000_event_outfits_votes_
 *     comments.sql:17`, `:62`, `:109`). They are erased, not anonymised, and
 *     the second section says so. See `features/privacy/copy.ts`'s note on
 *     `EXPORT_FIRST_NOTE` for why the true half of that section is folded into
 *     the panel above the buttons instead.
 *
 * ── The three exits, and why the destructive one is filled now ─────────────
 *
 * PV-04 draws export unfilled, deletion filled in oxblood, and "Keep my
 * account" as a plain 44pt exit. The page previously drew deletion as an
 * oxblood OUTLINE, on the older atlas's instruction. The outline is what the
 * new drawing spends its one accent on instead, and the change is worth making
 * rather than arguing about: a filled control is the frame's answer to "what is
 * this screen for", and this screen is for deleting. Nothing about the
 * consequence changes — the button opens a confirmation that asks the user to
 * type DELETE, and nothing is removed before that.
 *
 * Leaving is a real exit and not a cancel hidden in the nav bar: the drawn
 * third action is wired to the same route back the chevron uses.
 *
 * ── What is not printed ────────────────────────────────────────────────────
 *
 * PV-04 heads the sheet with "148 pieces, 612 wears, 41 plans and 6 boards".
 * Three of those four are not available to this screen — there is no single
 * query that returns them, and printing the one that is (the closet count)
 * would turn a four-part inventory into a partial one. Omitted with the reason
 * rather than estimated, and raised as a dependency.
 */
export function DeleteAccountPage({
  onBack,
  onExportFirst,
  onDelete,
  busy = false,
}: {
  onBack: () => void;
  onExportFirst: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  const theme = useTheme();

  return (
    <PrivacyPage
      parent="Privacy and data"
      title="Delete your closet and account"
      intro="Here is exactly what happens, before you decide."
      onBack={onBack}>
      {/* Rules, not a card: the sections are one list, the same treatment the
          index uses. Body at 17px in `muted` — the group's floor is that no
          legal sentence is set below 15 pt, and every sentence here is one. */}
      <View className="mt-6">
        {DELETION_HORIZONS.map((horizon, index) => (
          <View
            key={horizon.title}
            className={`px-gutter py-4 ${index === 0 ? '' : 'border-t border-hairline'}`}>
            <Text variant="body">
              {horizon.title}
            </Text>
            <Text variant="body" className="mt-1" style={{ color: theme.muted }}>
              {horizon.body}
            </Text>
          </View>
        ))}
      </View>

      <View className="mx-gutter mt-5 rounded-lg bg-tray p-4">
        <Text variant="body" style={{ color: theme.muted }}>
          {EXPORT_FIRST_NOTE}
        </Text>
      </View>

      <View className="mt-6 gap-2.5 px-gutter">
        <Button
          title="Export my data first"
          variant="secondary"
          disabled={busy}
          accessibilityHint="Opens the export page. Nothing is deleted."
          onPress={onExportFirst}
        />
        {/* The one oxblood on the page. `primary` is the brand red #6E2B2B, not
            `critical`'s deeper brick — the atlas asks for the brand red on this
            control and has since atlas 38. */}
        <Button
          title="Delete everything"
          variant="primary"
          disabled={busy}
          accessibilityHint="Opens a confirmation that asks you to type DELETE. Nothing is removed until then."
          onPress={onDelete}
        />
        <Button
          title="Keep my account"
          variant="ghost"
          disabled={busy}
          accessibilityHint="Goes back. Nothing is deleted."
          onPress={onBack}
        />
      </View>
    </PrivacyPage>
  );
}
