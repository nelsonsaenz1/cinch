import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevealArrival } from '@/components/reveal/reveal-arrival';
import { RevealComputing, RevealCount } from '@/components/reveal/reveal-count';
import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { useMarkRevealSeen } from '@/features/onboarding/reveal-seen';
import {
  classifyZero,
  mayStampSeen,
  type SeenMoment,
  type ZeroReason,
} from '@/features/onboarding/reveal-zero-core';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { Placement } from '@/features/billing/placements';
import { presentPromo } from '@/features/billing/present-promo';
import { useGate } from '@/features/billing/use-gate';
import { usePlan } from '@/features/billing/use-plan';
import { DECLINED_KEY, writeFlag } from '@/features/ingest/consent-mode';
import { sweepAfterConsent } from '@/features/ingest/upload-queue';
import { countOutfits, tallyOf, type CountedKind } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
import {
  REVEAL_EVENTS,
  countBucketProps,
  revealExitProps,
  revealPhaseProps,
  revealSetViewedProps,
  type RevealExit,
  type RevealPhaseName,
} from '@/features/onboarding/reveal-analytics';
import {
  compositionChips,
  smallestFix,
  substitutionDerivation,
} from '@/features/onboarding/reveal-copy';
import {
  MAX_PLATES,
  OFFLINE_MARK,
  REVEAL_COPY,
  arrivalBody,
  arrivalTitle,
  derivationLine,
  derivationShort,
  membershipCountLine,
  displayFontSize,
  mayDrawDigit,
  missingPhrases,
  partialDerivation,
  piecesToFirstOutfit,
  untaggedChip,
  unreadBodyLine,
  zeroBodyLine,
} from '@/features/onboarding/reveal-spec';
import { useRevealSequence } from '@/features/onboarding/use-reveal-sequence';
import { useUntaggedCount } from '@/features/onboarding/use-untagged-count';
import { useWardrobe } from '@/features/styling/queries';
import { useOutfits } from '@/features/styling/use-outfits';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';
import { motion } from '@/theme/tokens';

/**
 * The Reveal — seven beats, one number, and nothing invented. Redesign 12.
 *
 * Arrives from The Ten's stop sheet:
 *
 *   arriving → computing → counting → settled → plating → cascade → complete
 *
 * with `zero` as a terminal branch off `computing`. `use-reveal-sequence.ts`
 * owns the clock and nothing else; every number on this screen comes from
 * `countOutfits(tallyOf(items))` and every sentence from `reveal-spec.ts`.
 *
 * ── THE ONE RULE THIS SCREEN EXISTS TO KEEP ─────────────────────────────────
 *
 * NO DIGIT BEFORE THE ARITHMETIC RESOLVES. Not the count, not a dash, not a
 * shimmering block two figures wide. `mayDrawDigit(phase)` is the gate and it
 * is asserted by a test, because a digit-shaped placeholder is itself a claim:
 * it says a number is coming and it is about this big, and on the closet that
 * turns out to make none, that claim was false the whole time it was up.
 *
 * ── WHAT THIS SCREEN DOES NOT OWN ───────────────────────────────────────────
 *
 * The membership surface. Campaign 254200 is non-gated and Superwall-owned: no
 * price, product, trial term, StoreKit string or vendor layout is drawn here.
 * What IS drawn is one Cinch-owned context line above it, and even that is
 * state-correct — a paying member sees no line and no placement at all,
 * because a member being sold to is the bug.
 */
