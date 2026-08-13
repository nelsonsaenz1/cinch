import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Rule, Text } from '@/components/ui';
import { PROFILE_REPORT_REASONS } from '@/features/social-graph/moderation';
import { profileName, type SocialProfile } from '@/features/social-graph/types';
import { GUTTER, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The leaving sheets — overflow, block, remove, report (Friends atlas
 * F-06/F-07/F-08). Every destructive path off a friend row runs through one
 * of these four overlays, and nowhere else: report and block are never on the
 * row itself, because a list of people you like should not be lined with
 * warnings.
 *
 * All four are transparent `Modal`s rather than routes, for the same reason
 * EditProfileSheet is — the page owns them with a boolean, and the root Stack
 * stays untouched. The card floats at the bottom over the scrim token (the
 * one dimming value; the atlas's .34 is the same warm ink, pre-token), with
 * the page's own 20px gutter as its side insets.
 *
 * Oxblood on these screens means irreversible — Block, Remove, Send report,
 * and the destructive sheet rows — and appears nowhere else. The atlas draws
 * those buttons as radius-22 capsules; here they are the kit's Button, because
 * a labelled control in this app is a 12px rectangle, full stop
 * (tailwind.config.js on `full`).
 */

// ---------------------------------------------------------------------------
// The shared presentation
// ---------------------------------------------------------------------------

/**
 * Scrim + bottom-anchored content. A fade, not a slide: RN's slide animates
 * the scrim up with the card, and the page already owns whatever motion
 * grammar it wants — no novel animation here.
 */
function Overlay({
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
function friendsSinceClause(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return year === new Date().getFullYear()
    ? `friends since ${month}`
    : `friends since ${month} ${year}`;
}

/** `@username`, else the display name, else the neutral noun. */
function handleFor(profile: SocialProfile): string {
  return profile.username ? `@${profile.username}` : profileName(profile);
}

// ---------------------------------------------------------------------------
// F-06 · The overflow sheet
// ---------------------------------------------------------------------------

export type FriendOverflowSheetProps = {
  /** Whose row was tapped. Non-null shows the sheet. */
  profile: (SocialProfile & { friendsSince?: string | null }) | null;
  onClose: () => void;
  onViewCloset: () => void;
  onMute: () => void;
  isMuted: boolean;
  onRemove: () => void;
  onReport: () => void;
  onBlock: () => void;
};

function SheetRow({
  label,
  onPress,
  destructive = false,
  chevron = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  chevron?: boolean;
}) {
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
 * The folded actions behind a friend row's overflow. Titled with the person
 * so there is no doubt whose row was tapped; the three oxblood rows sit
 * below the two ordinary ones, in escalating weight.
 */
export function FriendOverflowSheet({
  profile,
  onClose,
  onViewCloset,
  onMute,
  isMuted,
  onRemove,
  onReport,
  onBlock,
}: FriendOverflowSheetProps) {
  if (profile === null) {
    return (
      <Overlay visible={false} onClose={onClose}>
        {null}
      </Overlay>
    );
  }

  const since = friendsSinceClause(profile.friendsSince);
  const sub = profile.username
    ? `@${profile.username}${since ? ` · ${since}` : ''}`
    : (since ?? null);

  return (
    <Overlay visible onClose={onClose}>
      <View className="rounded-lg bg-canvas">
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
        <Rule tone="hairline" />
        <SheetRow label="View closet" onPress={onViewCloset} chevron />
        <Rule tone="hairline" />
        <SheetRow label={isMuted ? 'Unmute in Lately' : 'Mute in Lately'} onPress={onMute} chevron />
        <Rule tone="hairline" />
        <SheetRow label="Remove friend" onPress={onRemove} destructive />
        <Rule tone="hairline" />
        <SheetRow label="Report" onPress={onReport} destructive />
        <Rule tone="hairline" />
        <SheetRow label="Block" onPress={onBlock} destructive />
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
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// F-07 · Block — the full consequence sheet
// ---------------------------------------------------------------------------

export type BlockConfirmSheetProps = {
  profile: SocialProfile | null;
  onClose: () => void;
  onBlock: () => void;
  pending: boolean;
};

/**
 * Same grammar as Delete account: what leaves, whether they are told, and how
 * to undo it. Keep them is the calmer target, and it sits below so the eye
 * lands there last.
 */
export function BlockConfirmSheet({ profile, onClose, onBlock, pending }: BlockConfirmSheetProps) {
  return (
    <Overlay visible={profile !== null} onClose={pending ? () => undefined : onClose}>
      {profile ? (
        <View className="rounded-plate bg-canvas p-5">
          <Text variant="title" accessibilityRole="header">
            Block {handleFor(profile)}?
          </Text>
          <Text variant="body" className="mt-2.5">
            Your closets close to each other, the outfits they&rsquo;ve seen leave their Lately,
            and they can&rsquo;t find you by username again. They aren&rsquo;t told. You can unblock
            them from Profile.
          </Text>
          <View className="mt-4" style={{ gap: 10 }}>
            <Button title="Block" variant="primary" onPress={onBlock} loading={pending} />
            <Button title="Keep them" variant="secondary" onPress={onClose} disabled={pending} />
          </View>
        </View>
      ) : null}
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// F-08 · Remove — the short dialog
// ---------------------------------------------------------------------------

export type RemoveFriendDialogProps = {
  profile: SocialProfile | null;
  onClose: () => void;
  onRemove: () => void;
  pending: boolean;
};

/**
 * Removing is reversible and quiet, so it gets a short dialog rather than the
 * full consequence sheet. The distinction from Block is the last sentence.
 */
export function RemoveFriendDialog({ profile, onClose, onRemove, pending }: RemoveFriendDialogProps) {
  const firstName =
    profile?.displayName?.trim().split(/\s+/)[0] ||
    (profile?.username ? `@${profile.username}` : 'them');

  return (
    <Overlay visible={profile !== null} onClose={pending ? () => undefined : onClose}>
      {profile ? (
        <View className="rounded-plate bg-canvas p-5">
          <Text variant="plate" accessibilityRole="header">
            Remove {firstName}?
          </Text>
          <Text variant="body" className="mt-2.5">
            Both closets close. They aren&rsquo;t told, and either of you can ask again later.
          </Text>
          <View className="mt-4" style={{ gap: 10 }}>
            <Button title="Remove" variant="primary" onPress={onRemove} loading={pending} />
            <Button title="Cancel" variant="secondary" onPress={onClose} disabled={pending} />
          </View>
        </View>
      ) : null}
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// F-08 · Report — reasons, block-too, then the receipt
// ---------------------------------------------------------------------------

export type ReportSheetProps = {
  profile: SocialProfile | null;
  onClose: () => void;
  onSubmit: (input: { reason: string; blockToo: boolean }) => void;
  pending: boolean;
  /** True once the report has landed; swaps the form for the receipt. */
  sent: boolean;
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

/**
 * Four reasons, no free-text requirement, and blocking on by default —
 * nobody reporting someone wants to keep seeing them while it is reviewed.
 * After sending, the same card becomes the receipt: a thank-you, what the
 * other person will and won't know, and Done.
 */
export function ReportSheet({ profile, onClose, onSubmit, pending, sent, onDone }: ReportSheetProps) {
  const theme = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [blockToo, setBlockToo] = useState(true);
  // What was true at the moment of sending — the receipt reads this, not the
  // live toggle, so a re-render can never rewrite what actually happened.
  const [sentWithBlock, setSentWithBlock] = useState(true);

  // Fresh form each time the sheet opens on someone — state adjusted during
  // render off the previous person, not in an effect (no cascading render).
  const userId = profile?.userId ?? null;
  const [prevUserId, setPrevUserId] = useState<string | null>(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    if (userId) {
      setReason(null);
      setBlockToo(true);
    }
  }

  return (
    <Overlay visible={profile !== null} onClose={pending ? () => undefined : onClose}>
      {profile ? (
        sent ? (
          <View className="rounded-plate bg-canvas p-5">
            <Text variant="callout" accessibilityLiveRegion="polite">
              Thank you. We&rsquo;ll look at this.
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
              <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
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
                  setSentWithBlock(blockToo);
                  onSubmit({ reason, blockToo });
                }}
              />
            </View>
          </View>
        )
      ) : null}
    </Overlay>
  );
}
