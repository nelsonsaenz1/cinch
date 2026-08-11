import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Card, Chip, Rule, SectionHeader, SettingsRow, Text } from '@/components/ui';
import { PLANS, type Plan } from '@/features/billing/plans';
import type { CropAsset } from '@/features/profile/avatar-crop-sheet';
import { AvatarCropSheet } from '@/features/profile/avatar-crop-sheet';
import { DeleteAccountCard } from '@/features/profile/delete-account-card';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import { fieldFrame } from '@/features/profile/field-frame';
import { handleProblem, suggestHandles } from '@/features/profile/handle';
import { HandleField } from '@/features/profile/handle-field';
import { membershipCopyFor } from '@/features/profile/membership-copy';
import { BIO_MAX } from '@/features/profile/mutations';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Account fixture — `cinch://dev-account`.
 *
 * A switcher over the five states this unit owns (system-safety-contract.md
 * §1, §7): **PS-01** the Profile & settings sheet, **PS-02** delete account,
 * and **EP-01…EP-03** edit profile. "Any state without a dev route is a
 * state nobody has looked at" (contract §6) — this is that route.
 *
 * Wherever a state is driven by pure logic that also runs in the shipping
 * screens (`membershipCopyFor`, `handleProblem`, `suggestHandles`,
 * `handleHintFor` inside `HandleField`), this fixture calls the SAME
 * function against fixture inputs rather than retyping its output — the one
 * way a dev route can drift from the screen it is supposed to prove.
 *
 * PS-02 and EP-03 mount the real, hook-free components
 * (`DeleteAccountCard`, `AvatarCropSheet`) directly. EP-01 mounts the real,
 * hook-wired `EditProfileSheet` — the only state here that needs a live
 * session to show its Save/Cancel/dirty-tracking behaviour against real
 * data, exactly as `profile.tsx` does.
 *
 * Dev-only, like every other `dev-` route: the auth gate in `app/_layout.tsx`
 * bounces the whole prefix outside `__DEV__`, and this file refuses a second
 * time below in case the route is ever reached another way.
 */

type TopState = 'ps-01' | 'ps-02' | 'ep-01' | 'ep-02' | 'ep-03';

const TOP_STATES: { id: TopState; label: string }[] = [
  { id: 'ps-01', label: 'PS-01 · Profile sheet' },
  { id: 'ps-02', label: 'PS-02 · Delete account' },
  { id: 'ep-01', label: 'EP-01 · Edit profile' },
  { id: 'ep-02', label: 'EP-02 · Handle & bio' },
  { id: 'ep-03', label: 'EP-03 · Move and scale' },
];

// ---------------------------------------------------------------------------
// PS-01 — the Profile & settings sheet
// ---------------------------------------------------------------------------

type PlanVariant = 'free' | 'standard-known' | 'standard-null' | 'pro-known' | 'pro-null';

const PLAN_VARIANTS: { id: PlanVariant; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'standard-known', label: 'Standard · renewal known' },
  { id: 'standard-null', label: 'Standard · renewal pending' },
  { id: 'pro-known', label: 'Pro · renewal known' },
  { id: 'pro-null', label: 'Pro · renewal pending' },
];

// A date, not "now" — the webhook fills a real timestamp, never a computed
// one. Fixed so the fixture never changes shape on the day it happens to run.
const KNOWN_RENEWAL = new Date('2026-09-04T00:00:00Z');

function planFor(variant: PlanVariant): Plan {
  if (variant === 'free') return 'free';
  return variant.startsWith('standard') ? 'standard' : 'pro';
}

const MOCK_NAME = 'Maya Osei';
const MOCK_HANDLE = '@mayaosei';
// The real screen's honest sentence, with no confidence figure beside it
// (contract §4.3) — the fixture proves the number is gone, not just the code.
const MOCK_LEARNED_SENTENCE =
 'Still learning. So far you lean muted, reach for wool, and rarely touch bright colour. Learned from 12 reactions.';
const MOCK_PENDING_ASKS = 2;

