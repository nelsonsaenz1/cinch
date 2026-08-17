import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { NAV_TITLE, UNREAD_SPOKEN } from '@/features/activity-center/copy';
import { useHasUnseenActivity } from '@/features/activity-center/queries';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { PresenceDot } from './glyphs';

/**
 * The way in — AC-01's spec panel, drawn on the Daily Social header.
 *
 * ── ENTRY IS A PUSH, NOT A TAB ────────────────────────────────────────────
 *
 * §13 is explicit and this button is the whole of the mechanism: Activity is
 * reached from the Daily Social header and lives nowhere in the primary
 * navigation, so it cannot compete for attention with the four things that do.
 * A tab is permanently visible and permanently asking; a header glyph is only
 * there when you are already on the page it belongs to.
 *
 * ── THE DOT IS A BOOLEAN, ALL THE WAY DOWN ────────────────────────────────
 *
 * `activity_has_unseen()` is an `exists`, `useHasUnseenActivity` returns a
 * `boolean`, and `PresenceDot` takes no props but a size. There is no number
 * anywhere on this path for somebody to render later, which is the only version
 * of "no count" that survives contact with a future contributor. It is not the
 * iOS app-icon badge either — nothing here requests a notification entitlement,
 * and this feature adds none.
 *
 * It clears on open: `useMarkActivitySeen` stamps every unseen row and
 * invalidates this query, so the dot goes on the way back.
 *
 * ── AND IT IS NOT THE CARRIER ─────────────────────────────────────────────
 *
 * The dot is decorative to a screen reader. Unread is announced as a WORD in the
 * accessibility label, so a reader who cannot see the oxblood disc is told the
 * same thing in the same breath — §11's colour-independence rule at the one
 * place in the surface it is easiest to break.
 */
export function ActivityEntryButton() {
  const theme = useTheme();
  const router = useRouter();
  const unseen = useHasUnseenActivity();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unseen ? `${NAV_TITLE}, ${UNREAD_SPOKEN}` : NAV_TITLE}
      accessibilityHint="Opens your activity — invitations and reactions, private to you"
      onPress={() => router.push('/activity')}
      style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}
      className="items-center justify-center active:opacity-60">
      <View>
        {/* The glyph AC-01 draws: a quiet ring on the tray, at 34pt — the same
            disc the header's other control occupies, so the two sit level. */}
        <View
          className="items-center justify-center rounded-full bg-tray"
          style={{ width: 34, height: 34 }}>
          <View
            style={{
              width: 15,
              height: 15,
              borderRadius: 7.5,
              borderWidth: 1.6,
              borderColor: theme.muted,
            }}
          />
        </View>

        {unseen ? (
          // Top-right, breaking the disc's edge, exactly as the spec panel
          // draws it. Nine points including the canvas ring.
          <View style={{ position: 'absolute', top: -1, right: -1 }}>
            <PresenceDot />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The same control as a plain text link, for a header with no room for a glyph.
 *
 * Exported unused by any screen today and kept deliberately: the design record
 * allows the entry to move into the tab bar later (§13, "if product wants it in
 * the tab bar later, the presence dot rule still holds"), and having the text
 * form written down beside the glyph form is what makes the dot rule travel with
 * it rather than being reinvented at the new call site.
 */
export function ActivityEntryLink() {
  const theme = useTheme();
  const router = useRouter();
  const unseen = useHasUnseenActivity();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unseen ? `${NAV_TITLE}, ${UNREAD_SPOKEN}` : NAV_TITLE}
      onPress={() => router.push('/activity')}
      hitSlop={10}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
      className="flex-row items-center gap-1.5 active:opacity-60">
      <Text style={{ fontSize: 17, color: theme.accent }}>{NAV_TITLE}</Text>
      {unseen ? <PresenceDot size={8} /> : null}
    </Pressable>
  );
}
