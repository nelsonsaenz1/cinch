import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Rule } from '@/components/ui/rule';
import { ValueRow } from '@/components/ui/settled-row';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import type { MembershipRow } from '@/features/billing/membership-row';
import {
  DIAGNOSTICS_ROW_LABEL,
  switchStateWord,
} from '@/features/settings/settings-spec';
import type { UpdateDiagnostic } from '@/features/updates/diagnostics';
import { haptics } from '@/lib/haptics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The furniture of redesign 29's Settings page — everything that is not an
 * ordinary `SettingsRow`.
 *
 * Split out of `app/settings.tsx` for the reason `activity-parts` and
 * `room-parts` were: the `dev-se-*` fixtures have to pose the page against the
 * components the app actually mounts, and a screen that draws its own plates
 * inline can only be posed by a second drawing of them. Same parts idiom.
 *
 * ── THE PAGE'S ONE STRUCTURAL CHANGE ──────────────────────────────────────
 *
 * It shipped as white `Card`s with a hairline ring on warm paper — correct, and
 * indistinguishable from every other list in the app. Every frame here paints
 * the groups on `tray` with no ring at all, and paints the two plates that are
 * about YOU (membership, invite) on `blush`. That is the directive's "colour
 * becomes structural" applied to the one page in the app that is pure
 * administration: the reader is not looking for a card, they are looking for
 * which GROUP a control is in, and the ground now answers that before the head
 * does.
 */

// ---------------------------------------------------------------------------
// The plate
// ---------------------------------------------------------------------------

/**
 * A group of rows on a warm ground.
 *
 * `overflow-hidden` because the rows carry their own padding and the plate
 * clips them to the radius — the same construction `Card padding="none"` uses,
 * and the reason this is not simply `Card` is the fill: `Card`'s ground is
 * `surface` white by contract and is drawn that way at ~35 call sites. A
 * `fill="tray"` added there would be a new option on a shared component with
 * one consumer; a local plate is the smaller claim, and `WarmBand` in
 * `circles/room-parts` set the precedent for exactly this.
 */
