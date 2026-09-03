import { useRouter } from 'expo-router';
import { useState } from 'react';

import { DeleteAccountPage } from '@/components/privacy/delete-account-page';
import { usePlan } from '@/features/billing/use-plan';
import { useCloset } from '@/features/closet/queries';
import { useDeleteAccount } from '@/features/auth/use-delete-account';
import { DeleteAccountCard } from '@/features/profile/delete-account-card';
import { membershipCopyFor } from '@/features/profile/membership-copy';

/**
 * PD-06 — Delete your account.
 *
 * The explanation is `components/privacy/delete-account-page.tsx`; the
 * confirmation is `features/profile/delete-account-card.tsx`, reused rather
 * than rebuilt. That card is the app's settled answer to this question — one
 * step that cannot be cleared on autopilot, with the consequences enumerated
 * in real counts — and a second confirmation with different wording on a
 * different surface would be two answers to the same question, one of which
 * would go stale.
 *
 * NOTE FOR THE INTEGRATOR: Profile still carries its own "Delete account" row
 * opening the same card. Both work; whether the row should now point here is
 * `profile.tsx`'s call, not this unit's.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();

  const closet = useCloset();
  const plan = usePlan();
  const deleteAccount = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);

  // Null when the closet has not loaded (or failed to): the card then names
  // "every piece" rather than claiming "your 0 pieces" to someone whose closet
  // simply could not be read.
  const pieceCount = closet.data?.length ?? null;

  const paidPlan = membershipCopyFor({
    plan: plan.plan,
    copy: plan.copy,
    paid: plan.paid,
    trialing: plan.trialing,
    trialEndsAt: plan.trialEndsAt,
    currentPeriodEnd: plan.currentPeriodEnd,
  }).paidPlan;

  /**
   * The no-rollback truth, surfaced inside the card. Deletion is resumable
   * rather than transactional — storage and auth are two systems and no
   * transaction spans them — so a part-way failure has to say both that the
   * removed objects are gone and that running it again finishes the job.
   */
  const deleteError = deleteAccount.error
    ? deleteAccount.error instanceof Error
      ? `${deleteAccount.error.message}\n\nAnything already removed is permanently gone. Tap Delete everything again to finish the job.`
      : 'Something went wrong part-way through. Anything already removed is permanently gone, and your account still exists. Tap Delete everything again to finish the job.'
    : null;

  return (
    <>
      <DeleteAccountPage
        onBack={() => router.back()}
        // Export is a peer of delete, so the route out is a real route out —
        // it replaces this screen rather than stacking a fourth card on the
        // sheet, and Back from there lands on Privacy & data.
        onExportFirst={() => router.replace('/privacy/export')}
        onDelete={() => {
          // A fresh opening should not lead with last time's failure.
          deleteAccount.reset();
          setConfirming(true);
        }}
        busy={deleteAccount.isPending}
      />

      {/* Mounted only while open, so the typed confirmation starts empty on
          every fresh opening. Stays up through a failure — the error and the
          button that resumes the deletion belong on the same surface. */}
      {confirming ? (
        <DeleteAccountCard
          pieceCount={pieceCount}
          paidPlan={paidPlan}
          pending={deleteAccount.isPending}
          errorText={deleteError}
          onDelete={() => deleteAccount.mutate()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
