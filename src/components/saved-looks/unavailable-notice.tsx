import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { UNAVAILABLE, unavailableBody } from '@/features/saved-looks/copy';
import { useTheme } from '@/theme/tokens';

/**
 * OS-06's notice — the look is gone, and what that did and did not take with it.
 *
 * ── IT SAYS WHAT HAPPENED WITHOUT SAYING WHICH THING HAPPENED ──────────────
 *
 * "expired or their sharing changed" covers four cases the schema deliberately
 * does not distinguish: a daily look past its seven days, sharing turned off, a
 * friendship or block that changed the visibility, and the look being deleted
 * outright. `can_save_source` returns a boolean and that is the whole of what
 * this client knows — which is correct, because telling the four apart would be
 * four different disclosures about another person's decision, delivered to
 * somebody who is not party to it.
 *
 * ── IT IS NOT AN ERROR, AND IT IS NOT STYLED AS ONE ────────────────────────
 *
 * No `critical` tone, no destructive red, no warning triangle. Nothing failed:
 * a person changed their mind about their own look, which is the thing the
 * sharing control is FOR. The accent ground is the same one the app uses for a
 * standing fact, and the two buttons underneath are both ordinary.
 *
 * ── THE PRIVACY LINE IS TRUE BY CONSTRUCTION ───────────────────────────────
 *
 * "We never copied their garments into your closet" is not a promise this
 * component makes on its own recognisance. `saved_looks` has no foreign key to
 * `items`, `outfit_items` or `outfits`, and 21_saved_looks.sql asserts exactly
 * that as its first assertion — before any row is written, so the claim cannot
 * be quietly falsified by a later column.
 *
 * `accessibilityRole="summary"` rather than `alert`: this is a fact about the
 * save that is simply true whenever the screen is open, not an event that
 * arrived. An alert would re-announce it on every re-render.
 */

export type UnavailableNoticeProps = {
  /** The source owner's name as the snapshot recorded it. May be empty. */
  sourceName: string;
};

export function UnavailableNotice({ sourceName }: UnavailableNoticeProps) {
  const theme = useTheme();
  const body = unavailableBody(sourceName);

  return (
    <View
      className="flex-row gap-3 rounded-md bg-tray p-4"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${UNAVAILABLE.title}. ${body}`}>
      <SymbolView name="info.circle" size={20} tintColor={theme.accent} />
      <View className="flex-1 gap-1">
        <Text variant="label" className="text-accent">
          {UNAVAILABLE.title}
        </Text>
        <Text variant="caption" className="text-muted">
          {body}
        </Text>
      </View>
    </View>
  );
}