export function SettingsPlate({
  tone = 'tray',
  children,
  className = '',
}: {
  /** `blush` is spent on the two plates that are about the reader themselves. */
  tone?: 'tray' | 'blush';
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`overflow-hidden rounded-plate ${tone === 'blush' ? 'bg-blush' : 'bg-tray'} ${className}`}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The card head
// ---------------------------------------------------------------------------

/**
 * `STYLING` · `PEOPLE` · `UTILITY` · `ACCOUNT` · `DIAGNOSTICS` — in OXBLOOD.
 *
 * Not `SectionHeader`, and the one difference is the whole reason, exactly as
 * `ActivitySectionHeading` states it: that component sets `variant="eyebrow"`,
 * which is `muted` by contract, and every frame here sets these heads in the
 * accent. `accent` on `canvas` is 8.6:1, so it clears AA at 11px with room to
 * spare; the eyebrow's own tracking, casing and size are untouched.
 */
export function SettingsKicker({ title, className = '' }: { title: string; className?: string }) {
  const theme = useTheme();

  return (
    <Text
      variant="eyebrow"
      accessibilityRole="header"
      className={className}
      style={{ color: theme.accent }}>
      {title}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/** The mark at the head of the membership plate, and the tile it recesses into. */
const MEMBERSHIP_DOT = 14;
const MEMBERSHIP_TILE = 44;

/**
 * The plan door, made prominent — the brief's one named requirement for this
 * page ("membership row prominent for paying members").
 *
 * ── WHAT PROMINENCE IS MADE OF HERE, AND WHAT IT IS NOT ───────────────────
 *
 * Blush ground, an oxblood dot, a size step on the tier name, and position:
 * first thing under the title, above every group head. It is NOT made of
 * weight — the frames set "Cinch Standard" in Helvetica Bold and this app has
 * one sans cut (TY-01/TY-02, `tests/type-weight.test.ts`), so the emphasis is
 * spent as size (`heading`, 20px) rather than as a weight the app does not
 * own. Listed as a deviation.
 *
 * ── AND WHAT IT STILL REFUSES ─────────────────────────────────────────────
 *
 * Everything `membership-row.ts` refused. No price, no renewal intent, no
 * upgrade word, no row at all for a confirmed free account, and a failed read
 * drawn as a failed read rather than as free. This component RENDERS that
 * derivation and does not re-decide any of it: `row` arrives already computed
 * by `membershipRowFor`, which is untouched by this redesign.
 */
export function MembershipPlate({
  row,
  onOpen,
  onRetry,
}: {
  row: MembershipRow;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const press = usePressFeedback(row.chevron);

  /**
   * The mark, and it says which read this is before the words do.
   *
   * A confirmed member gets a bare oxblood dot — the page's one solid accent
   * fill, and it is an assertion. A read that is still in flight or that failed
   * gets a CLAY dot recessed into a pale tile: quieter, unmistakably not the
   * same mark, and never an alarm. That last part is deliberate. A failed
   * subscription read is frightening in a way the failure does not warrant —
   * the server checks entitlements independently, so nothing has been taken
   * away — and dressing it in critical colour would tell the reader something
   * the app does not know.
   */
  const dot = (
    <View
      style={{
        width: MEMBERSHIP_DOT,
        height: MEMBERSHIP_DOT,
        borderRadius: MEMBERSHIP_DOT / 2,
        backgroundColor: row.chevron ? theme.accent : theme.accentWarm,
      }}
    />
  );

  const mark = row.chevron ? (
    dot
  ) : (
    <View
      className="items-center justify-center"
      style={{
        width: MEMBERSHIP_TILE,
        height: MEMBERSHIP_TILE,
        borderRadius: 14,
        // `tray`, not `blush`: the tile sits ON the blush plate and has to
        // recess out of it. A tile in the plate's own colour is not a tile.
        backgroundColor: theme.tray,
      }}>
      {dot}
    </View>
  );

  const body = (
    <View className="flex-1">
      <Text variant="heading">{row.label}</Text>
      {row.value ? (
        <Text variant="note" className="mt-1">
          {row.value}
        </Text>
      ) : null}
    </View>
  );

  // A confirmed member — the only read with somewhere honest to go. One
  // composed node for VoiceOver: the tier and the term are the answer to the
  // question the button asks, not two stops on the way past it.
  if (row.chevron) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[row.label, row.value].filter(Boolean).join('. ')}
        onPress={onOpen}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}>
        <Animated.View style={press.style}>
          <SettingsPlate tone="blush">
            <View
              className="flex-row items-center gap-3.5 px-4 py-4"
              style={{ minHeight: MIN_TAP_TARGET }}>
              {mark}
              {body}
              <SymbolView
                name="chevron.right"
                size={13}
                tintColor={theme.byline}
                resizeMode="scaleAspectFit"
              />
            </View>
          </SettingsPlate>
        </Animated.View>
      </Pressable>
    );
  }

  // Reading, or failed. No chevron in either: "Checking…" has nowhere honest to
  // lead yet, and a failed read must not offer a door built on a fact it could
  // not confirm. The failure gets a Retry and nothing else.
  return (
    <SettingsPlate tone="blush">
      <View
        className="flex-row items-center gap-3.5 px-4 py-4"
        style={{ minHeight: MIN_TAP_TARGET }}>
        {mark}
        {body}
        {row.retry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry reading your membership"
            onPress={onRetry}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="flex-none active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SettingsPlate>
  );
}

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

/**
 * A row that states a fact and offers nothing — "Daily outfit styling".
 *
 * `accessibilityRole="text"` is the whole difference from a disabled control,
 * and it is not cosmetic: a `<Switch disabled>` announces as a switch, which
 * invites a double-tap that can never do anything. The beam search this names
 * has no off switch, so the row makes no offer at all.
 *
 * `hidden` carries the prose the frames cut from the visible line. See
 * `DAILY_STYLING_DISCLOSURE`.
 */
export function StatementRow({
  label,
  fact,
  hidden,
}: {
  label: string;
  fact: string;
  /** Said to VoiceOver after the fact, never drawn. */
  hidden?: string;
}) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={[label, fact, hidden].filter(Boolean).join(' ')}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="px-4 py-3.5">
      <Text variant="body">{label}</Text>
      <Text variant="note" className="mt-1">
        {fact}
      </Text>
    </View>
  );
}

/**
 * The page's one real control: label, a detail line that changes with the
 * state, the state as a WORD in oxblood, and the switch.
 *
 * ── WHY THE WORD, AGAIN ───────────────────────────────────────────────────
 *
 * Because otherwise the preference is carried by the track colour alone, which
 * is one channel and the wrong one. `ToggleRow` already made this refusal by
 * printing "On — …" under the label; the frames move the word to the trailing
 * edge in caps so it is legible in the same glance as the switch. Same rule,
 * the position the frame draws.
 *
 * Not `ToggleRow` itself, then, and not a new prop on it: that component's
 * sub-line IS its state channel by contract, and four other surfaces read it
 * that way. A second arrangement of the same refusal is a component, not a
 * variant.
 *
 * ── WRITING LOCKS THE CONTROL ─────────────────────────────────────────────
 *
 * The shipped row deliberately stayed live during the write, on the reasoning
 * that a toggle which locks under the thumb reads as broken. The frames take
 * the opposite position — "the switch holds its position, the detail says
 * Saving…, and a second tap cannot fire" — and it is the better one for this
 * particular switch: the write is a round trip to Postgres, and a second flip
 * mid-flight races two mutations over one column with no ordering guarantee.
 * The detail line is what keeps it from reading as broken. Listed as a
 * deviation from the shipped comment, which is now wrong.
 */
