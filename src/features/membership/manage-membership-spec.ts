/**
 * Redesign 30 — what the two membership pages may say, computed once.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT IS NOT IN `features/billing` ─────────
 *
 * `features/billing/` is the shipped machinery: `plans.ts` (the tier facts),
 * `manage-membership.ts` (MB-08's traced claims), `upgrade-delta.ts` (MB-09's
 * three rows), `placements.ts` (which placement fires for whom). Redesign 30
 * changes the DRAWING of those facts and none of the facts, so not one file in
 * that folder is touched by this pass — the routing, the deltas and the plan
 * table are exactly what they were, and `tests/manage-membership-layout.test.ts`
 * pins that they still are.
 *
 * What the redesign genuinely adds is presentation: a capacity meter's
 * fraction, the near-limit advice, the ending-truth block, the restore endings
 * this page draws in place, and the composed VoiceOver sentences the frames
 * specify. All of it derives from `PLANS` and from a read; none of it is a new
 * claim. It lives here so the shipping routes and the `dev-mm-*` fixtures
 * compute identical copy from identical inputs — the same rule
 * `membership-row.ts` states, on a surface where "looks correct" and "is
 * correct" are different claims about somebody's money.
 *
 * ── NO PRICE, NO TERM, NO TRIAL WORD ──────────────────────────────────────
 *
 * Not one string below carries a currency symbol, a period, a per-month
 * figure, a saving, a proration amount or the word "trial" in a promise. The
 * store owns every one of those: paywall 254200 renders the localized StoreKit
 * price, and Apple's subscription list owns cancellation. `TRIAL_MARK_PREFIX`
 * is the single exception to the trial word and it is not a promise — it
 * labels a date the SERVER granted and has already stored, which is the one
 * trial fact this app can read. `tests/manage-membership-layout.test.ts`
 * sweeps this file and every layout that renders it.
 *
 * Pure and React-free, for the reason `manage-membership.ts` gives.
 */

import { PLANS, type PlanCopy } from '@/features/billing/plans';
import { numberWord } from '@/features/onboarding/reveal-copy';

// ---------------------------------------------------------------------------
// The masthead
// ---------------------------------------------------------------------------

/** The tracked eyebrow over both pages' plates. */
export const MEMBERSHIP_EYEBROW = 'MEMBERSHIP';
export const UPGRADE_EYEBROW = 'MOVE TO PRO';

/**
 * The plate while the subscription read is in flight, and the plate when there
 * is no tier to name.
 *
 * "Checking…" is set as the plate rather than as a line under one, because a
 * masthead that printed a tier it had not read would be the lie this whole
 * page is organised against. `MASTHEAD_UNREAD` is the neutral word the failed
 * read stands under — never "Cinch Free", which would present `usePlan()`'s
 * least-privilege default as a confirmed fact.
 *
 * A CONFIRMED free account does name its tier, and that is not the same
 * claim: `membershipSurface()` reaches that state only after `loading` and
 * `unconfirmed` are both ruled out, so "Cinch Free" there is a read rather
 * than a default. The two states that have genuinely read nothing still name
 * nothing.
 */
export const MASTHEAD_CHECKING = 'Checking…';
export const MASTHEAD_UNREAD = 'Membership';

/** "Cinch Standard". The tier the read named, never one assumed. */
export function mastheadTier(copy: PlanCopy): string {
  return `Cinch ${copy.name}`;
}

/**
 * "14 September 2026" — day, month and YEAR.
 *
 * `membershipDate` in `membership-row.ts` deliberately prints day and month
 * only: it sets a trailing value inside a settings row, where a year costs
 * width the label needs. The masthead colophon is a line of its own and the
 * frames set the year in it, which matters more here than there — a paid-
 * through date with no year is ambiguous for exactly the twelve months a
 * yearly subscription lasts. Two positions, two formats; neither invents a
 * value, and `membership-row.ts` is untouched.
 */
