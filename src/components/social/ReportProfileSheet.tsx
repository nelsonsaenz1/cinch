import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { SheetOverlay } from '@/components/social/FriendOverflowSheet';
import { Button, Rule, Text } from '@/components/ui';
import { PROFILE_REPORT_REASONS } from '@/features/social-graph/moderation';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * F-08 — reporting a person, in plain speech. Four reasons from the one
 * shared vocabulary (PROFILE_REPORT_REASONS — the operator's triage queue
 * groups by these strings, so no screen invents its own), no free-text
 * requirement, and blocking on by default: nobody reporting someone wants to
 * keep seeing them while it is reviewed.
 *
 * Presentational: the page owns `useReportContent`/`useBlockUser` and hands
 * back `pending`/`sent`, which is what lets the dev fixture pose every state
 * of this exact component without a network in sight.
 */

export type ReportProfileSheetProps = {
  /** Who is being reported. Non-null shows the sheet. */
  profile: SocialProfile | null;
  onClose: () => void;
  onSubmit: (input: { reason: string; blockToo: boolean }) => void;
  pending: boolean;
  /** True once the report has landed; swaps the form for the receipt. */
  sent: boolean;
  /** Whether the block actually ran — the receipt states it as a fact, not a wish. */
  sentWithBlock: boolean;
  onDone: () => void;
};

/** The 19pt disc — a thick ink ring when chosen, per the atlas. */
function Radio({ selected }: { selected: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 19,
        height: 19,
        borderRadius: 9.5,
        borderWidth: selected ? 5 : 1.5,
        // `faint` is banned as text; as a control glyph it clears the 3:1
        // non-text floor, which `rule` at 12% never could.
        borderColor: selected ? theme.ink : theme.faint,
      }}
    />
  );
}

function handleFor(profile: SocialProfile): string {
  return profile.username ? `@${profile.username}` : profileName(profile);
}

export function ReportProfileSheet({
  profile,
  onClose,
  onSubmit,
  pending,
  sent,
  sentWithBlock,
  onDone,
}: ReportProfileSheetProps) {
  const theme = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [blockToo, setBlockToo] = useState(true);

  // Fresh form each time the sheet opens on someone — state adjusted during
  // render (the sanctioned derive-from-props pattern), not in an effect.
  const userId = profile?.userId ?? null;
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  if (userId !== lastUserId) {
    setLastUserId(userId);
    if (userId) {
      setReason(null);
      setBlockToo(true);
    }
  }

  return (
    <SheetOverlay
      visible={profile !== null}
      // Mid-send there is no safe way to leave; the receipt leaves via Done.
      onClose={pending || sent ? () => undefined : onClose}>
      {profile ? (
        sent ? (
          <View className="rounded-plate bg-canvas p-5">
            <Text variant="callout" accessibilityLiveRegion="polite">
              Thank you. We’ll look at this.
            </Text>
            <Text variant="note" className="mt-1.5">
              {sentWithBlock
                ? 'They’ve been blocked and won’t know you reported them.'
                : 'They won’t know you reported them.'}
            </Text>
            <Button title="Done" variant="ink" onPress={onDone} className="mt-4" />
          </View>
        ) : (
          <View className="overflow-hidden rounded-plate bg-canvas">
            <View className="px-5 pb-3.5 pt-5">
              <Text variant="plate" accessibilityRole="header">
                Report {handleFor(profile)}
              </Text>
              <Text variant="body" className="mt-2 text-muted">
                Tell us what happened. A person reads every report.
              </Text>
            </View>
            {PROFILE_REPORT_REASONS.map((r) => (
              <View key={r}>
                <Rule tone="hairline" />
                <Pressable
                  onPress={() => setReason(r)}
                  accessibilityRole="radio"
                  accessibilityLabel={r}
                  accessibilityState={{ checked: reason === r }}
                  style={{ minHeight: MIN_TAP_TARGET }}
                  className="flex-row items-center justify-between px-5 py-3 active:opacity-60">
                  <Text variant="callout">{r}</Text>
                  <Radio selected={reason === r} />
                </Pressable>
              </View>
            ))}
            <Rule tone="hairline" />
            <View className="px-5 pb-5 pt-3.5">
              <View
                className="flex-row items-center justify-between pb-3.5"
                style={{ minHeight: MIN_TAP_TARGET }}>
                <Text variant="callout">Block them too</Text>
                <Switch
                  value={blockToo}
                  onValueChange={setBlockToo}
                  disabled={pending}
                  trackColor={{ false: theme.rule, true: theme.ink }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: blockToo }}
                  accessibilityLabel="Block them too"
                />
              </View>
              <Button
                title="Send report"
                variant="primary"
                disabled={reason === null}
                loading={pending}
                onPress={() => {
                  if (reason === null) return;
                  onSubmit({ reason, blockToo });
                }}
              />
            </View>
          </View>
        )
      ) : null}
    </SheetOverlay>
  );
}
