import { View } from 'react-native';

import { OutlinedAccentButton } from '@/components/privacy/outlined-accent-button';
import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Button, Card, Text } from '@/components/ui';
import { DELETION_HORIZONS, EXPORT_FIRST_NOTE } from '@/features/privacy/copy';

/**
 * PD-06 — Delete your account.
 *
 * Three time horizons rather than one paragraph of legal text. The shape is
 * the atlas's and it is a good one; the contents are not, and both of its
 * factual claims were false:
 *
 *   * "Within thirty days" — deletion is immediate and in-app, and that
 *     immediacy is precisely what satisfies App Store Guideline 5.1.1(v).
 *     `supabase/functions/delete-account/index.ts:8-13` names "we will process
 *     this within 30 days" as a thing that does NOT satisfy it.
 *   * "Comments you left on a friend's look stay, shown as 'a former member'"
 *     — comments, votes and event posts all cascade from `auth.users`
 *     (`20260807102000_event_outfits_votes_comments.sql:17`, `:62`, `:109`).
 *     They are erased.
 *
 * So the horizons are: what happens the moment you confirm, what cascades with
 * it, and what genuinely survives — the two documented exceptions, named. See
 * `features/privacy/copy.ts` for the citation on each sentence.
 *
 * "Export first" sits ABOVE "Delete my account" and is the calmer, filled
 * control of the two: the atlas's rule is that export is a peer of delete and
 * that delete offers export as an equal route out. The destructive control is
 * the oxblood outline — brand red, never iOS red — and is the only accent on
 * the page.
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
  return (
    <PrivacyPage
      parent="Privacy & data"
      title="Delete your account"
      intro="Here is exactly what happens, before you decide."
      onBack={onBack}>
      <Card className="mx-gutter mt-6">
        {DELETION_HORIZONS.map((horizon, index) => (
          <View
            key={horizon.title}
            className={`px-4 py-4 ${index === 0 ? '' : 'border-t border-hairline'}`}>
            <Text variant="body" className="font-medium">
              {horizon.title}
            </Text>
            <Text variant="note" className="mt-1">
              {horizon.body}
            </Text>
          </View>
        ))}
      </Card>

      <View className="mx-gutter mt-4 rounded-lg bg-tray p-4">
        <Text variant="note">{EXPORT_FIRST_NOTE}</Text>
      </View>

      <View className="mt-6 gap-2.5 px-gutter">
        <Button
          title="Export first"
          variant="secondary"
          className="h-[52px]"
          disabled={busy}
          accessibilityHint="Opens the export page. Nothing is deleted."
          onPress={onExportFirst}
        />
        <OutlinedAccentButton
          title="Delete my account"
          hint="Opens a confirmation that asks you to type DELETE. Nothing is removed until then."
          disabled={busy}
          onPress={onDelete}
        />
      </View>
    </PrivacyPage>
  );
}
