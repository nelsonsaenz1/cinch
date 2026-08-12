import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button, Card, Chip, Rule, SectionHeader, Text } from '@/components/ui';
import { RETENTION_DAYS } from '@/features/activity/retention';
import {
  allChannelsOff,
  channelCountLine,
  channelsInGroup,
  channelStateWord,
  MORNING_EDIT_SLOTS,
  morningEditDescription,
  NOTIFICATION_GROUPS,
  wouldArriveDescription,
  type MorningEditTime,
  type NotificationChannel,
  type NotificationChannelKey,
  type NotificationPrefs,
} from '@/features/push/channels';
import type { PushPermission } from '@/features/push/permission';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Notification preferences — atlas 37, states NP-01…NP-04.
 *
 * Presentational on purpose. `notifications.tsx` feeds it live Supabase reads
 * and `dev-notifications.tsx` feeds it fixtures, so all four states can be
 * looked at on a binary that has no push module at all — which is every binary
 * in the field right now (contract §6.2). The alternative, a dev route that
 * hand-replicates the screen's markup, is how a fixture and its screen drift.
 *
 * The four states are not four layouts. They are one page under four
 * predicates:
 *
 *   NP-01  the default — two groups of channels, each row saying what arrives
 *   NP-02  `allChannelsOff(prefs)` — a quiet note, not a warning
 *   NP-03  `permission === 'denied'` — switches keep their values, drawn dimmed
 *   NP-04  the morning edit expanded — the one channel with a setting beyond on/off
 *
 * NP-02 and NP-03 can both be true at once, and the banner wins: a phone that
 * is refusing everything is the more urgent fact, and the "all off" note would
 * be telling someone the consequence of a choice they did not make.
 */
export type NotificationPreferencesViewProps = {
  prefs: NotificationPrefs;
  permission: PushPermission;
  /** A channel switch moved. The caller writes; this view never mutates. */
  onToggle: (key: NotificationChannelKey, next: boolean) => void;
  onPickTime: (value: MorningEditTime) => void;
  /** NP-03's one route out. */
  onOpenSettings: () => void;
  /**
   * Whether the morning edit opens with its schedule already showing.
   *
   * Exists for the dev route: NP-04 *is* the expanded state, and a fixture that
   * required a tap before it looked like its own frame would be a state nobody
   * had actually looked at. Uncontrolled after mount — the row still opens and
   * closes on its own — so `dev-notifications.tsx` remounts by key when the
   * frame changes.
   */
  initialScheduleOpen?: boolean;
};

