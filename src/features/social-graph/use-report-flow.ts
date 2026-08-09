import { useCallback, useState } from 'react';

import type { ReportSubject } from '@/features/social/db-rows';

import { REPORT_REASONS, useBlockUser, useReportContent } from './moderation';

/**
 * RP-01…RP-04 — one reporting surface behind every overflow.
 *
 * "Reporting is a flow, not a page: the same three sheets appear from a
 * comment, a look, an event or a profile, with only the subject line
 * changing." This hook is the flow; `ReportFlowSheets` (components/report) is
 * the three sheets it drives. A caller's own overflow menu (RP-01 — a
 * comment's ⋯, a look's ⋯, a profile's ⋯) stays exactly what it already is;
 * its "Report" row calls `open()` and nothing else changes about it.
 *
 * `REPORT_REASONS` — imported from `moderation.ts`, never redeclared — is the
 * one vocabulary every subject reports through. RP-02's "Tell us what is
 * wrong with THIS COMMENT BY @jtroy_" is the same five reasons a look, an
 * event or a profile picks from; only `subject.label` changes what the
 * sentence names.
 */

export type ReportFlowSubject = {
  subject: ReportSubject;
  /** Id in the subject's table. */
  subjectId: string;
  /** The author, when there is one — required to offer a block (RP-04). */
  subjectUserId?: string | null;
  /** Names exactly what is being acted on — "Comment by @jtroy_". */
  label: string;
  /** "@jtroy_" — the handle RP-03 and RP-04 print. Falls back to the label. */
  handle: string;
};

type Step = 'reason' | 'confirmation' | 'blockOffer';

/**
 * Accounts already offered a block this app session, so RP-04 is "offered
 * once... then never again for that account" — module-level rather than
 * component state because the offer must not repeat even if the sheet is
 * reopened from a different screen. Resets on cold start, which is the right
 * amount of memory for a soft promise like this one; the hard guarantee
 * ("you will not be asked about this account a second time, ever") would need
 * a server-side record of its own, which nothing here asks for.
 */
const offeredBlockFor = new Set<string>();

export interface ReportFlowState {
  /** Non-null while any of the three sheets should be showing. */
  target: ReportFlowSubject | null;
  step: Step | null;
  reason: string | null;
  setReason: (reason: string) => void;
  note: string;
  setNote: (note: string) => void;
  /** Reasons other than "Other" need no note; "Other" requires one. */
  canSubmit: boolean;
  submitting: boolean;
  /** RP-02 → sends the report, then advances to RP-03 on success. */
  submit: () => void;
  submitError: string | null;
  /** RP-03's Done — advances to RP-04 once per account, else closes. */
  acknowledge: () => void;
  /** RP-04's Block. */
  confirmBlock: () => void;
  blocking: boolean;
  /** RP-04's Not now, and the backdrop/Cancel on every step. */
  close: () => void;
  /** RP-01's "Report" row calls this with the subject being acted on. */
  open: (subject: ReportFlowSubject) => void;
  reasons: typeof REPORT_REASONS;
}

export function useReportFlow(): ReportFlowState {
  const report = useReportContent();
  const block = useBlockUser();

  const [target, setTarget] = useState<ReportFlowSubject | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const close = useCallback(() => {
    setTarget(null);
    setStep(null);
    setReason(null);
    setNote('');
  }, []);

  const open = useCallback((subject: ReportFlowSubject) => {
    setTarget(subject);
    setReason(null);
    setNote('');
    setStep('reason');
  }, []);

  const submit = useCallback(() => {
    if (!target || !reason) return;
    report.mutate(
      {
        subject: target.subject,
        subjectId: target.subjectId,
        subjectUserId: target.subjectUserId ?? undefined,
        reason,
        details: reason === 'Other' ? note : undefined,
      },
      { onSuccess: () => setStep('confirmation') },
    );
  }, [target, reason, note, report]);

  const acknowledge = useCallback(() => {
    const userId = target?.subjectUserId;
    if (userId && !offeredBlockFor.has(userId)) {
      offeredBlockFor.add(userId);
      setStep('blockOffer');
      return;
    }
    close();
  }, [target, close]);

  const confirmBlock = useCallback(() => {
    const userId = target?.subjectUserId;
    if (!userId) {
      close();
      return;
    }
    block.mutate({ userId }, { onSettled: close });
  }, [target, block, close]);

  return {
    target,
    step,
    reason,
    setReason,
    note,
    setNote,
    canSubmit: reason !== null && (reason !== 'Other' || note.trim().length > 0),
    submitting: report.isPending,
    submit,
    submitError: report.error instanceof Error ? report.error.message : null,
    acknowledge,
    confirmBlock,
    blocking: block.isPending,
    close,
    open,
    reasons: REPORT_REASONS,
  };
}