export default function RevealScreen() {
  const router = useRouter();
  const gate = useGate();
  const plan = usePlan();
  const wardrobe = useWardrobe();
  const untagged = useUntaggedCount();
  // For the UNREAD zero only — pieces at `pending_tag` with tagging never
  // allowed to run. Everything else on this screen is consent-blind.
  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  const params = useLocalSearchParams<{ redirectedDressTo?: string }>();
  const redirectedDressTo =
    params.redirectedDressTo === 'tops' || params.redirectedDressTo === 'bottoms'
      ? (params.redirectedDressTo as CountedKind)
      : null;

  // One refetch on arrival — the last piece or two may have still been tagging
  // when The Ten's stop sheet fired. It runs UNDER the arrival floor rather
  // than instead of it, so the beat is a beat either way.
  useEffect(() => {
    void wardrobe.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  const tally = useMemo(() => tallyOf(items), [items]);
  const count = countOutfits(tally);

  // The arithmetic has landed. Until this is true the sequence stays on words:
  // a settled query is the ONLY thing that turns a digit on. A FAILED query is
  // never "landed" — an errored read hands back an empty list, an empty list
  // counts to zero, and the zero screen would then explain a closet nobody
  // actually read (incident 2026-08-31's latent class-4 masquerade). The
  // failure gets its own frame below instead, with the retry that can turn it
  // back into arithmetic.
  const readFailed = wardrobe.isError;
  const countReady = !wardrobe.isLoading && !wardrobe.isFetching && !readFailed;

  const { resolve } = useSignedUrls(items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]));

  const { context, cityLabel, weatherFailed } = useStyleContext({});
  const outfits = useOutfits({
    wardrobe: items,
    context,
    profile: { weights: DEFAULT_WEIGHTS, affinities: EMPTY_AFFINITIES, feedbackCount: 0, summary: [] },
    count: MAX_PLATES,
    enabled: countReady && count > 0,
  });
  const plates = outfits.outfits.slice(0, MAX_PLATES);

  // Offline, sourced the way Today sources it: the weather fetch failing after
  // its retry is the truest network signal this app has. It changes NOTHING
  // about the arithmetic — the tally, the count and the outfits are all local —
  // and it changes exactly one thing about behaviour, below.
  const offline = weatherFailed;

  const sequence = useRevealSequence({
    countReady,
    count,
    zero: countReady && count === 0,
    platesAvailable: plates.length,
    reduced,
  });

  /**
   * Which zero this is, from the settled facts — null anywhere but a zero.
   * `queryFailed` is structurally false here because a failed read never
   * reaches `countReady`; the field exists so the core's vocabulary is whole.
   */
  const consented = consent.data?.granted === true;
  const zeroReason: ZeroReason | null =
    countReady && count === 0
      ? classifyZero({ queryFailed: false, untagged: untagged.count, consented })
      : null;

  // ── Seen, only when something was DELIVERED ──────────────────────────────
  //
  // The stamp closes Today's reveal door for good, so it must mean "the
  // moment happened", not "the route mounted". It lands at exactly two kinds
  // of moment — the completed sequence, and a deliberate exit from the HONEST
  // zero — and never on the unread, consent-blocked, failed or interrupted
  // states, so the path back survives every screen that delivered nothing
  // (incident 2026-08-31; the decision table is reveal-zero-core.ts). A
  // person who backgrounds mid-count is offered the moment again, which is
  // now the intent rather than the accident. Fire-and-forget as before.
  const markSeen = useMarkRevealSeen();
  const stamped = useRef(false);
  const stampSeen = (moment: SeenMoment) => {
    if (stamped.current || !mayStampSeen(moment, zeroReason)) return;
    stamped.current = true;
    markSeen.mutate();
  };
  const stampSeenRef = useRef(stampSeen);
  useEffect(() => {
    stampSeenRef.current = stampSeen;
  });
  useEffect(() => {
    if (sequence.complete) stampSeenRef.current('complete');
  }, [sequence.complete]);

  // ── The beats, reported as beats ─────────────────────────────────────────
  //
  // One event per phase actually reached, and nothing else in the payload. Not
  // a duration — how long somebody's phone took to multiply four numbers is not
  // a fact about them worth keeping — and never what was drawn.
  const seenPhases = useRef(new Set<string>());
  useEffect(() => {
    const name = sequence.phase === 'plating' ? 'settled' : (sequence.phase as RevealPhaseName);
    if (seenPhases.current.has(name)) return;
    seenPhases.current.add(name);
    // The zero carries WHICH zero (a bounded word from reveal-zero-core), so
    // the next incident is one query instead of a three-system join.
    track(
      REVEAL_EVENTS.phase,
      revealPhaseProps(name, name === 'zero' ? (zeroReason ?? undefined) : undefined),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence.phase]);

  // The count, as a BUCKET. The exact number is a deterministic function of one
  // wardrobe with a long tail — 184 is close to unique — so it never travels.
  const bucketSent = useRef(false);
  useEffect(() => {
    if (!countReady || bucketSent.current) return;
    bucketSent.current = true;
    track(REVEAL_EVENTS.countBucket, countBucketProps(count));
  }, [countReady, count]);

  // The first plate anyone ever sees. Fires once, and only after a real plate
  // has actually mounted — a reveal that ended at the honest zero is a screen
  // where no outfit was seen, and must not report one.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current || sequence.platesShown === 0) return;
    viewed.current = true;
    track('outfit_set_viewed', revealSetViewedProps(sequence.platesShown, offline));
  }, [sequence.platesShown, offline]);

  // ONE haptic when the count settles, and one on the exit — the exit's comes
  // from `Button`'s own `haptic` prop, so this is the only explicit call on the
  // screen. Nothing fires on the count-up or the cascade: those are the phone
  // showing off, not the reader doing anything, and a buzz per plate would
  // teach somebody that three things happened when one did.
  //
  // Through `lib/haptics` rather than expo-haptics directly, on UX-07's policy:
  // which INTENTS exist is that module's business, and `tests/haptic-policy`
  // fails any new file that reaches past it.
  const settledBuzz = useRef(false);
  useEffect(() => {
    if (settledBuzz.current || !mayDrawDigit(sequence.phase) || sequence.phase === 'counting') return;
    settledBuzz.current = true;
    haptics.selection();
  }, [sequence.phase]);

  // Focus lands on the exit when the reveal completes — the accepted VoiceOver
  // order ends there, and a finished sequence that leaves focus on a number is
  // a reader with nowhere to go.
  const exitRef = useRef<View>(null);
  useEffect(() => {
    if (!sequence.complete) return;
    const node = findNodeHandle(exitRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [sequence.complete]);

  const exit = useCallback((which: RevealExit) => {
    track(REVEAL_EVENTS.exit, revealExitProps(which));
  }, []);

  /**
   * Whether this reader is already paying, and therefore must not be sold to.
   *
   * `plan` resolves to `pro` DURING THE TRIAL, so paying is a non-free plan
   * that is not a running trial — reading `plan.plan !== 'free'` alone would
   * skip the membership moment for exactly the people it is for.
   *
   * `unconfirmed` counts as paying, on K-06's rule: a member whose entitlement
   * could not be verified is treated as a member. The exposure is bounded
   * because the server checks independently, and the failure it prevents —
   * showing a paying member a sales sheet because their subscription row would
   * not load — is the worse one.
   */
  const paying = (plan.plan !== 'free' && !plan.trialing) || plan.unconfirmed;

  /**
   * The membership moment — Cinch's own words, above a sheet Cinch does not own.
   *
   * The vendor surface is a WKWebView presented over everything, and it arrives
   * a beat after the tap. Without this, that beat shows the reveal with a
   * loading sheet sliding over it, which reads as the app being interrupted by
   * something rather than as the app saying something.
   *
   * What is drawn here is one line about the count and one sentence about
   * access. What is NOT drawn, and cannot be: a price, a product name, a trial
   * term, a StoreKit string, a duration, or anything resembling the vendor's
   * own layout. Campaign 254200 owns all of that, and drawing a shadow of it
   * here would be two sources of truth for what membership costs.
   *
   * The sentence is chosen from `usePlan()` rather than from a flag: somebody
   * inside the 14-day server-side trial is told the trial keeps everything
   * open, and somebody on free is told what they just saw stays theirs. Neither
   * promises a NEW trial, because there is no such thing to promise — the trial
   * is server-side access and there are zero Apple introductory offers.
   */
  const [presenting, setPresenting] = useState(false);

  /**
   * The end of onboarding. This hands the reader to the app.
   *
   * Founder decision D2 (docs/design/positioning-contract.md §5): a DISMISSIBLE
   * paywall presents here, on the way out — the highest-intent second in the
   * product, because somebody has just photographed ten things and been told,
   * in a number computed from their own closet, what they own.
   *
   * WHY THE PRESS AND NOT AN EFFECT. An effect throws the sheet over a page
   * still being read, and "after the Reveal" has to mean after they say they
   * are done with it. Not on the Today side either — a paywall that appears
   * once the app has already changed underneath them reads as an ambush.
   *
   * `router.replace` runs on EVERY outcome, which is why nothing branches on
   * the result. Three reasons and all three hold:
   *
   *  1. Nothing on this screen is withheld, so a purchase has nothing to
   *     unlock. Membership is read by `usePlan()` where it actually matters.
   *  2. The free tier the reader was just shown is intact after a dismissal,
   *     and it MUST be. Ten-pieces-free is the wedge; a Reveal that ends at a
   *     wall the free tier cannot pass makes the whole positioning a lie.
   *  3. Paywall 254200 is `non_gated`, so Superwall runs `feature()` on
   *     dismissal too and `present()` resolves 'granted' for somebody who
   *     bought nothing. A GRANTED RESULT NEVER IMPLIES PURCHASE. Settlement is
   *     proven by the SDK flow, which alone routes to /membership-thanks, on
   *     top of a Today this call has already replaced underneath it.
   *
   * ── THREE STATES THAT SKIP THE SHEET ENTIRELY ───────────────────────────
   *
   * A PAYING MEMBER. No sales line, no gate, no placement. Somebody who is
   * already paying being shown a membership offer is not a missed upsell, it
   * is the app failing to know who it is talking to.
   *
   * OFFLINE. A campaign that cannot be reached is a spinner with a dismiss
   * button. The destination is identical, so nothing is lost by not trying.
   *
   * THE ZERO PATH, which never calls this function at all — see below.
   */
  // A plain function rather than `useCallback`.
  //
  // The React Compiler memoizes this itself, and a hand-written dependency
  // array here was rejected outright ("existing memoization could not be
  // preserved") because the array and the compiler's own analysis disagreed —
  // `paying` is derived in render and the compiler inlines it, so the two
  // never reconcile. A wrong dependency array that the compiler has stopped
  // trusting is worse than no array: it looks like a guarantee and is not one.
  const goToToday = async () => {
    // ONE PATH, deliberately — no early return. Every outcome, and the two
    // cases that never ask for one, converge on the same two lines: report the
    // exit, replace to Today. Writing it as a branch with its own `replace`
    // would be two chances to get the destination wrong, and the whole
    // contract here is that there is only one destination.
    const skipSheet = paying || offline;
    if (!skipSheet) setPresenting(true);
    const outcome = skipSheet
      ? null
      : // Through `presentPromo`, never the bare gate: `reveal_complete` is a
        // GENERAL promo (promo-caps.ts), so the qualification (free-only, not
        // trialing), the frequency caps — including the no-consecutive rule
        // that forbids it within a day of a shown `ten_completed`, so the two
        // asks can never bracket one Reveal — and the paywall_eligible /
        // paywall_dismissed events all live in that one function. It resolves
        // on every path ('ineligible' instantly), so this await cannot block
        // the exit. `outfitCount` is the only field the context line needs;
        // plan and trial state are passed for qualification and re-read by
        // use-gate.ts for the line itself.
        await presentPromo(gate, Placement.RevealComplete, {
          plan: plan.plan,
          trialing: plan.trialing,
          contextOpts: { outfitCount: count },
        });

    // Reported, never acted on. `granted` on a non-gated campaign is what a
    // DISMISSAL looks like, which is exactly why the navigation below does not
    // read it. 'ineligible' — the ask withheld before Superwall was involved —
    // reports as 'unavailable': no sheet reached the reader either way, and
    // paywall_eligible already carries the precise reason.
    exit(
      skipSheet
        ? paying
          ? 'open_today'
          : 'unavailable'
        : outcome === 'unavailable' || outcome === 'ineligible'
          ? 'unavailable'
          : 'dismissed',
    );
    router.replace('/(tabs)');
  };

  // ── THE MEMBERSHIP MOMENT · behind the vendor sheet ─────────────────────
  //
  // Reached only from the exit, only when the sheet is actually being asked
  // for, and never on the zero path. A paying member never sees it, because
  // `goToToday` skips straight past — a member being sold to is the bug, not a
  // missed upsell.
  if (presenting) {
    return (
      <RevealStage>
        <View className="flex-1 justify-center">
          <Text variant="display" trim>
            {membershipCountLine(count)}
          </Text>
          <Text
            variant="note"
            style={{ marginTop: 14, fontSize: ax ? 21 : 15, lineHeight: ax ? 29 : 23 }}>
            {plan.trialing ? REVEAL_COPY.memberContextTrialing : REVEAL_COPY.memberContextFree}
          </Text>
        </View>
      </RevealStage>
    );
  }

  // ── READ FAILED · recoverable, and never a zero ──────────────────────────
  //
  // The wardrobe query errored, so there is no arithmetic to reveal — only a
  // network fact. Said as exactly that, with the retry that can turn it back
  // into a closet. This frame can only exist while the sequence is still on
  // words (`countReady` refuses errored reads, so the machine cannot pass
  // `computing` without a settled result); a count already on screen is never
  // yanked by a later refetch failing. NO PLACEMENT on this path, no digit,
  // no "cannot pair" copy over a closet nobody read, and no seen-stamp — the
  // door back on Today survives a screen that delivered nothing.
  if (readFailed && (sequence.phase === 'arriving' || sequence.phase === 'computing')) {
    return (
      <RevealStage>
        <View className="flex-1 justify-center">
          <Text variant="wordmark" trim accessibilityRole="header" style={{ fontSize: 46 }}>
            Couldn’t read your closet.
          </Text>
          <Text variant="note" style={{ marginTop: 14, fontSize: 17, lineHeight: 26 }}>
            Nothing was counted — the pieces wouldn’t load just now. They’re all still yours;
            this page just can’t see them yet.
          </Text>
        </View>
        <View style={{ paddingBottom: 20 }}>
          <Button
            title="Try again"
            variant="ink"
            className="self-stretch"
            onPress={() => void wardrobe.refetch()}
          />
          <Button
            title={REVEAL_COPY.zeroOpenToday}
            variant="ghost"
            className="self-stretch"
            onPress={() => {
              exit('read_failed');
              router.replace('/(tabs)');
            }}
          />
        </View>
      </RevealStage>
    );
  }

  // ── ARRIVING · beat one ─────────────────────────────────────────────────
  if (sequence.phase === 'arriving') {
    return (
      <RevealStage>
        <RevealArrival
          otherUris={items.slice(0, -1).slice(0, 6).map((g) => resolve(g.platePath, g.cutoutPath, g.thumbPath))}
          // The same six pieces, so a tile whose render has not landed can draw
          // the garment's own colour and kind instead of empty sand (audit 62).
          otherGarments={items.slice(0, -1).slice(0, 6)}
          lastGarment={items[items.length - 1]}
          lastUri={
            items.length
              ? resolve(
                  items[items.length - 1]!.platePath,
                  items[items.length - 1]!.cutoutPath,
                  items[items.length - 1]!.thumbPath,
                )
              : undefined
          }
          pieceCount={items.length}
          title={arrivalTitle(items.length)}
          body={arrivalBody(items.length)}
          tail={REVEAL_COPY.arrivalBody}
        />
      </RevealStage>
    );
  }

  // ── COMPUTING · beat two, in words ──────────────────────────────────────
  //
  // No digit and no digit-shaped placeholder. The engine is described instead,
  // and the description happens to be the most reassuring true thing about it:
  // this is happening on the phone and nothing is leaving.
  if (sequence.phase === 'computing') {
    return (
      <RevealStage>
        <RevealComputing
          title={REVEAL_COPY.computingTitle}
          body={REVEAL_COPY.computingBody}
          large={ax}
        />
      </RevealStage>
    );
  }

  // ── ZERO · a result, not an error ───────────────────────────────────────
  //
  // One frame, no scroll: the failure, what it is missing, and the two ways
  // forward all have to be readable at once, because a zero that has to be
  // scrolled past to reach its fix is a zero with no fix.
  //
  // NO PLACEMENT IS PRESENTED ON THIS PATH — not by `goToToday`, which is not
  // called here, and not anywhere else. Charging at the moment the arithmetic
  // came back nothing would be charging for the failure.
  if (sequence.phase === 'zero') {
    // ── THE UNREAD ZERO ─────────────────────────────────────────────────────
    //
    // Pieces exist at `pending_tag`, so the arithmetic had nothing to count
    // YET — a different fact from a closet that cannot pair, and one the
    // repair copy must not misdiagnose: telling this reader to photograph
    // again is telling them to redo the thing they just did.
    //
    // Two causes, one fact apart. Tagging mid-flight resolves itself — the
    // sequence leaves `zero` on its own the moment the count turns real (see
    // use-reveal-sequence), so "Check again" is only a manual poke at the
    // wardrobe query. Tagging never ALLOWED to run is the case this branch
    // really exists for: the fix is the consent door, asked with the same
    // sheet and the same two live choices as everywhere else, and an accept
    // sweeps the stuck pieces immediately (`sweepAfterConsent`) rather than up
    // to half an hour later. The reader then watches this same screen turn
    // into the count-up as the tags land.
    //
    // A decline is recorded exactly as capture records it — but A-04's
    // explainer is NOT shown here, deliberately: its first sentence is "Done.
    // Nothing was sent.", and for pieces already sitting in Storage that
    // sentence would be false. The full account still arrives at the moment
    // it is true, on the next capture surface.
    if (untagged.count > 0) {
      return (
        <RevealStage>
          <RevealEmpty
            headline={REVEAL_COPY.zeroUnreadTitle}
            body={unreadBodyLine(untagged.count, consented)}
            // Nothing is "needed" — the pieces are here, unread. Listing kinds
            // to photograph would be the exact misdiagnosis above.
            needs={[]}
            fix={consented ? REVEAL_COPY.zeroUnreadCheck : REVEAL_COPY.zeroUnreadConsent}
            onFix={() => {
              if (consented) {
                void wardrobe.refetch();
              } else {
                setConsentVisible(true);
              }
            }}
            onOpenToday={() => {
              exit('zero_open_today');
              router.replace('/(tabs)');
            }}
          />
          <ConsentSheet
            visible={consentVisible}
            busy={grantConsent.isPending}
            onAccept={() =>
              void grantConsent.mutateAsync().then(() => {
                setConsentVisible(false);
                writeFlag(DECLINED_KEY, false);
                sweepAfterConsent();
              })
            }
            onDecline={() => {
              setConsentVisible(false);
              writeFlag(DECLINED_KEY, true);
            }}
          />
        </RevealStage>
      );
    }

    return (
      <RevealStage>
        <RevealEmpty
          headline={REVEAL_COPY.zeroTitle}
          body={zeroBodyLine(items.length, tally, piecesToFirstOutfit(tally))}
          needs={missingPhrases(tally)}
          fix={smallestFix(tally) ? REVEAL_COPY.zeroRepair : null}
          // The repair loop. `?door=photograph` so The Ten opens on the grid
          // rather than asking a reader mid-repair which door they want.
          // Both exits stamp `reveal_seen_at` — this is the HONEST zero, the
          // reader saw the true arithmetic and answered it (see
          // reveal-zero-core.ts for why only this zero may stamp).
          onFix={() => {
            stampSeen('zero_repair');
            exit('zero_repair');
            router.replace('/the-ten?door=photograph');
          }}
          onOpenToday={() => {
            stampSeen('zero_open_today');
            exit('zero_open_today');
            router.replace('/(tabs)');
          }}
        />
      </RevealStage>
    );
  }

  // ── COUNTING → COMPLETE ─────────────────────────────────────────────────
  const hasPlates = sequence.platesShown > 0;
  const readCount = items.length;
  const derivation =
    redirectedDressTo
      ? substitutionDerivation(tally, redirectedDressTo)
      : untagged.count > 0
        ? partialDerivation(readCount, untagged.count, tally)
        : hasPlates
          ? derivationShort(readCount, tally)
          : derivationLine(readCount, tally);

  const chips = [
    ...compositionChips(
      tally,
      items.some((g) => g.slot === 'outerwear'),
      items.some((g) => g.slot === 'bag'),
    ),
    ...(untaggedChip(untagged.count) ? [untaggedChip(untagged.count)!] : []),
  ];

  return (
    <RevealStage>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <RevealCount
          count={sequence.shownCount}
          fontSize={displayFontSize(count, hasPlates, ax)}
          derivation={derivation}
          chips={chips}
          // ONE announcement. The number, where it came from and what it was
          // made of are a single sentence — a reader who hears "twenty-seven",
          // then the derivation, then four chips has heard the same fact four
          // times.
          spokenLabel={derivationLine(readCount, tally)}
          offlineMark={offline ? OFFLINE_MARK : null}
          large={ax}
          // The digit is gated on the PHASE. `counting` and everything after it
          // may draw one; nothing before may.
          showNumber={mayDrawDigit(sequence.phase)}
        />

        {/* The plate reserves its space before it has anything to put in it, so
            the page does not reflow under somebody already reading it. */}
        {sequence.phase === 'plating' && plates.length > 0 ? (
          <View style={{ marginTop: 24, height: 260 }} accessibilityElementsHidden />
        ) : null}

        {plates.slice(0, sequence.platesShown).map((outfit, i) => (
          <Animated.View
            key={outfit.candidate.items.map((g) => g.id).join('|')}
            // Reduce Motion collapses the cascade to a cross-fade. The final
            // composition is IDENTICAL either way — same number, same plates,
            // same exit — which is why this is a shortcut through the beats
            // rather than a different screen.
            entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
            style={{ marginTop: i === 0 ? 24 : 12 }}>
            {i === 0 ? <Text variant="eyebrow">The first one</Text> : null}
            <View style={{ marginTop: i === 0 ? 10 : 0, marginHorizontal: -20 }}>
              <Plate
                outfit={outfit}
                index={i}
                occasion={context.events[0]?.title ?? null}
                colophon={{ city: cityLabel, feelsLikeC: context.weather?.feelsLikeC }}
                resolveImage={resolve}
                /* No love / not-for-me / worn here. There is no day to mark as
                   worn yet, and the reader has not entered the app — the pills
                   used to render live on this screen and swallow every tap. */
                preview
              />
            </View>
          </Animated.View>
        ))}
      </ScrollView>
      <SafeAreaView edges={['bottom']}>
        <View ref={exitRef} accessible={false}>
          <Button
            title={REVEAL_COPY.openToday}
            onPress={() => void goToToday()}
            /* `Button` fires the exit's own selection tick through the same
               policy module — the screen's second and last haptic. */
            haptic
            className="self-stretch"
          />
        </View>
      </SafeAreaView>
    </RevealStage>
  );
}
