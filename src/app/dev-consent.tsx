import { Asset } from 'expo-asset';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiPolicyPage } from '@/components/ingest/ai-policy-page';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import {
  ManualTagSections,
  OnThisPhonePill,
  type ManualTags,
} from '@/components/item/manual-tag-sections';
import { TaggingHeader } from '@/components/item/tagging-header';
import { Chip } from '@/components/ui/chip';
import { BackButton, ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';
import type { Item } from '@/schemas/item';

import { DeclineExplainer } from './capture';

/**
 * AI consent fixture — `cinch://dev-consent`.
 *
 * The six states of the AI Consent Atlas (AC-01…AC-06, `docs/design/
 * system-safety-contract.md` §1), each held against the real component it is
 * built from — ConsentSheet, AiPolicyPage, TaggingHeader, DeclineExplainer
 * and ManualTagSections all render here exactly as capture.tsx and item
 * detail feed them, with mock props standing in for a live session. AC-06 is
 * the one exception: Settings reads three live Supabase queries
 * (`useAiConsent`, `useSentPhotos`, `useUntaggedCount`) that need a signed-in
 * session the simulator's dev build cannot fake, so it is a hand-kept replica
 * of `privacy.tsx`'s markup — same contract as `dev-capture.tsx`'s
 * `ConsentReplica` for the sheet underneath it.
 *
 * Same reason this route exists at all: a state with no dev door is a state
 * nobody has looked at (contract §6.6), and AC-01…AC-06 cannot otherwise be
 * judged on-device — three of them need a real photo mid-import, one needs a
 * declined account, one needs a local-mode item, one needs a signed-in
 * Settings screen.
 *
 * Dev-only, like every other `dev-` route: the auth gate in `app/_layout.tsx`
 * refuses the whole prefix outside `__DEV__`.
 */

const KNIT = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;

const FRAMES = [
  'AC-01 Ask',
  'AC-02 Policy',
  'AC-03 Accepted',
  'AC-04 Declined',
  'AC-05 Manual',
  'AC-06 Settings',
] as const;
type Frame = (typeof FRAMES)[number];

/** Enough of a row to feed `TaggingHeader` — the columns it actually reads. */
const MOCK_ITEM: Item = {
  id: 'dev-consent-item',
  userId: 'dev-consent-user',
  imagePath: KNIT,
  cutoutPath: null,
  platePath: null,
  thumbPath: null,
  listingPath: null,
  status: 'pending_tag',
  category: 'top',
  subcategory: 'sweater',
  colors: [{ name: 'cream', hex: '#E4D9C4' }],
  pattern: null,
  material: null,
  brand: null,
  formalityScore: null,
  warmthScore: null,
  waterResistant: false,
  fit: null,
  patternScale: null,
  seasons: [],
  occasions: [],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 0,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: false,
  createdAt: new Date().toISOString(),
};

export default function DevConsentScreen() {
  const [frame, setFrame] = useState<Frame>('AC-01 Ask');
  // AC-02 is normally the sheet's own "Read the full policy" overlay; here it
  // gets its own switcher entry, so it opens pre-slid-in rather than needing a
  // tap to reach.
  const [manual, setManual] = useState<ManualTags>({
    category: 'top',
    colors: [{ name: 'cream', hex: '#E4D9C4' }],
    material: null,
  });

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <StatusBar style={frame === 'AC-01 Ask' ? 'light' : 'dark'} />

      {frame === 'AC-01 Ask' ? (
        // The atlas's own staging: the shot already taken, waiting dark
        // behind the sheet — the decision is about a real photo, not a
        // hypothetical. `visible` is permanently true here; the switcher is
        // the only way off this frame.
        <View className="flex-1 bg-ink">
          <View className="flex-1 items-center justify-center">
            <Text variant="label" style={{ color: 'rgba(251,250,246,0.4)' }}>
              1 photo ready
            </Text>
          </View>
          <ConsentSheet visible busy={false} onAccept={() => {}} onDecline={() => {}} />
        </View>
      ) : null}

      {frame === 'AC-02 Policy' ? <AiPolicyPage onBack={() => {}} /> : null}

      {frame === 'AC-03 Accepted' ? (
        <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
          <ScreenHeader title="Top" />
          <ScrollView contentContainerClassName="px-gutter pb-24">
            <TaggingHeader item={MOCK_ITEM} imageUri={KNIT} />
          </ScrollView>
        </SafeAreaView>
      ) : null}

      {frame === 'AC-04 Declined' ? (
        <DeclineExplainer onAddItem={() => {}} onTurnOnAi={() => {}} />
      ) : null}

      {frame === 'AC-05 Manual' ? (
        <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
          <ScreenHeader title="Top" />
          <ScrollView contentContainerClassName="px-gutter pb-24">
            <View className="mt-2 flex-row items-start gap-4">
              <View className="h-[136px] w-[104px] overflow-hidden rounded-md bg-tray dark:bg-tray-dark" />
              <View className="flex-1 pt-0.5">
                <OnThisPhonePill />
                <Text variant="title" className="mt-3">
                  Untitled item
                </Text>
                <Text variant="label" className="mt-2">
                  Name it, or leave it — the photo is enough.
                </Text>
              </View>
            </View>
            <ManualTagSections value={manual} onChange={(next) => setManual({ ...manual, ...next })} />
          </ScrollView>
        </SafeAreaView>
      ) : null}

      {frame === 'AC-06 Settings' ? <SettingsReplica /> : null}

      {/* The switcher, pinned over the frame so every state is one tap away.
          Deliberately ugly-simple — it is scaffolding, not a design surface. */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5 dark:border-rule-dark dark:bg-canvas-dark">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={frame === f}
              selectedGround="ink"
              onPress={() => setFrame(f)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * AC-06, replicated rather than mounting the real `privacy.tsx` — that screen
 * reads three live Supabase queries keyed to a signed-in session, which a dev
 * fixture cannot honestly fake without inventing a mock query client. Kept in
 * step with `privacy.tsx` by hand, same contract as `dev-capture.tsx`'s
 * `ConsentReplica`.
 *
 * A local toggle switches between the two states the atlas frame's own
 * footnote describes — "Off since 12 March" with the back-fill live, and "On
 * since 12 March · 24 photos sent" with the back-fill spent and the record
 * restored — so both halves of AC-06 are one tap apart rather than needing a
 * second route.
 */
function SettingsReplica() {
  const theme = useTheme();
  const [granted, setGranted] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* Matches privacy.tsx's own hand-built header, not `ScreenHeader` —
          that screen sets the centred title in `plate`, not `colophon`. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => {}} />
        <Text variant="plate" trim accessibilityRole="header" className="flex-1 text-center">
          Privacy
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24 pt-6">
        <Text variant="title" trim accessibilityRole="header">
          AI tagging
        </Text>

        <View className="mt-5 flex-row items-start justify-between gap-4 border-b border-t border-rule py-4">
          <View className="flex-1">
            <Text variant="body">Send photos for tagging</Text>
            <Text variant="caption" className="mt-1 text-muted" style={{ maxWidth: 210 }}>
              {granted ? 'On since 12 March. 24 photos sent.' : 'Off since 12 March. No photo has left this phone.'}
            </Text>
          </View>
          <Switch
            value={granted}
            onValueChange={setGranted}
            trackColor={{ false: theme.rule, true: theme.ink }}
            accessibilityRole="switch"
            accessibilityState={{ checked: granted }}
            accessibilityLabel="Send photos for tagging"
          />
        </View>

        <Text variant="callout" className="mt-5" style={{ color: theme.muted }}>
          {granted
            ? 'Turning this on sends new photos as you add them.'
            : 'Turning this on sends new photos as you add them. It doesn’t go back through the 24 items already in your closet unless you ask it to.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tag the 24 items I already have"
          accessibilityState={{ disabled: !granted }}
          disabled={!granted}
          style={{ minHeight: MIN_TAP_TARGET, opacity: granted ? 1 : 0.5 }}
          className="mt-6 rounded-lg bg-sand p-4 active:opacity-60">
          <Text variant="body" className="font-medium">
            Tag the 24 items I already have
          </Text>
          <Text variant="caption" className="mt-1 text-muted">
            {granted
              ? 'Sends those photos once, then stops.'
              : 'Sends those photos once, then stops. Available after you turn tagging on.'}
          </Text>
        </Pressable>

        {granted ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="See what we sent"
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-7 justify-center border-t border-rule pt-5 active:opacity-60">
            <Text variant="caption" className="text-muted">
              {'Consent recorded 12 March 2026, policy v2. '}
              <Text variant="caption" style={{ color: theme.accent }}>
                See what we sent
              </Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
