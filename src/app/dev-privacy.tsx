import { Asset } from 'expo-asset';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiConsentPage } from '@/components/privacy/ai-consent-page';
import { DeleteAccountPage } from '@/components/privacy/delete-account-page';
import { ExportPage } from '@/components/privacy/export-page';
import { PrivacyIndexPage } from '@/components/privacy/privacy-index-page';
import { WithdrawConsentSheet } from '@/components/privacy/withdraw-consent-sheet';
import { Chip, Text } from '@/components/ui';
import type { SentItemDetail, SentPhoto } from '@/features/auth/use-ai-privacy';
import type { DataExport } from '@/features/privacy/format';

/**
 * Privacy & data fixture — `cinch://dev-privacy`.
 *
 * A picker over atlas 38 (PD-01…PD-06), so every state can be verified on a
 * simulator. The real screens need a session, a populated `ai_calls` ledger,
 * and — for PD-05 — a `data_exports` row that only the worker can move out of
 * `pending`, which is not something a device can arrange.
 *
 * EVERY FRAME IS DRAWN BY THE SHIPPING COMPONENT. `PrivacyIndexPage`,
 * `AiConsentPage`, `WithdrawConsentSheet`, `ExportPage` and
 * `DeleteAccountPage` are the same objects the four routes render; there is no
 * copy and no re-drawn layout in this file. A fixture that approximates a
 * screen verifies the approximation.
 *
 * The copy is not restated here either — it comes from
 * `features/privacy/copy.ts`, which is where the claim trace lives. So a
 * sentence read off this fixture is the sentence that ships.
 *
 * Dev-only twice over: the gate in `app/_layout.tsx` bounces the whole `dev-`
 * prefix outside `__DEV__`, and this file refuses again below.
 */

const uri = (mod: number) => Asset.fromModule(mod).uri;

const BLOUSE = uri(require('@/assets/garments/white-linen-blouse.jpg'));
const TROUSERS = uri(require('@/assets/garments/charcoal-tailored-trousers.jpg'));
const LOAFERS = uri(require('@/assets/garments/brown-leather-loafers.jpg'));

/** `n` days ago, as an ISO string — so no frame ever reads as a future date. */
function daysAgo(n: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 38, 0, 0);
  return d.toISOString();
}

const SENT_PHOTOS: SentPhoto[] = [
  { itemId: 'i-blouse', sentAt: daysAgo(2) },
  { itemId: 'i-trousers', sentAt: daysAgo(9) },
  { itemId: 'i-loafers', sentAt: daysAgo(23) },
];

const SENT_DETAILS: Record<string, SentItemDetail> = {
  'i-blouse': { id: 'i-blouse', thumbPath: BLOUSE, cutoutPath: null, name: 'Blouse' },
  'i-trousers': { id: 'i-trousers', thumbPath: TROUSERS, cutoutPath: null, name: 'Trousers' },
  'i-loafers': { id: 'i-loafers', thumbPath: LOAFERS, cutoutPath: null, name: 'Loafers' },
};

/**
 * The fixture's signing step, which is no step at all: `SENT_DETAILS` carries
 * display URIs directly, and the real screen only ever hands the component a
 * signed result — so a fixture that skips the signing is drawing the same thing.
 */
const resolveThumb = (cutoutPath: string | null, thumbPath: string | null) =>
  cutoutPath ?? thumbPath ?? undefined;

const EXPORT_PENDING: DataExport = {
  id: 'x-now',
  requestedAt: daysAgo(0),
  status: 'pending',
  readyAt: null,
  bytes: null,
  expiresAt: null,
  error: null,
};

const EXPORT_READY: DataExport = {
  id: 'x-ready',
  requestedAt: daysAgo(1),
  status: 'ready',
  readyAt: daysAgo(1, 10),
  bytes: 412_000_000,
  expiresAt: daysAgo(-6),
  error: null,
};

const EXPORT_OLD: DataExport[] = [
  {
    id: 'x-aug',
    requestedAt: daysAgo(6),
    status: 'ready',
    readyAt: daysAgo(6, 10),
    bytes: 412_400_000,
    // Already past — this is what "link expired" is derived from, and the
    // derivation is the point: there is no 'expired' status to fake.
    expiresAt: daysAgo(1),
    error: null,
  },
  {
    id: 'x-may',
    requestedAt: daysAgo(83),
    status: 'ready',
    readyAt: daysAgo(83, 11),
    bytes: 388_000_000,
    expiresAt: daysAgo(76),
    error: null,
  },
];

const EXPORT_FAILED: DataExport = {
  id: 'x-failed',
  requestedAt: daysAgo(0),
  status: 'failed',
  readyAt: null,
  bytes: null,
  expiresAt: null,
  error: 'Your file stopped part-way through. Nothing of yours changed — ask again below.',
};