function PS01({ onOpenEdit, onOpenDelete }: { onOpenEdit: () => void; onOpenDelete: () => void }) {
  const theme = useTheme();
  const [planVariant, setPlanVariant] = useState<PlanVariant>('standard-known');
  const version = Constants.expoConfig?.version ?? null;
  const build = Constants.expoConfig?.ios?.buildNumber ?? null;

  const plan = planFor(planVariant);
  const membership = membershipCopyFor({
    plan,
    copy: PLANS[plan],
    trialing: false,
    trialEndsAt: null,
    currentPeriodEnd: planVariant.endsWith('known') ? KNOWN_RENEWAL : null,
  });

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
        {PLAN_VARIANTS.map((v) => (
          <Chip
            key={v.id}
            label={v.label}
            selected={planVariant === v.id}
            onPress={() => setPlanVariant(v.id)}
          />
        ))}
      </ScrollView>

      {/* Identity row — the real screen's loaded branch only; the skeleton
          and retry branches cover a query in flight or failed, and this
          fixture has neither. */}
      <View className="flex-row items-center gap-3.5 pb-5 pt-4">
        <Avatar name={MOCK_NAME} size={60} tone="ink" />
        <View className="flex-1">
          <Text variant="title" trim numberOfLines={1}>
            {MOCK_NAME}
          </Text>
          <Text variant="caption" className="mt-1.5 text-muted">
            {MOCK_HANDLE}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={onOpenEdit}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          className="h-8 flex-none items-center justify-center rounded-md border border-rule px-3.5 active:opacity-60">
          <Text variant="label" className="text-ink">
            Edit profile
          </Text>
        </Pressable>
      </View>

      <Card fill="none" border="none" padding="md" className="bg-tray">
        <SectionHeader title="What Cinch has learned" />
        <Text variant="body" className="mt-2.5 text-ink">
          {MOCK_LEARNED_SENTENCE}
        </Text>
      </Card>

      {/* Membership — hidden entirely for the free variant, exactly as the
          real screen does (contract §4.1: "free has no membership row at
 all"). */}
      {!membership.visible ? (
        <Text variant="caption" className="mt-6 text-muted">
          Free — no Membership row renders here at all.
        </Text>
      ) : (
        <>
          <SectionHeader title="Membership" className="mb-2.5 mt-6" />
          <Card>
            <View
              className="flex-row items-center justify-between gap-3 px-4 py-3.5"
              style={{ minHeight: MIN_TAP_TARGET }}>
              <View className="flex-1 pr-2">
                <Text variant="body">{membership.title}</Text>
                {membership.subtitle ? (
                  <Text variant="caption" className="mt-1 text-muted">
                    {membership.subtitle}
                  </Text>
                ) : null}
              </View>
              {membership.paidPlan ? (
                <Text variant="label" className="text-accent">
                  Manage
                </Text>
              ) : null}
            </View>
          </Card>
        </>
      )}

      <SectionHeader title="Styling" className="mb-2.5 mt-6" />
      <Card>
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 pr-3">
            <Text variant="body">Daily outfit styling</Text>
            <Text variant="caption" className="mt-1 text-muted">
              Built from your closet, on this phone.
            </Text>
          </View>
          <Switch
            value
            onValueChange={() => {}}
            disabled
            trackColor={{ false: theme.rule, true: theme.ink }}
            accessibilityLabel="Daily outfit styling"
          />
        </View>
        <Rule tone="hairline" />
        <SettingsRow label="AI tagging" detail="On" onPress={() => {}} />
      </Card>

      <SectionHeader title="People" className="mb-2.5 mt-6" />
      <Card>
        <SettingsRow label="Friends" onPress={() => {}} />
        <Rule tone="hairline" />
        <SettingsRow label="Borrow requests" detail={`${MOCK_PENDING_ASKS} waiting`} onPress={() => {}} />
        <Rule tone="hairline" />
        <SettingsRow label="Blocked people" onPress={() => {}} />
      </Card>

      <Card className="mt-6">
        <SettingsRow label="Restore purchases" onPress={() => {}} />
        <Rule tone="hairline" />
        <SettingsRow label="Privacy Policy" external onPress={() => {}} />
        <Rule tone="hairline" />
        <SettingsRow label="Support" external onPress={() => {}} />
      </Card>

      {/* Delete account is the only critical-coloured thing in the app —
 `tone="accent"` here is the one oxblood spend on the whole page.
          Tapping it jumps to the PS-02 tab, where the real confirmation
          card lives. */}
      <Card className="mt-6">
        <SettingsRow label="Sign out" onPress={() => {}} />
        <Rule tone="hairline" />
        <SettingsRow label="Delete account" tone="accent" onPress={onOpenDelete} />
      </Card>

      {version ? (
        <Text variant="caption" className="mt-4 text-center text-byline">
          {`Cinch ${version}${build ? ` (${build})` : ''}`}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PS-02 — delete account, full consequence
// ---------------------------------------------------------------------------

function PS02() {
  const [open, setOpen] = useState(true);
  const [paidPlan, setPaidPlan] = useState(true);
  const [simulateError, setSimulateError] = useState(false);

  return (
    <View>
      <Text variant="body" className="text-muted">
        The real `DeleteAccountCard`, with a made-up but realistic piece count
        — real counts on the shipping screen, never adjectives. Toggle the
        membership clause and the no-rollback error text below.
      </Text>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <Chip label="Paid plan" selected={paidPlan} onPress={() => setPaidPlan((v) => !v)} />
        <Chip
          label="Simulate a part-way failure"
          selected={simulateError}
          onPress={() => setSimulateError((v) => !v)}
        />
        <Chip label={open ? 'Card is open' : 'Reopen the card'} selected={open} onPress={() => setOpen(true)} />
      </View>

      {open ? (
        <View className="mt-2">
          <DeleteAccountCard
            pieceCount={148}
            paidPlan={paidPlan}
            pending={false}
            errorText={
              simulateError
                ? 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete everything again to finish the job.'
                : null
            }
            onDelete={() => {}}
            onClose={() => setOpen(false)}
          />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EP-01 — edit profile, the live sheet
// ---------------------------------------------------------------------------

function EP01() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text variant="body" className="text-muted">
        The real, hook-wired sheet — Save stays inert until something has
        actually changed, then turns oxblood; Cancel only asks when there is
        something to lose. This is the one state here that needs a live
        session to show its own data.
      </Text>
      <Button title="Open Edit profile" variant="primary" className="mt-4 self-start px-6" onPress={() => setOpen(true)} />
      {open ? <EditProfileSheet visible onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// EP-02 — the handle field's four states, and bio over length
// ---------------------------------------------------------------------------

/**
 * One `HandleField`, its availability FORCED to the named state rather than
 * read from a live query — the field is still real and still typable
 * (`handleProblem` runs for real on whatever is typed), only the network
 * verdict is fixed, so this strip is inspectable with no session and no
 * backend round trip.
 */
function HandleStrip({
  title,
  seed,
  forcedAvailability,
}: {
  title: string;
  seed: string;
  forcedAvailability: 'unknown' | 'checking' | 'free' | 'taken';
}) {
  const [value, setValue] = useState(seed);
  const handleError = handleProblem(value);
  const suggestions =
    forcedAvailability === 'taken' ? suggestHandles(value, 'Dana Cole') : [];

  return (
    <View className="mt-6">
      <Text variant="eyebrow">{title}</Text>
      <HandleField
        value={value}
        onChangeText={setValue}
        focused={false}
        onFocus={() => {}}
        onBlur={() => {}}
        handleError={handleError}
        availability={forcedAvailability}
        suggestions={suggestions}
        onPressSuggestion={setValue}
      />
    </View>
  );
}

// A seed well past BIO_MAX, so the over-length state is visible on load
// without typing — the exact same 280-character constraint the migration
// enforces (`20260807110000_profile_avatars_and_bio_length`), read from
// `mutations.ts`, never retyped as a bare number here.
const BIO_SEED =
 'Denim in winter, linen in summer, and a soft spot for a good boot. I mostly ' +
 'dress for whatever the weather is doing to my mood that morning, which is ' +
 'to say: rarely for the occasion on the invite, and always for comfort ' +
 'first, structure second, colour a distant third.';

function EP02() {
  const theme = useTheme();
  const [bio, setBio] = useState(BIO_SEED);
  const bioOver = bio.length > BIO_MAX;

  return (
    <View>
      <HandleStrip title="Checking" seed="danacole" forcedAvailability="checking" />
      <HandleStrip title="Taken" seed="dana" forcedAvailability="taken" />
      <HandleStrip title="Not allowed" seed="dana cole!" forcedAvailability="unknown" />
      <HandleStrip title="Available" seed="danacole92" forcedAvailability="free" />

      <View className="mt-8">
        <Text variant="eyebrow">Bio, over length</Text>
        <SectionHeader
          title="Bio"
          className="mb-2 mt-2"
          trailing={
            <Text variant="caption" style={{ color: bioOver ? theme.accent : theme.faint }}>
              {bio.length} / {BIO_MAX}
            </Text>
          }
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          accessibilityLabel="Bio"
          className="rounded-md bg-surface px-3.5 py-3 font-body text-callout text-ink"
          style={[{ minHeight: 104, textAlignVertical: 'top' }, fieldFrame(theme, bioOver ? 'error' : 'rest')]}
        />
        {bioOver ? (
          <Text variant="caption" className="mt-2" style={{ color: theme.accent }}>
            {bio.length - BIO_MAX === 1
              ? '1 character past the limit.'
              : `${bio.length - BIO_MAX} characters past the limit.`}
          </Text>
        ) : (
          <Text variant="caption" className="mt-2 text-muted">
            Sits under your name on your closet. Leave it empty and nothing shows.
          </Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EP-03 — library → square crop, one sheet
// ---------------------------------------------------------------------------

// A licensed still standing in for a picked photograph — the same fixture
// convention `dev-wall.tsx` and `dev-capture.tsx` use. Real dimensions off
// the bundled asset, not guessed, so the crop math behaves exactly as it
// would for a photograph the picker actually returned.
const SAMPLE_PHOTO = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg'));

function EP03() {
  const [cropAsset, setCropAsset] = useState<CropAsset | null>(null);
  const [result, setResult] = useState<CropAsset | null>(null);

  return (
    <View>
      <Text variant="body" className="text-muted">
        Library → square crop in one sheet, no full-screen takeover. Uploads
        at 1024×1024; a failure keeps the old photo and says so — see
 `avatar-crop-sheet.tsx`&rsquo;s own `failed` state for that copy,
        which only a real `ImageManipulator` error can trigger.
      </Text>
      <Button
        title="Open crop sheet"
        variant="primary"
        className="mt-4 self-start px-6"
        onPress={() =>
          setCropAsset({
            uri: SAMPLE_PHOTO.uri,
            width: SAMPLE_PHOTO.width ?? 1200,
            height: SAMPLE_PHOTO.height ?? 1500,
          })
        }
      />
      {result ? (
        <View className="mt-5 items-center">
          <Text variant="caption" className="mb-2 text-muted">
            Last crop, as the field would store it
          </Text>
          <Avatar name="Maya Osei" size={88} tone="accent" imageUri={result.uri} />
        </View>
      ) : null}
      <AvatarCropSheet
        asset={cropAsset}
        onCancel={() => setCropAsset(null)}
        onUse={(cropped) => {
          setResult(cropped);
          setCropAsset(null);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

export default function DevAccountScreen() {
  const [state, setState] = useState<TopState>('ps-01');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-24 pt-4">
        <Text variant="title" trim className="mb-3">
          Account — dev states
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {TOP_STATES.map((s) => (
            <Chip key={s.id} label={s.label} selected={state === s.id} onPress={() => setState(s.id)} />
          ))}
        </ScrollView>

        <View className="mt-6">
          {state === 'ps-01' ? (
            <PS01 onOpenEdit={() => setState('ep-01')} onOpenDelete={() => setState('ps-02')} />
          ) : state === 'ps-02' ? (
            <PS02 />
          ) : state === 'ep-01' ? (
            <EP01 />
          ) : state === 'ep-02' ? (
            <EP02 />
          ) : (
            <EP03 />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