export function NotificationPreferencesView({
  prefs,
  permission,
  onToggle,
  onPickTime,
  onOpenSettings,
  initialScheduleOpen = false,
}: NotificationPreferencesViewProps) {
  const theme = useTheme();
  // NP-04. Collapsed by default — NP-01 draws the morning edit switched on with
  // no schedule showing, so the four times are something you go and look for,
  // not a permanent shelf under the first row.
  const [scheduleOpen, setScheduleOpen] = useState(initialScheduleOpen);

  const denied = permission === 'denied';
  const quiet = !denied && allChannelsOff(prefs);

  return (
    <>
      <Text variant="title" trim accessibilityRole="header">
        Notifications
      </Text>

      {/* NT-01's standing sentence — the count comes off the channel table, so
          a sixth channel cannot be added without this line changing to match.
          Dropped under NT-02, where the banner is already saying the more
          important thing and two paragraphs of preamble would bury the way out. */}
      {denied ? null : (
        // The colour is an inline style, not a `text-muted` class: `callout`
        // already carries `text-ink`, and NativeWind gives no precedence
        // between two `text-*` utilities on one element (text.tsx, button.tsx
        // L75). privacy.tsx sets its own lead paragraph the same way.
        <Text variant="callout" className="mt-3.5" style={{ color: theme.muted }}>
          {channelCountLine()}
        </Text>
      )}

      {/* NT-02. A white card, not a warning tint: the phone refusing
          notifications is a state, not a failure, and nothing is broken. The
          action is `ink`, not the accent — it is neither destructive nor this
          page's one oxblood thing (there isn't one), and the atlas draws it in
          ink besides.

          The cause is stated ONCE, here, and every row below then shifts to
          the conditional rather than each repeating it. */}
      {denied ? (
        <Card padding="lg" className="mt-5">
          <Text variant="body">Your phone is not letting Cinch send notifications</Text>
          <Text variant="note" className="mt-1.5">
            These preferences are remembered and will take effect if you allow notifications in
            Settings. Nothing is sent in the meantime.
          </Text>
          <Button
            title="Open Settings"
            variant="ink"
            onPress={onOpenSettings}
            accessibilityHint="Opens Cinch in the iOS Settings app"
            className="mt-3.5 self-start px-4"
          />
        </Card>
      ) : null}

      {/* NP-02. The tray ground, no border — the quiet note grammar Profile
          uses for "What Cinch has learned". Deliberately not `Notice` and
          deliberately not critical-toned: turning everything off is a
          legitimate choice, and this states the one thing the reader needs
          rather than trying to talk them out of it. */}
      {quiet ? (
        <Card fill="none" border="none" padding="lg" className="mt-5 bg-tray">
          <Text variant="body">All off</Text>
          <Text variant="note" className="mt-1.5">
            Nothing will be sent. Requests, borrows and invitations still arrive — they wait for you
            on Activity.
          </Text>
        </Card>
      ) : null}

      {NOTIFICATION_GROUPS.map((group) => (
        <Fragment key={group.id}>
          <SectionHeader title={group.title} className="mb-2.5 mt-6" />
          <Card>
            {channelsInGroup(group.id).map((channel, index) => (
              <Fragment key={channel.key}>
                {index > 0 ? <Rule tone="hairline" /> : null}
                <ChannelRow
                  channel={channel}
                  on={prefs[channel.key]}
                  dimmed={denied}
                  description={
                    denied
                      ? wouldArriveDescription(channel, prefs.morningEditAt)
                      : `${channelStateWord(prefs[channel.key])} — ${
                          channel.key === 'morning_edit'
                            ? morningEditDescription(prefs.morningEditAt)
                            : channel.description
                        }`
                  }
                  expandable={channel.key === 'morning_edit' && prefs.morning_edit && !denied}
                  expanded={scheduleOpen}
                  onToggleExpanded={() => setScheduleOpen((open) => !open)}
                  onValueChange={(next) => onToggle(channel.key, next)}
                />
                {channel.key === 'morning_edit' && prefs.morning_edit && !denied && scheduleOpen ? (
                  <>
                    <Rule tone="hairline" />
                    <MorningEditSchedule value={prefs.morningEditAt} onPick={onPickTime} />
                  </>
                ) : null}
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}

      {/* The closing lines. Under NT-02 the page says where the information
          waits instead — a reader who cannot be sent anything needs the
          destination, not the schedule policy.

          "Never contains a garment photograph" is a claim about the sender, and
          it holds: `supabase/functions/send-push/copy.ts` builds every payload
          out of counts, names and event titles, and no branch of it can reach
          an image. The 30 days is `RETENTION_DAYS`, which is itself the
          `interval '30 days'` in `20260810100100_activity_feed.sql:116`. */}
      {denied ? (
        <Text variant="note" className="mt-5">
          Everything in Cinch still works. Requests, invitations and comments wait for you in
          Activity, for the same {RETENTION_DAYS} days either way.
        </Text>
      ) : (
        <>
          <Text variant="note" className="mt-5">
            A notification never contains a garment photograph. Turning everything off leaves Cinch
            fully usable; Activity keeps the same {RETENTION_DAYS} days either way.
          </Text>
          <Text variant="note" className="mt-2.5">
            Quiet hours follow your phone&rsquo;s Do Not Disturb. Cinch adds none of its own.
          </Text>
        </>
      )}
    </>
  );
}

/**
 * One channel: what it sends, and the switch.
 *
 * The description is set in `muted`, not the atlas's #8A8578 — that is `faint`,
 * ~3.5:1 on canvas and an AA failure, and this is the sentence the whole screen
 * exists to make legible. Standing refusal 1.
 */
function ChannelRow({
  channel,
  description,
  on,
  dimmed,
  expandable,
  expanded,
  onToggleExpanded,
  onValueChange,
}: {
  channel: NotificationChannel;
  description: string;
  on: boolean;
  /**
   * NP-03. The **switch** is dimmed and inert; the title and the description
   * are not. The atlas greys the whole row, but its own footnote says what the
   * dimming is for — "switches keep their remembered values but are drawn
   * dimmed, so nothing is silently reset" — and the promise each row makes is
   * exactly what a reader deciding whether to go to Settings needs to be able
   * to read. WCAG exempts a disabled control; it does not exempt the prose
   * beside one.
   */
  dimmed: boolean;
  expandable: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  const body = (
    <>
      <View className="flex-row items-center gap-1.5">
        <Text variant="body">{channel.title}</Text>
        {expandable ? (
          <SymbolView
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={11}
            tintColor={theme.byline}
            resizeMode="scaleAspectFit"
          />
        ) : null}
      </View>
      <Text variant="note" className="mt-1">
        {description}
      </Text>
    </>
  );

  return (
    <View className="flex-row items-start gap-3.5 p-4">
      {expandable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${channel.title} schedule`}
          accessibilityState={{ expanded }}
          accessibilityHint={expanded ? 'Hides the send time' : 'Shows when the edit is sent'}
          onPress={onToggleExpanded}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="flex-1 active:opacity-60">
          {body}
        </Pressable>
      ) : (
        <View className="flex-1">{body}</View>
      )}
      <Switch
        value={on}
        onValueChange={onValueChange}
        disabled={dimmed}
        // The remembered value is still drawn — an inert switch that snapped to
        // off would be the app rewriting a preference the phone merely refused
        // to act on. Overridden is a TRAY TRACK and a paper knob rather than a
        // half-opacity ink one: dropping opacity takes the label and the
        // description down with it, and those are what a reader deciding
        // whether to go to Settings has to be able to read.
        trackColor={{
          false: dimmed ? theme.tray : theme.rule,
          true: dimmed ? theme.tray : theme.ink,
        }}
        thumbColor={dimmed ? theme.surface : undefined}
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: dimmed }}
        accessibilityLabel={channel.title}
        accessibilityHint={
          dimmed ? 'Unavailable — your phone is not allowing notifications' : description
        }
      />
    </View>
  );
}

/**
 * NP-04 — four times, no free picker.
 *
 * `morning_edit_at` is constrained to exactly these four in SQL, because the
 * cron that sends the edit runs on the quarter hour: an arbitrary time would be
 * a schedule nobody wrote a sender for. The footnote is the honest failure
 * mode, and it is the atlas's own sentence — a late weather read delays the
 * edit rather than sending a guess.
 */
function MorningEditSchedule({
  value,
  onPick,
}: {
  value: MorningEditTime;
  onPick: (next: MorningEditTime) => void;
}) {
  return (
    <View className="px-4 pb-4 pt-3">
      <SectionHeader title="Sent at" className="mb-2.5" />
      <View className="flex-row gap-2">
        {MORNING_EDIT_SLOTS.map((slot) => (
          // `size="tap"` rather than the atlas's 38pt: four chips in a row that
          // each set a schedule are a chooser, and the New Occasion atlas
          // already settled that a chooser draws its 44pt rather than borrowing
          // it from invisible slop. `selectedGround="ink"` is the atlas's fill.
          <View key={slot.value} className="flex-1">
            <Chip
              label={slot.label}
              size="tap"
              selected={slot.value === value}
              selectedGround="ink"
              accessibilityHint={`Sends the morning edit at ${slot.label}am`}
              onPress={() => onPick(slot.value)}
            />
          </View>
        ))}
      </View>
      <Text variant="note" className="mt-2.5">
        If the weather has not come in by then, the edit waits rather than sending a guess.
      </Text>
    </View>
  );
}