export function membershipDateLong(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export const PAID_MARK_PREFIX = 'PAID THROUGH';
/**
 * The trial's own prefix.
 *
 * NOT a promise and not an offer. `subscriptions.trial_ends_at` is a date the
 * server has already written — the one 14-day access trial an account is
 * granted — so printing it is reporting a read, which is the opposite of the
 * "start a free trial" copy correction 06 forbids and which App Store Connect
 * could not currently back with an introductory offer anyway.
 */
export const TRIAL_MARK_PREFIX = 'TRIAL THROUGH';

/**
 * The colophon under the plate: which clock, and until when.
 *
 * EMPTY when neither date has been read. The line is then not drawn at all,
 * rather than softened into "until the end of your term" — a paraphrase of a
 * value we do not have reads as a fact and is not one.
 */
export function termMark(input: {
  trialing: boolean;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}): string {
  if (input.trialing) {
    return input.trialEndsAt
      ? `${TRIAL_MARK_PREFIX} ${membershipDateLong(input.trialEndsAt).toUpperCase()}`
      : '';
  }
  return input.currentPeriodEnd
    ? `${PAID_MARK_PREFIX} ${membershipDateLong(input.currentPeriodEnd).toUpperCase()}`
    : '';
}

// ---------------------------------------------------------------------------
// What you have
// ---------------------------------------------------------------------------

export const CAPACITY_KICKER = 'WHAT YOU HAVE';
export const CHANGE_KICKER = 'CHANGE';

const n = (v: number) => v.toLocaleString('en-US');

/** One capacity row: the count, the ceiling, and the fill that draws them. */
export type CapacityRow = {
  readonly label: string;
  /** "88 of 150" — the count first, because the count is the fact. */
  readonly value: string;
  readonly used: number;
  readonly limit: number;
  /** 0…1, clamped. The meter's width, never a percentage printed as words. */
  readonly fraction: number;
  /** One composed node: "Active pieces, 88 of 150." */
  readonly spoken: string;
};

function row(label: string, used: number, limit: number): CapacityRow {
  return {
    label,
    value: `${n(used)} of ${n(limit)}`,
    used,
    limit,
    // A ceiling of zero cannot happen with any tier in `PLANS`, but a division
    // that can produce NaN inside a width is a blank meter nobody can debug.
    fraction: limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0,
    spoken: `${label}, ${n(used)} of ${n(limit)}.`,
  };
}

/**
 * The only two entitlements the client can COUNT.
 *
 * Correction 36, unchanged by the redesign: `useCapacity()` reads both off
 * `items` against `PLANS[plan]`, mirroring the two database ceilings. Stylist
 * chats and hosted events are real product promises with no client-side
 * counter behind them, and the frames' own note says it — they "never appear
 * as a fake meter".
 *
 * `null` means the count is IN FLIGHT, not zero. A pending row draws a
 * skeleton and no number: "0 of 150" is a claim about somebody's closet, and a
 * wrong count on a capacity page is worse than a moment of nothing.
 */
export function capacityRows(input: {
  copy: PlanCopy;
  used: number | null;
  stored: number | null;
}): readonly CapacityRow[] {
  const rows: CapacityRow[] = [];
  if (input.used !== null) rows.push(row('Active pieces', input.used, input.copy.items));
  if (input.stored !== null) rows.push(row('Stored pieces', input.stored, input.copy.storedItems));
  return rows;
}

/**
 * How close to a ceiling counts as close enough to say something.
 *
 * Five, and it is a display threshold rather than a rule — nothing is refused
 * at six and permitted at four; the database refuses at the ceiling and only
 * at the ceiling. Five is simply the point at which "148 of 150" stops being a
 * figure and starts being a thing to do something about.
 */
export const NEAR_LIMIT_SLOTS = 5;

export type CapacityAdvice = { readonly title: string; readonly body: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The advice card, and only when there is advice to give.
 *
 * TWO CEILINGS, TWO REMEDIES, and that is the whole reason this branches
 * rather than printing one sentence. Storing a piece frees an ACTIVE slot
 * without removing anything from the account, which is a real exit. It does
 * nothing at all for the TOTAL ceiling, because the stored piece is what
 * counts against it — so the stored card says what stored counts rather than
 * offering a remedy that would not work. Promising "make room" where making
 * room cannot help is the dead end `use-capacity.ts` split its two counts to
 * remove.
 *
 * The stored ceiling wins when both are close: it is the one with no in-app
 * remedy, so it is the one worth the reader's attention.
 */
export function capacityAdvice(input: {
  copy: PlanCopy;
  used: number | null;
  stored: number | null;
}): CapacityAdvice | null {
  const { copy, used, stored } = input;

  if (stored !== null) {
    const left = copy.storedItems - stored;
    if (left >= 0 && left <= NEAR_LIMIT_SLOTS) {
      return {
        title: `${cap(numberWord(left))} stored slot${left === 1 ? '' : 's'} left`,
        body: 'Stored counts every piece on the account, active and put away.',
      };
    }
  }

  if (used !== null) {
    const left = copy.items - used;
    if (left >= 0 && left <= NEAR_LIMIT_SLOTS) {
      return {
        title: `${cap(numberWord(left))} active slot${left === 1 ? '' : 's'} left`,
        body: 'Storing a piece frees an active slot without removing it from the account.',
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// What ending it actually does
// ---------------------------------------------------------------------------

/**
 * The free line, as a phrase, from `PLANS.free` — which is what
 * `item_limit_for_plan()` and `item_total_limit_for_plan()` enforce.
 */
export function freeLinePhrase(): string {
  return `${n(PLANS.free.items)} active and ${n(PLANS.free.storedItems)} stored`;
}

/**
 * The standing note under the page. Correction 35's better news, in one line.
 *
 * Both ceilings are enforced `before insert on items` and `before update of
 * is_archived`; neither trigger fires on an existing row. So a closet that is
 * over the line after a membership ends stays whole — every piece, every
 * photograph — and what stops is adding and restoring. No auto-archive is
 * promised, because none exists, and no chooser is promised either.
 */
export function endingNote(): string {
  return (
    `If a membership ends, nothing is deleted. Adding and restoring pause ` +
    `until the closet is back under ${freeLinePhrase()}.`
  );
}

/**
 * ── THE EXPANDED "IF THIS MEMBERSHIP ENDS" BLOCK IS NOT A SECOND STATE ────
 *
 * The artifact draws it as `membership-downgrade-over-free-line-truth`, and it
 * is tempting to read that as a card the page grows when a closet is over the
 * free ceilings. It is not one, and the frames themselves settle it: that
 * frame and `membership-standard-default` pose the SAME account — 88 active,
 * 214 stored — and draw different things. Identical inputs cannot select
 * between two states, so the expanded block is an annotation of the standing
 * note rather than an alternative to it.
 *
 * Building it as a condition would also have inverted the page. Free holds ten
 * active pieces, so essentially every paying member is "over the line" and
 * would have seen four lines of downgrade prose on every visit while the note
 * that eight frames draw appeared for almost nobody.
 *
 * So the note above is what is drawn, and the expanded truth — every clause of
 * it, traced, in `cancellationConsequence()` — is what the note is LABELLED
 * with. A screen reader hears the long version; the page prints the short one.
 * That is this program's standing rule for prose a redesign removes.
 */

// ---------------------------------------------------------------------------
// Changing it
// ---------------------------------------------------------------------------

/**
 * The upgrade row's sub-line.
 *
 * The frames set it as "More room, packing memos" — the two entitlement facts
 * the move is actually made of, and the one thing on this row that is allowed
 * to be shorter than the shipped `upgradeRowDetail()`. No price and no term:
 * those are a live StoreKit read two surfaces on, and paywall 254200 is what
 * makes one.
 */
export const UPGRADE_ROW_SUBLABEL = 'More room, packing memos';

export const CANCEL_ROW_SUBLABEL = 'Handled by Apple';
/**
 * The trailing mark on the cancel row.
 *
 * The frames print "Opens Settings". This app's link is
 * `apps.apple.com/account/subscriptions`, which opens the App Store's own
 * subscription list — so "Opens Settings" would name the wrong destination.
 * The frame's intent is that the row LEAVES the app, which the up-right glyph
 * and this mark both carry. Listed as a deviation.
 */
export const CANCEL_ROW_MARK = 'Opens the App Store';

export const RESTORE_ROW_LABEL = 'Restore purchase';
export const RESTORE_ROW_SUBLABEL = 'If a membership was bought on another device';
/** While the store is being asked. Nothing is claimed yet. */
export const RESTORE_ROW_PENDING = 'Asking the App Store';
export const RESTORE_PENDING_NOTE = 'Nothing has changed yet.';

/**
 * Pro's absence, stated once.
 *
 * A disabled "Move to Pro" would be a control that can never act; a silent
 * absence leaves a reader wondering whether the row failed to load. One line
 * is the answer to both.
 */
export const PRO_IS_LARGEST: CapacityAdvice = {
  title: 'Pro is the largest membership',
  body: 'There is nothing above it to move to, so no upgrade row is drawn.',
};

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

/**
 * ── THE FREE REFUSAL IS GONE (2026-09-02) ─────────────────────────────────
 *
 * `NO_MEMBERSHIP_LINE` — "There is no membership on this account to manage." —
 * stood here, drawn to a confirmed free account with one way back. It was
 * written for a page nobody was supposed to reach without a subscription, and
 * the reasoning under it was sound as far as it went: no upsell is placed on a
 * refusal.
 *
 * The mistake was upstream of the copy. That reader was not refused anything.
 * They opened the membership page of an app that had been selling them a
 * membership on Today and in Closet, and the page told them there was nothing
 * there. The state is not a refusal, so it does not get refusal copy — it gets
 * what it holds, what each tier adds, and one door. `membership-surface.ts`
 * owns the distinction now, and `tests/membership-surface.test.ts` holds it.
 *
 * The way back stays; every state on both pages has one.
 */
export const BACK_TO_SETTINGS = 'Back to Settings';

/** The read failed. Never collapsed into "free" — see `use-plan.ts`. */
export const UNCONFIRMED_TITLE = 'Your membership can’t be confirmed right now';
export const UNCONFIRMED_BODY =
  'Nothing has changed and nothing is locked. The App Store still holds your subscription either way.';
export const TRY_AGAIN = 'Try again';

// ---------------------------------------------------------------------------
// Restore endings
// ---------------------------------------------------------------------------

export type RestoreEnding = {
  readonly title: string;
  readonly body: string;
  /** Present only where a retry is the honest next step. */
  readonly action?: string;
};

/**
 * The three endings, drawn IN PLACE rather than raised as an `Alert`.
 *
 * UX-08's classification, applied where the option `use-restore-purchases.ts`
 * already offers was built to be used: a restore that succeeded is a success
 * and a restore that found nothing is recoverable, and neither is worth a
 * blocking modal on the page whose row caused it. The row stays on screen and
 * stays pressable underneath.
 *
 * `restored` names the TIER that came back, from the read — not a generic
 * "you're all set", which is the ending a reader cannot verify.
 */
export function restoreRestored(copy: PlanCopy): RestoreEnding {
  return {
    title: 'Membership restored',
    body: `Your ${mastheadTier(copy)} membership is active on this device.`,
  };
}

export const RESTORE_NONE: RestoreEnding = {
  title: 'No purchase found on this Apple Account',
  // The real cause, and it is not an error: the store ANSWERED. Saying so is
  // what keeps a reader from concluding their purchase vanished.
  body: 'Nothing has changed. A membership bought on a different Apple Account restores only on that account.',
  action: TRY_AGAIN,
};

export const RESTORE_FAILED: RestoreEnding = {
  title: 'The App Store couldn’t be reached',
  body: 'Nothing has changed on your membership.',
  action: TRY_AGAIN,
};

// ---------------------------------------------------------------------------
// MB-09 — the upgrade page
// ---------------------------------------------------------------------------

/**
 * The headline, and it is the deltas' own summary rather than a sales line.
 *
 * "More room, and the packing memos" names the two things `upgradeDelta()`
 * returns and nothing else. No superlative, no saving, no urgency, no figure.
 */
export const UPGRADE_HEADLINE = 'More room, and the packing memos.';
export const UPGRADE_DELTA_KICKER = 'WHAT CHANGES';

/** While the vendor sheet is being summoned. Not "Purchasing" — nothing began. */
export const UPGRADE_OPENING = 'Loading terms…';

/** The title over the shipped proration sentence, which is unchanged. */
export const UPGRADE_PRORATION_TITLE = 'What you have already paid';

/**
 * A paywall the reader closed. A normal decline, and the page they came back
 * to is still true — so this confirms rather than asks again. There is no
 * second attempt anywhere on this screen.
 */
export const UPGRADE_DECLINED: CapacityAdvice = {
  title: 'Still on Standard',
  body: 'Nothing was started and nothing was charged.',
};

/** A deep link from Pro or free. Refused with a way back, never with a placement. */
export const UPGRADE_REFUSED_TITLE = 'Nothing to move to.';
export function upgradeRefusedBody(): string {
  return `This account is already on ${PLANS.pro.name}, so there is no upgrade to open.`;
}
export const BACK_TO_MEMBERSHIP = 'Back to membership';

/**
 * One composed node per delta: "Active pieces. Now 150. On Pro, 1,000."
 *
 * The arrow is read as the words it means. A row split into three stops makes
 * a screen-reader user assemble the comparison themselves out of fragments
 * that arrive in the order the layout happened to place them.
 */
export function deltaSpoken(
  delta: { label: string; from: string; to: string },
  /**
   * The tier the right-hand column is. Defaults to Pro, which is the only
   * answer MB-09 has ever had; the free comparison draws one plate per paid
   * tier and has to name whichever it is, or a screen-reader user hears the
   * Standard table announce Pro's name against Standard's figures.
   */
  toName: string = PLANS.pro.name,
): string {
  return `${delta.label}. Now ${delta.from}. On ${toName}, ${delta.to}.`;
}

/**
 * There is deliberately NO second `canUpgrade` here.
 *
 * Who has somewhere to move is a billing decision, it already has one
 * implementation in `upgrade-delta.ts`, and a copy of it in a presentation
 * module is the drift bug that ships as a row offered to somebody who cannot
 * take it. Both pages import `canUpgrade` from where it lives.
 */