const STATES = [
  { id: 'PD-01', name: 'Index — no link SDK' },
  { id: 'PD-01b', name: 'Index — with Link handling' },
  { id: 'PD-02', name: 'AI consent — granted' },
  { id: 'PD-02b', name: 'AI consent — not given' },
  { id: 'PD-02c', name: 'AI consent — back-fill draining' },
  { id: 'PD-03', name: 'Withdraw — the sheet' },
  { id: 'PD-04', name: 'Export — the manifest' },
  { id: 'PD-04b', name: 'Export — one a day refused' },
  { id: 'PD-05', name: 'Export — requested, pending' },
  { id: 'PD-05b', name: 'Export — ready, and earlier' },
  { id: 'PD-05c', name: 'Export — failed' },
  { id: 'PD-05d', name: 'Export — loading' },
  { id: 'PD-05e', name: 'Export — could not be read' },
  { id: 'PD-06', name: 'Delete your account' },
] as const;

type StateId = (typeof STATES)[number]['id'];

export default function DevPrivacyScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<StateId>('PD-01');
  const [sentListOpen, setSentListOpen] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const selected = STATES.find((s) => s.id === state)!;
  const back = () => setState('PD-01');

  const consentFrame = (granted: boolean, phase: 'idle' | 'sending' | 'done') => (
    <AiConsentPage
      granted={granted}
      ready
      grantedAt={granted ? daysAgo(151) : null}
      revokedAt={granted ? null : daysAgo(12)}
      version={granted ? 2 : null}
      taggedCount={SENT_PHOTOS.length}
      listingCount={3}
      untaggedCount={phase === 'sending' ? 4 : phase === 'done' ? 0 : 9}
      backfillPhase={phase}
      onOpenBackfill={() => setState('PD-02c')}
      sentListOpen={sentListOpen}
      onToggleSentList={() => setSentListOpen((open) => !open)}
      sentPhotos={SENT_PHOTOS}
      sentDetails={SENT_DETAILS}
      sentDetailsLoading={false}
      resolveThumb={resolveThumb}
      onBack={back}
      onWithdraw={() => setState('PD-03')}
      onGive={() => setState('PD-02')}
    />
  );

  const exportFrame = (props: Partial<Parameters<typeof ExportPage>[0]>) => (
    <ExportPage
      loading={false}
      error={false}
      onRetry={() => setState('PD-04')}
      exports={[]}
      email="sophie@mail.com"
      requesting={false}
      requestError={null}
      onRequest={() => setState('PD-05')}
      onBack={back}
      {...props}
    />
  );

  return (
    <View className="flex-1 bg-canvas">
      {state === 'PD-01' || state === 'PD-01b' ? (
        <PrivacyIndexPage
          consentDetail="Given 12 March 2026 · describing and matching"
          deferredLinksAvailable={state === 'PD-01b'}
          shoppable={false}
          onToggleShoppable={() => {}}
          onBack={back}
          onOpenConsent={() => setState('PD-02')}
          onOpenExport={() => setState('PD-04')}
          onOpenDelete={() => setState('PD-06')}
        />
      ) : state === 'PD-02' || state === 'PD-03' ? (
        consentFrame(true, 'idle')
      ) : state === 'PD-02b' ? (
        consentFrame(false, 'idle')
      ) : state === 'PD-02c' ? (
        consentFrame(true, 'sending')
      ) : state === 'PD-04' ? (
        exportFrame({})
      ) : state === 'PD-04b' ? (
        exportFrame({ requestError: 'you can ask for one export a day' })
      ) : state === 'PD-05' ? (
        exportFrame({ exports: [EXPORT_PENDING, ...EXPORT_OLD] })
      ) : state === 'PD-05b' ? (
        exportFrame({ exports: [EXPORT_READY, ...EXPORT_OLD] })
      ) : state === 'PD-05c' ? (
        exportFrame({ exports: [EXPORT_FAILED, ...EXPORT_OLD] })
      ) : state === 'PD-05d' ? (
        exportFrame({ loading: true })
      ) : state === 'PD-05e' ? (
        exportFrame({ error: true })
      ) : (
        <DeleteAccountPage
          onBack={back}
          onExportFirst={() => setState('PD-04')}
          onDelete={() => setState('PD-06')}
        />
      )}

      {/* PD-03 · raised over the granted consent page, which is what it is
          raised over in the app. */}
      <WithdrawConsentSheet
        visible={state === 'PD-03'}
        onCancel={() => setState('PD-02')}
        onWithdraw={() => setState('PD-02b')}
      />

      {/* The picker. Scaffolding, not a designed surface. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-rule bg-canvas"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip key={s.id} label={s.id} selected={s.id === state} onPress={() => setState(s.id)} />
          ))}
        </ScrollView>
        <Text variant="caption" className="px-gutter pb-1">
          {selected.id} · {selected.name}
        </Text>
      </View>
    </View>
  );
}
