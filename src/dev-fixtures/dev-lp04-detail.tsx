import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FactRow, NavRow, StatePill } from '@/app/event/[id]/index';
import { YourLookCard, type YourLookLeading } from '@/components/events/YourLookCard';
import { Text } from '@/components/ui/text';
import { detailTitleTrimmed } from '@/features/events/detail-layout';
import { toGarmentColors } from '@/lib/color';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/**
 * LP-04 above-the-fold capture route — `cinch://dev-lp04-detail`.
 *
 * WHY THIS EXISTS SEPARATELY from `dev-event-detail`. That fixture draws the
 * Event Detail State Atlas (E-01…E-10) — the composition that shipped BEFORE
 * launch polish, including the `VenueCard` "The table" block this packet took
 * off the page. It is still a faithful picture of what it documents and it
 * still compiles; it simply no longer documents the screen. Rather than
 * rewrite it and lose the older atlas's evidence, this route captures the ONE
 * thing LP-04 changed: the order of the first four things a reader sees.
 *
 * WHAT IT IS AND IS NOT. It draws with the real page's own primitives —
 * `StatePill`, `NavRow`, `FactRow` and `YourLookCard`, imported from
 * `event/[id]/index.tsx` and `components/events/` — so the type, spacing,
 * tap-target floor and growth behaviour are the shipping ones rather than a
 * second copy. It is NOT the route: `event/[id]` needs a session, a real
 * occasion, and for half of these frames a specific server state, none of
 * which exist in a simulator. What it therefore CANNOT prove is that the page
 * assembles these pieces in this order — only that each piece looks and grows
 * the way LP-04 asks. The order itself is pinned in `tests/event-lines.test.ts`
 * at source level, which is the honest division of labour between the two.
 *
 * Codex owns visual acceptance; this route exists so there is something to
 * accept. Dev-only, like every other `dev-*` route.
 */

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

const piece = (id: string, colorName: string, subcategory: string): Garment =>
  ({
    id,
    slot: 'base_top',
    category: 'top',
    subcategory,
    colors: toGarmentColors([{ name: colorName }]),
    visualWeight: 3,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    wearCount: 2,
    lastWornAt: null,
    purchasePrice: null,
    thumbPath: null,
    cutoutPath: null,
    platePath: null,
  }) as unknown as Garment;

/** No Storage in a fixture, so plates draw their own empty silhouettes. */
const noResolveImage = () => undefined;

const LOOK: YourLookLeading = {
  garments: [piece('a', 'oxblood', 'shirt'), piece('b', 'indigo', 'trousers')],
  caption: 'The linen one, before it gets cold',
  votes: 3,
};

/** LP-09's 60-character title, exactly. */
const LONG_TITLE = 'Rehearsal dinner for Priya and Daniel at the old boathouse';

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

type Frame = {
  key: string;
  label: string;
  /** The header's one quiet word — the viewer's own standing. */
  standing: string | null;
  title: string;
  canceled?: boolean;
  when: { value: string; secondary?: string | null; action?: string };
  /** Absent entirely for an invitee: §7.1 withholds the place until they join. */
  where: { value: string; secondary?: string | null; action?: string } | null;
  leading: YourLookLeading | null;
  /** Offline is a state of the page, not a fifth row. */
  notice?: string;
};

