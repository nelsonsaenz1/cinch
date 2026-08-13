import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rule, Text } from '@/components/ui';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The FC-02 action sheet — the card grammar every leaving action on a friend
 * runs through, with the rows handed in rather than hard-wired.
 *
 * Rows are config, not children, for one reason: the Friend's Closet sheet and
 * the Friends-row sheet are the SAME sheet minus one row ("View closet" is
 * absent when you are already standing in the closet — FC-02's caption). A
 * component that owns its rows would fork the moment the second caller
 * arrived; a component that owns only the grammar — header card, hairline
 * rows, oxblood for the irreversible ones, the separate Cancel card — cannot.
 * The Friends-page rebuild adopts this by passing its own row list.
 */

// ---------------------------------------------------------------------------
// The shared overlay
// ---------------------------------------------------------------------------

/**
 * Scrim + bottom-anchored content — the one presentation all of this page's
 * sheets share. A fade, not a slide: RN's slide animates the scrim up with
 * the card, and the scrim must simply be there. Exported for FriendItemSheet
 * and ReportProfileSheet so the three cannot drift into three dimming values.
 */
export function SheetOverlay({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          accessibilityViewIsModal
          style={{
            paddingHorizontal: GUTTER,
            // Above the home indicator; a floor for devices without one.
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/**
 * `friends since March`, `friends since November 2025` — the year only when
 * it is not this one. An unparseable date drops the clause rather than
 * printing "Invalid Date" under someone's name.
 */
export function friendsSinceClause(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return year === new Date().getFullYear()
    ? `friends since ${month}`
    : `friends since ${month} ${year}`;
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export type FriendSheetRow = {
  label: string;
  onPress: () => void;
  /** Oxblood — reserved for the actions that end or escalate something. */
  destructive?: boolean;
  /** The `›` that says this row leads somewhere rather than commits. */
  chevron?: boolean;
};

export type FriendOverflowSheetProps = {
  /** Whose sheet this is. Non-null shows it. */
  profile: (SocialProfile & { friendsSince?: string | null }) | null;
  onClose: () => void;
  rows: FriendSheetRow[];
};

function SheetRowView({ label, onPress, destructive = false, chevron = false }: FriendSheetRow) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ minHeight: 50 }}
      className="flex-row items-center justify-between px-4 active:opacity-60">
      <Text variant="callout" style={destructive ? { color: theme.accent } : undefined}>
        {label}
      </Text>
      {chevron ? (
        <Text variant="label" style={{ color: theme.byline }}>
          ›
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Header card names the person — so there is no doubt whose closet the
 * oxblood rows are about — then the rows in the caller's order, then Cancel
 * as its own card: the way out is never a row among the actions.
 */
export function FriendOverflowSheet({ profile, onClose, rows }: FriendOverflowSheetProps) {
  if (profile === null) {
    return (
      <SheetOverlay visible={false} onClose={onClose}>
        {null}
      </SheetOverlay>
    );
  }

  const since = friendsSinceClause(profile.friendsSince);
  const sub = profile.username
    ? `@${profile.username}${since ? ` · ${since}` : ''}`
    : (since ?? null);

  return (
    <SheetOverlay visible onClose={onClose}>
      <View className="overflow-hidden rounded-lg bg-canvas">
        <View className="px-4 pb-3 pt-3.5">
          <Text variant="callout">
            {profileName(profile)}
          </Text>
          {sub ? (
            <Text variant="note" className="mt-0.5">
              {sub}
            </Text>
          ) : null}
        </View>
        {rows.map((row) => (
          <View key={row.label}>
            <Rule tone="hairline" />
            <SheetRowView {...row} />
          </View>
        ))}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-2.5 items-center justify-center rounded-lg bg-canvas active:opacity-60">
        <Text variant="callout">
          Cancel
        </Text>
      </Pressable>
    </SheetOverlay>
  );
}
