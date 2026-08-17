/**
 * What a private group is allowed to tell the analytics store.
 *
 * ── THE RULE, WHICH IS STRICTER HERE THAN ANYWHERE ELSE ───────────────────
 *
 * **No identity, and no group payload.** No user id, no circle id, no group
 * name, no member name — and, unlike every other unit in this taxonomy, **no
 * counts either**. Daily Social carries `item_count` and `items_seen` quite
 * safely because they describe a feed. A group is a small, named, closed set
 * of specific people, and a size is one of the most identifying things about
 * one: "a group of 7" plus a timestamp plus a device is enough to pick a
 * particular room out of a data set, and once the number is a year deep in
 * history nobody can take it back. So the builders below emit bounded enums
 * and nothing else, and where the useful measure is a count, it is taken by
 * counting EVENTS rather than by sending a number — one
 * `circle_invite_sent` per invitation actually written is the same funnel with
 * nothing in it to join on.
 *
 * `tests/private-circles-client.test.ts` executes every builder here and fails
 * if any key or value could carry an identifier.
 *
 * ── WHY THIS FILE HAS NO `track` IMPORT ───────────────────────────────────
 *
 * `@/lib/posthog` pulls in expo-updates and the PostHog React Native SDK, and
 * a module that imports it cannot be executed by the node suite. The property
 * shapes are the part worth testing — they are where an id would leak in — so
 * they are built by pure functions here and handed to `track()` in
 * `mutations.ts`. Same split, same reason, as
 * `features/daily-social/analytics.ts`.
 */

import type { InviteIneligibility } from './types';

/**
 * The eight event names. Each is also a member of `AppEvent` in
 * `lib/posthog.tsx`, which is the closed union that makes a typo a compile
 * error rather than a second event that looks real and splits the funnel.
 *
 * There is deliberately no `circle_opened` and no `circle_roster_viewed`. An
 * event per group opened would, with a device id beside it, rebuild a record
 * of which small rooms a person visits and how often — inside a third-party
 * store, which is worse than doing it in the database. The eight below answer
 * whether groups get made, whether invitations get sent, whether they get
 * answered, why they get refused, and whether groups survive; none of them
 * needs to know which group.
 */
export const CIRCLE_EVENTS = {
  created: 'circle_created',
  inviteSent: 'circle_invite_sent',
  inviteBlocked: 'circle_invite_blocked',
  invitationAnswered: 'circle_invitation_answered',
  memberReInvited: 'circle_member_reinvited',
  membershipEnded: 'circle_membership_ended',
  renamed: 'circle_renamed',
  deleted: 'circle_deleted',
} as const;

/** Accepted or declined — the whole of what PC-04's two buttons produce. */
export type CircleInvitationAnswer = 'accepted' | 'declined';

/**
 * How somebody stopped being in a group. One event with a two-valued enum
 * rather than two events, because the pair is only ever read against each
 * other: a group people leave and a group people are removed from are
 * different products, and a chart that has to union two names to see it is a
 * chart nobody builds.
 */
export type CircleExit = 'left' | 'removed';

/**
 * Why the picker refused a row. The `null` case is not an event.
 *
 * TWO VALUES, AND NOT THE FOUR `InviteIneligibility` HAS. The picker also draws
 * "Already a member" and "Invite pending", and neither is a refusal worth
 * recording: both mean the reader tapped somebody they had already asked, which
 * says nothing about whether twelve is the right number or whether the mutual
 * rule is the wall — the only two questions this event exists to answer. Pinned
 * as a literal union rather than derived from `InviteIneligibility`, so a fifth
 * ineligibility cannot widen an analytics payload by inheritance.
 */
export type CircleInviteBlockedReason = Extract<
  InviteIneligibility,
  'group_full' | 'not_mutual'
>;

/**
 * A group was made. No properties at all — not its name, not its size, and
 * not "the creator's Nth group", which is a per-person counter wearing a
 * count's clothes.
 */
export function circleCreatedProps(): Record<string, never> {
  return {};
}

/**
 * One invitation was written. No properties: the batch size is recoverable by
 * counting events in a session, and sending it as a number would be sending
 * the shape of somebody's group.
 */
export function circleInviteSentProps(): Record<string, never> {
  return {};
}

/**
 * An invitation could not be sent, and which of the two reasons PC-10 draws.
 *
 * This is the one event here with real diagnostic value — it says whether
 * twelve is the wrong number or whether the mutual-friend requirement is the
 * wall people meet — and it says it with a two-valued enum. `not_mutual`
 * covers blocked and no-longer-mutual together, exactly as `errors.ts` does,
 * so not even the analytics store can tell that a block exists.
 */
export function circleInviteBlockedProps(reason: CircleInviteBlockedReason): {
  reason: CircleInviteBlockedReason;
} {
  return { reason };
}

/** Accepted or declined. Never which group, never who asked. */
export function circleInvitationAnsweredProps(answer: CircleInvitationAnswer): {
  answer: CircleInvitationAnswer;
} {
  return { answer };
}

/** Somebody was asked back. The reversibility path, measured as a bare count of events. */
export function circleMemberReInvitedProps(): Record<string, never> {
  return {};
}

/** Left, or removed. The distinction is the entire content of the event. */
export function circleMembershipEndedProps(how: CircleExit): { how: CircleExit } {
  return { how };
}

/** A group was renamed. No before, no after — both are user content. */
export function circleRenamedProps(): Record<string, never> {
  return {};
}

/**
 * A group was deleted. No size, no age, no member count: how big a room was
 * when it closed is the most identifying thing anybody could send about it.
 */
export function circleDeletedProps(): Record<string, never> {
  return {};
}