export function PreferenceRow({
  label,
  detail,
  hint,
  value,
  writing,
  onChange,
}: {
  label: string;
  detail: string;
  /** The governed disclosure, said in full to VoiceOver. */
  hint: string;
  value: boolean;
  writing: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  const word = switchStateWord(value);

  return (
    <View
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        <Text variant="note" className="mt-1">
          {detail}
        </Text>
      </View>
      {/* The word is `accessibilityElementsHidden` — VoiceOver already gets the
          state from the switch's own `checked`, and hearing "ON, switch, on" is
          the duplication a redundant label always is. It is drawn for eyes. */}
      <Text
        variant="eyebrow"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: theme.accent }}>
        {word}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={writing}
        trackColor={{ false: theme.rule, true: theme.accent }}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: writing, busy: writing }}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const INVITE_TILE = 44;

/**
 * "Invite a friend", styled as a designed row — the brief's other named
 * requirement.
 *
 * ── IT INVENTS NOTHING ────────────────────────────────────────────────────
 *
 * The clay tile and the blush ground are the design; the CONTENT is the one
 * permanent link that already exists, printed the way `IV-01` prints it
 * (`inviteUrlForDisplay` — no scheme, because without it the string reads as an
 * address a person owns rather than a URL a machine parses). No new link, no
 * referral reward, no contact upload, no directory. The row routes to the
 * shipped `/invite`.
 *
 * The caller decides whether the row exists at all: until the profile read
 * lands there is no link to hand over, and an empty or disabled invite row is
 * worse than none. See `settings-body.tsx`.
 */
export function InviteRow({ linkDisplay, onPress }: { linkDisplay: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Invite a friend. Your link is ${linkDisplay}`}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="flex-row items-center gap-3.5 bg-blush px-4 py-3.5 active:opacity-60">
      <View
        className="items-center justify-center"
        style={{
          width: INVITE_TILE,
          height: INVITE_TILE,
          borderRadius: 14,
          backgroundColor: theme.accentWarm,
        }}>
        <SymbolView
          name="plus"
          size={17}
          tintColor={theme.canvas}
          resizeMode="scaleAspectFit"
        />
      </View>
      <View className="flex-1">
        <Text variant="heading">Invite a friend</Text>
        {/* One line, ellipsised. A handle can be long (the frames pose
            `@theodora-vasquez-lindqvist`) and the label and chevron hold their
            positions while the link gives way — the link is recoverable on the
            invite page itself, the row's identity is not. */}
        <Text variant="note" numberOfLines={1} className="mt-1">
          {linkDisplay}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={13}
        tintColor={theme.byline}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * One row that summarises the update facts, and expands to all of them.
 *
 * ── WHY IT EXPANDS RATHER THAN PUSHES ─────────────────────────────────────
 *
 * The frame draws a single row with a chevron and a three-fact summary under
 * it, where the shipped page drew five `ValueRow`s in a plate. Taken literally,
 * a chevron means a destination — and there is no diagnostics page in this app,
 * so building one would be a new route invented by a redesign that was told to
 * move nothing.
 *
 * Taken as drawn, a summary of three where the function returns five would
 * quietly drop Build and Updates-enabled, which is precisely the capability
 * loss this page is forbidden from causing. Both readings fail, so the row
 * discloses in place: collapsed it is the frame, expanded it is every fact
 * `updateDiagnostics()` answered, in the same `ValueRow` that shipped. The
 * chevron rotates a quarter turn to say which it is, and `expanded` is on the
 * button so VoiceOver says it too.
 */
export function DiagnosticsRow({
  summary,
  facts,
  expanded,
  onToggle,
}: {
  summary: string;
  facts: readonly UpdateDiagnostic[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <SettingsPlate>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${DIAGNOSTICS_ROW_LABEL}. ${summary}`}
        accessibilityState={{ expanded }}
        onPress={() => {
          haptics.selection();
          onToggle();
        }}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-60">
        <View className="flex-1">
          <Text variant="body">{DIAGNOSTICS_ROW_LABEL}</Text>
          {summary ? (
            <Text variant="note" className="mt-1">
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <SymbolView
            name="chevron.right"
            size={13}
            tintColor={theme.faint}
            resizeMode="scaleAspectFit"
          />
        </View>
      </Pressable>
      {expanded
        ? facts.map((fact) => (
            <View key={fact.label}>
              <Rule tone="hairline" />
              <ValueRow label={fact.label} value={fact.value} />
            </View>
          ))
        : null}
    </SettingsPlate>
  );
}
