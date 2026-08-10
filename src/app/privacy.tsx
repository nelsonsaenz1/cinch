import { useRouter } from 'expo-router';

import { PrivacyIndexPage } from '@/components/privacy/privacy-index-page';
import { useAiConsent } from '@/features/auth/use-consent';
import { DEFERRED_LINKS_AVAILABLE } from '@/features/invite/native';
import { fullDate } from '@/features/privacy/format';

/**
 * PD-01 — Privacy & data, the index.
 *
 * The page is `components/privacy/privacy-index-page.tsx`; this route is the
 * wiring. The three sub-pages are pushed from here and inherit this screen's
 * presentation (registered as a form sheet in `app/_layout.tsx`, because
 * Privacy is itself reached from the Profile sheet and a plain push would
 * stack a card on top of one) — the same arrangement `diary` and `diary/[id]`
 * already use.
 */
export default function PrivacyScreen() {
  const router = useRouter();
  const consent = useAiConsent();

  const granted = consent.data?.granted ?? false;
  const grantedAt = consent.data?.grantedAt ?? null;
  const revokedAt = consent.data?.revokedAt ?? null;

  // The real state, never a placeholder. "Describing and matching" is the
  // atlas's phrasing and it happens to name both doors a photo goes through
  // (tagging, and the listing match) — which is exactly what the row should
  // say. See features/privacy/copy.ts.
  const consentDetail =
    consent.data === undefined
      ? 'Checking…'
      : granted
        ? grantedAt
          ? `Given ${fullDate(grantedAt)} · describing and matching`
          : 'Given · describing and matching'
        : revokedAt
          ? `Not given · withdrawn ${fullDate(revokedAt)}`
          : 'Not given';

  return (
    <PrivacyIndexPage
      consentDetail={consentDetail}
      // A fact about the binary, resolved once at module scope. The row is
      // drawn only on a build that actually has the attribution module — a
      // disclosure of something the app does not do is exactly as wrong as
      // concealing something it does.
      deferredLinksAvailable={DEFERRED_LINKS_AVAILABLE}
      onBack={() => router.back()}
      onOpenConsent={() => router.push('/privacy/ai')}
      onOpenExport={() => router.push('/privacy/export')}
      onOpenDelete={() => router.push('/privacy/delete')}
    />
  );
}