const FRAMES: readonly Frame[] = [
  {
    key: 'host',
    label: 'Host · look posted',
    standing: 'HOSTING',
    title: 'Dinner at Bar Ideale',
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM · feels 70°, clear evening' },
    where: { value: 'Bar Ideale', secondary: '1615 Platte St, Denver' },
    leading: LOOK,
  },
  {
    key: 'member',
    label: 'Member · nothing shared',
    standing: 'GOING',
    title: 'Dinner at Bar Ideale',
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM' },
    where: { value: 'Bar Ideale', secondary: '1615 Platte St, Denver' },
    leading: null,
  },
  {
    key: 'invitee',
    label: 'Invitee · place withheld (§7.1)',
    standing: null,
    title: 'Dinner at Bar Ideale',
    // The hour is withheld with the place: a coarse date only.
    when: { value: 'Saturday, 8 August' },
    where: null,
    leading: null,
  },
  {
    key: 'no-date',
    label: 'Host · no date yet',
    standing: 'HOSTING',
    title: 'Something in September',
    when: { value: 'No date yet', action: 'Add a date' },
    where: { value: 'Bar Ideale', secondary: '1615 Platte St, Denver' },
    leading: null,
  },
  {
    key: 'no-venue',
    label: 'Host · no place yet',
    standing: 'HOSTING',
    title: 'Dinner somewhere',
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM' },
    // The widening this packet accepted: offered whenever the venue is
    // missing, not only when the date is missing too.
    where: { value: 'No place yet', action: 'Add a place' },
    leading: null,
  },
  {
    key: 'long',
    label: 'Long title · long venue (LP-09)',
    standing: 'GOING',
    title: LONG_TITLE,
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM · feels 70°, clear evening' },
    where: {
      value: 'The Boathouse at Chatfield Reservoir & Gardens',
      secondary: '11500 N Roxborough Park Rd, Littleton, Colorado',
    },
    leading: LOOK,
  },
  {
    key: 'canceled',
    label: 'Canceled',
    standing: 'CANCELLED',
    title: 'Dinner at Bar Ideale',
    canceled: true,
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM' },
    where: { value: 'Bar Ideale', secondary: '1615 Platte St, Denver' },
    leading: LOOK,
  },
  {
    key: 'offline',
    label: 'Offline',
    standing: 'GOING',
    title: 'Dinner at Bar Ideale',
    when: { value: 'Saturday, 8 August', secondary: '7:30 PM' },
    where: { value: 'Bar Ideale', secondary: '1615 Platte St, Denver' },
    leading: null,
    notice: 'Offline — showing what was last loaded.',
  },
];

export default function DevLp04Detail() {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const frame = FRAMES[index]!;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The picker is fixture chrome and is deliberately NOT part of any
          frame — shoot below the rule. `shrink-0` rather than a 48pt cap: the
          cap clipped its own pills at the accessibility sizes, and with the
          content view below now holding `flex-1` there is nothing left for
          this rail to eat. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="shrink-0">
        <View className="flex-row items-center gap-2 px-gutter">
          {FRAMES.map((f, i) => (
            <Pressable
              key={f.key}
              onPress={() => setIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              className="rounded-full border px-3 py-1.5"
              style={{
                borderColor: i === index ? theme.ink : theme.rule,
                backgroundColor: i === index ? theme.ink : 'transparent',
              }}>
              <Text variant="label" style={{ color: i === index ? theme.canvas : theme.muted }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View className="mt-2 border-b border-hairline" />

      <ScrollView
        // As on the real page: without `flex-1` this measures against its own
        // content, so at the accessibility sizes the frame grows past the
        // screen and the page is clipped with nothing to scroll.
        className="flex-1"
        contentContainerClassName="px-gutter pb-16"
        showsVerticalScrollIndicator={false}>
        {/* 1 — back, and the viewer's own standing as one quiet word. */}
        <View className="mt-4 flex-row items-center justify-between">
          <Text variant="label" style={{ color: theme.accent }}>
            Back
          </Text>
          {frame.standing ? <StatePill label={frame.standing} /> : null}
        </View>

        {/* 2 — the title, cap-trimmed only while it is one line. */}
        <View className="mt-5">
          <Text
            variant="title"
            trim={detailTitleTrimmed(fontScale)}
            style={frame.canceled ? { color: theme.muted } : undefined}>
            {frame.title}
          </Text>
        </View>

        {frame.notice ? (
          <Text variant="label" className="mt-3" style={{ color: theme.muted }}>
            {frame.notice}
          </Text>
        ) : null}

        {/* 3 — when and where, two scannable rows. */}
        <View className="mt-6">
          <FactRow
            label="When"
            value={frame.when.value}
            secondary={frame.when.secondary ?? null}
            actionLabel={frame.when.action}
            onAction={frame.when.action ? () => {} : undefined}
            last={!frame.where}
          />
          {frame.where ? (
            <FactRow
              label="Where"
              value={frame.where.value}
              secondary={frame.where.secondary ?? null}
              actionLabel={frame.where.action}
              onAction={frame.where.action ? () => {} : undefined}
              last
            />
          ) : null}
        </View>

        {/* 4 — Your look, the primary content and action. */}
        <View className="mt-6">
          <YourLookCard
            leading={frame.leading}
            resolveImage={noResolveImage}
            locked={frame.canceled ?? false}
            onSwap={() => {}}
            onShare={() => {}}
          />
        </View>

        {/* Everything below the fold begins here — drawn only far enough to
            prove `Your look` wins the fold, never as a second detail page. */}
        <View className="mt-8">
          <NavRow label="Who's wearing what" trailing="4 of 6" onPress={() => {}} />
          <NavRow label="Table talk" trailing="3" onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
