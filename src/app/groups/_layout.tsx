import { Stack } from 'expo-router';

/**
 * The private-groups stack: the list, creating one, and — under `[circleId]/` —
 * a group's overview, its invite picker and its manage surface.
 *
 * ── WHY THE SEGMENT SAYS `groups` AND EVERY IMPORT SAYS `circles` ───────────
 *
 * The vocabulary contract is "identifiers say circle, strings say group", and a
 * route segment is not an identifier: it is customer-facing, because it appears
 * in deep links and in anything that shares one. `/groups/…` is what a person
 * can be shown. The modules underneath keep the internal name — `circles`, the
 * programme label the schema follows, and the one that dodges `group` being a
 * reserved word in Postgres — so this directory is the exact line where the two
 * halves of the contract meet.
 *
 * Headers are the screens' own, matching `friends/_layout.tsx`. No presentation
 * override anywhere in here: the invite picker is a pushed screen rather than
 * the half sheet `event/[id]/invite` uses, because this one can be the second
 * step of creating a group and a sheet that appears mid-flow reads as an
 * interruption of the flow rather than a part of it.
 */
export default function GroupsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
