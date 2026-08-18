import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  CIRCLE_ROW_MIN_HEIGHT,
  CIRCLE_SHEET_RADIUS,
  EXPLORE_COPY,
} from '@/features/explore/explore-spec';
import { GUTTER, useTheme } from '@/theme/tokens';

/**
 * One door out of the sheet.
 *
 * `value` is the sharing row's state and nothing else's — it is the one row
 * whose destination has a setting behind it, and showing "Off" here is what
 * makes the sheet honest about the page it was opened from: a reader who sees
 * an empty Explore and opens this finds out, in two words, that their own
 * switch is off too.
 */
export type CircleRow = {
  id: string;
  title: string;
  /** Secondary line under the title. Only the sharing row has one. */
  value?: string;
  /**
   * The spoken label, where it differs from the visible one.
   *
   * The search row reads "Find someone" and is labelled "Find people": the
   * visible word is the invitation and the spoken one names the noun a reader
   * is hunting for in a rotor list.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
};

/**
 * YOUR CIRCLE — the accepted `friend-management-reachable` frame.
 *
 * ── Reachable, and not competing ────────────────────────────────────────────
 *
 * That phrase is the whole brief for this sheet, and it decides both halves of
 * the design. Friend management is REACHABLE: one tap from the masthead, three
 * doors, always there whether the page is full or empty. It does not COMPETE:
 * it is not a permanent search field spending the first fold on a job most
 * sessions do not have (UX-04 removed exactly that), it is not a second tab,
 * and it is not a row of chips above the looks. The page is the looks; this is
 * the door beside them.
 *
 * ── Three doors and no fourth ───────────────────────────────────────────────
 *
 * Friends, find someone, and your own sharing switch. Requests, blocks, the
 * full list and the report flow all live on the Friends screen; this points at
 * them rather than duplicating them. **Nothing destructive is reachable from
 * here** — unfriend, block and report keep their confirmations behind the
 * friend's own overflow sheet, where a mis-tap on a masthead control cannot
 * find them.
 *
 * ── Why a `Modal` and not a route ───────────────────────────────────────────
 *
 * The same call `plan-month-sheet.tsx` made. A registered `formSheet` route is
 * the right shape for a surface with its own state and its own mutations
 * (people-search is one, and stays one); this sheet has neither — it is three
 * links and a sentence — and a route for it would add an entry to the root
 * stack that exists only to be dismissed.
 *
 * The scrim dismisses, because a sheet whose only exit is a gesture is the one
 * modal iOS users reliably get stuck in.
 */
export function CircleSheet({
  visible,
  rows,
  onDismiss,
}: {
  visible: boolean;
  rows: readonly CircleRow[];
  onDismiss: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.scrim }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={EXPLORE_COPY.circleClose}
          onPress={onDismiss}
          style={{ flex: 1 }}
        />

        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.canvas,
            borderTopLeftRadius: CIRCLE_SHEET_RADIUS,
            borderTopRightRadius: CIRCLE_SHEET_RADIUS,
            paddingTop: 12,
          }}>
          <View className="items-center">
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.sand }} />
          </View>

          <View style={{ paddingHorizontal: GUTTER, paddingTop: 20 }}>
            <Text variant="title" trim accessibilityRole="header">
              {EXPLORE_COPY.circleTitle}
            </Text>

            {/* THE BOUNDARY, STATED WHERE FRIENDS ARE MANAGED. Explore is a
                mutual-friends-only surface by construction: everything it
                draws comes through views gated row by row on mutual
                friendship, and the public projections require both a public
                item and a public profile, neither of which any screen sets.
                Saying so here is not reassurance for its own sake — it is the
                fact a person needs before they go looking for someone. */}
            <Text variant="note" className="mt-2.5">
              {EXPLORE_COPY.circleBody}
            </Text>
          </View>

          <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, gap: 10 }}>
            {rows.map((row) => (
              <PressableSurface
                key={row.id}
                accessibilityRole="button"
                accessibilityLabel={row.accessibilityLabel ?? row.title}
                accessibilityHint={row.accessibilityHint}
                onPress={row.onPress}
                className="rounded-md px-4"
                style={{ backgroundColor: theme.tray, minHeight: CIRCLE_ROW_MIN_HEIGHT }}
                contentStyle={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 14,
                }}>
                <View className="min-w-0 flex-1">
                  {/* No `numberOfLines` anywhere in this sheet. At AX sizes the
                      titles wrap and the rows grow; a clamp here is how a door
                      loses its own name at the setting that needs it most. */}
                  <Text variant="label" style={{ color: theme.ink }}>
                    {row.title}
                  </Text>
                  {row.value ? (
                    <Text variant="noteSmall" style={{ marginTop: 2 }}>
                      {row.value}
                    </Text>
                  ) : null}
                </View>
                <SymbolView
                  name="chevron.right"
                  size={13}
                  tintColor={theme.accent}
                  resizeMode="scaleAspectFit"
                />
              </PressableSurface>
            ))}
          </View>

          {/* NON-RETROACTIVITY, ON THE SHEET THAT LEADS TO THE SWITCH.
              Turning sharing on is a decision about your own history and must
              not surprise anybody: it starts from now, and a look lasts seven
              days. `worn_outfits_shared_since` is what makes the first half
              true; the seven-day window is what makes the second. */}
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 12 }}>
            <Text variant="note">{EXPLORE_COPY.circleFooter}</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
