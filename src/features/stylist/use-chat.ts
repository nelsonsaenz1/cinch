import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  STYLIST_EVENTS,
  chatErrorProps,
  chatReplyOkProps,
} from './stylist-analytics';
import {
  CAPACITY_HELD_COPY,
  SEND_CEILING_MS,
  SEND_TIMED_OUT,
  SEND_TIMED_OUT_COPY,
  STANDARD_PROMISE,
  WORKLOAD_DISABLED_503,
  WORKLOAD_DISABLED_COPY,
  keepsRestoredRow,
  sendableHistory,
} from './stylist-spec';
import { track } from '@/lib/posthog';
import { Placement } from '@/features/billing/placements';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { generateOutfits, type Garment, type OutfitCandidate, type StyleContext } from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

import { lifestyleSummaryLine } from '@/features/profile/lifestyle';
import { useLifestyle } from '@/features/profile/use-lifestyle';

import {
  fetchAllBoards,
  fetchPins,
  PinterestRequestError,
} from '@/features/recreate/pinterest';

import type { StyleProfile } from '../styling/queries';
import { tryFactAnswer } from './facts';
import {
  chooseBoard,
  inspirationFailureText,
  inspirationReplyText,
  parseInspirationAsk,
  pinRelevant,
  rankPins,
  type PinReference,
} from './inspiration';
import { closetDigest, contextForQuestion } from './intent';
import type { BriefIntent, StylistBrief } from './questionnaire';

const SHORTLIST = 10;

/** Everything a tapped-through questionnaire knows that the sentence does not. */
export type AskOptions = { brief?: StylistBrief; intent?: BriefIntent };

/**
 * The allowance, or null.
 *
 * ── STRICT, BECAUSE THIS DRAWS A PROMISE ────────────────────────────────────
 *
 * Total by construction: anything missing, malformed, fractional, negative, or
 * inconsistent with the Standard contract reads as "the server did not say",
 * which is the same honest silence as never having asked.
 *
 * The contract is checked in full rather than field by field. Three numbers
 * that are individually plausible can still be nonsense together — `4 used, 4
 * remaining` out of five is a payload no correct server produces, and drawing
 * "4 chats left" from it would be worse than drawing nothing. So the sum is
 * asserted too, and a body that fails any part of it is discarded whole.
 */
export type StylistAllowance = {
  promiseLimit: number;
  successfulUsed: number;
  remaining: number;
};

function readAllowance(raw: unknown): StylistAllowance | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  // Integers, not "number-ish". `Number('4')` and `Number(true)` both coerce,
  // and a string that arrived where an integer belongs means the shape is
  // already wrong somewhere upstream. Narrowed one at a time so the checks
  // below are reading numbers rather than `unknown`.
  const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
  const limit = a.promiseLimit;
  const used = a.successfulUsed;
  const remaining = a.remaining;
  if (!isInt(limit) || !isInt(used) || !isInt(remaining)) return null;

  // The Standard contract, exactly. Five is the promise; the eight-attempt
  // ceiling is internal slack and must never arrive here as a limit.
  if (limit !== STANDARD_PROMISE) return null;
  if (used < 0 || used > STANDARD_PROMISE) return null;
  if (remaining < 0 || remaining > STANDARD_PROMISE) return null;
  if (used + remaining !== STANDARD_PROMISE) return null;

  return { promiseLimit: limit, successfulUsed: used, remaining };
}

/**
 * Whether a failure was the server declining to guess at the allowance.
 *
 * A 503 carrying `allowance_unavailable`. Anything else — including a 503 from
 * somewhere else in the stack — is left to the transport sentence, because
 * claiming to know why a request failed when you do not is how an outage comes
 * to read as a billing problem.
 */
async function isAllowanceUnavailable(error: unknown): Promise<boolean> {
  if ((await read503(error)) === 'allowance_unavailable') return true;
  // `enforceAiQuota`'s own unreachable counter answers the same fact under a
  // different code, and it deserves the same honest sentence rather than the
  // generic outage copy.
  return (await read503(error)) === 'quota_unavailable';
}

/**
 * Whether the 503 was the stylist workload being switched off in `ai_config`.
 *
 * A deliberate off switch, not an outage — falling through to "could not be
 * reached" here told the user their network was at fault for a decision made
 * in a dashboard.
 */
async function isWorkloadDisabled(error: unknown): Promise<boolean> {
  return (await read503(error)) === WORKLOAD_DISABLED_503;
}

/**
 * Whether every slot is momentarily held by a chat that has not settled.
 *
 * A separate sentence from exhaustion because it is a separate fact: fewer
 * than five successes are on record and this clears on its own. It also must
 * not open a paywall, which is why the server answers 503 rather than 429 —
 * the shared denial classifier routes every 429 to an upgrade placement, and
 * selling somebody an upgrade for a fifteen-second wait would be absurd.
 */
async function isCapacityHeld(error: unknown): Promise<boolean> {
  return (await read503(error)) === 'stylist_capacity_held';
}

/** The bounded error code a 503 carried, or null. */
async function read503(error: unknown): Promise<string | null> {
  const response = (error as { context?: unknown })?.context;
  if (!(response instanceof Response) || response.status !== 503) return null;
  try {
    const body = (await response.clone().json()) as { error?: string };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/** The allowance a 429 carried, so the refusal can update the mark. */
async function readAllowanceFromError(error: unknown): Promise<StylistAllowance | null> {
  const response = (error as { context?: unknown })?.context;
  if (!(response instanceof Response)) return null;
  try {
    const body = (await response.clone().json()) as { allowance?: unknown };
    return readAllowance(body.allowance);
  } catch {
    return null;
  }
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Outfits the stylist pointed at, resolved back to real candidates. */
  outfits: OutfitCandidate[];
  followUp: string | null;
  /**
   * The attributed Pin behind an inspiration turn. EPHEMERAL BY DESIGN:
   * never written into `StoredContent`, because a Pin's name, link, and
   * image are Pinterest API content and the no-storage rule keeps those out
   * of every table. A reloaded thread keeps the sentence and the outfit —
   * both genuinely ours — and lets the reference card go.
   */
  pin?: PinReference | null;
  pending?: boolean;
  failed?: boolean;
  /**
   * A failed turn worth offering again. True only for the transport failures —
   * a refusal (consent, plan, quota) would refuse identically on retry, and
   * those paths already carry their own way forward.
   */
  retryable?: boolean;
};

const candidateId = (c: OutfitCandidate) => c.items.map((g) => g.id).join('.');

/** Stored message payload. Item ids are kept so outfits survive a reload. */
type StoredContent = { text: string; outfitItemIds?: string[][]; followUp?: string | null };

export function useChat({
  wardrobe,
  context,
  profile,
}: {
  wardrobe: Garment[];
  context: StyleContext;
  profile: StyleProfile;
}) {
  const qc = useQueryClient();
  const lifestyle = useLifestyle();
  const gate = useGate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lifestyleLine = lifestyleSummaryLine(
    lifestyle.lifeStage,
    lifestyle.occasions,
    lifestyle.goals,
    lifestyle.adventure,
  );
  const sessionRef = useRef<string | null>(null);
  /** Latest `ask`, so the paywall's retry callback can reach it without a cycle. */
  const askRef = useRef<(question: string, options?: AskOptions) => Promise<void>>(async () => {});
  /**
   * Whether the persisted thread has already been handed to `messages`.
   *
   * A ref rather than a derived check, because "the thread is empty" is true
   * both before restoration and after `clear()`, and those two want opposite
   * behaviour from the seeding effect below.
   */
  const seeded = useRef(false);

  /**
   * Rehydrate the most recent conversation.
   *
   * Outfits are rebuilt by looking their item ids back up in the wardrobe, so a
   * reloaded thread still shows real garments — and a piece deleted since the
   * conversation happened simply drops out rather than rendering as a ghost.
   *
   * The `queryFn` only reads. It used to call `setMessages(restored)` on its way
   * out, which made it impure and, worse, destructive: any refetch — a remount,
   * a stale-time expiry, a wardrobe change flipping `enabled` — overwrote the
   * live thread with the persisted one, so a question in flight and a failed
   * turn both vanished mid-conversation. Restoration is an effect now.
   */
  const history = useQuery({
    queryKey: ['chat-history'],
    enabled: wardrobe.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data: session } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) return [];
      sessionRef.current = session.id;

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const byId = new Map(wardrobe.map((g) => [g.id, g]));

      const restored = (data ?? []).map((row) => {
        const content = row.content as unknown as StoredContent;
        const outfits = (content.outfitItemIds ?? [])
          .map((ids) => ids.map((id) => byId.get(id)).filter((g): g is Garment => Boolean(g)))
          .filter((items) => items.length > 1)
          .map((items) => ({
            items,
            features: {} as OutfitCandidate['features'],
            score: 0,
            notes: {},
            harmonies: [],
          }));

        return {
          id: row.id,
          role: row.role as 'user' | 'assistant',
          text: content.text ?? '',
          outfits,
          followUp: content.followUp ?? null,
        };
      });

      // A row with no text and no surviving outfits is dropped, not drawn:
      // an empty bubble is a ghost, and its empty string would ride back up
      // in `history` where the server's `requiredString` 400s the whole send
      // — one bad row used to poison every request for the session.
      return restored.filter((m) => keepsRestoredRow(m.text, m.outfits.length));
    },
  });

  /**
   * Seed the thread from history exactly once, and only while it is empty.
   *
   * Both guards matter. `seeded` stops a later refetch from resurrecting a
   * conversation the user walked away from via `clear()`; the `prev.length`
   * check inside the updater stops a slow first fetch from landing on top of a
   * question the user has already asked while it was in flight.
   */
  useEffect(() => {
    const restored = history.data;
    if (seeded.current || !restored?.length) return;
    seeded.current = true;
    setMessages((prev) => (prev.length ? prev : restored));
  }, [history.data]);

  const persist = useCallback(
    async (role: 'user' | 'assistant', content: StoredContent) => {
      const userId = await getUserId();
      if (!userId) return;

      if (!sessionRef.current) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({ user_id: userId, title: content.text.slice(0, 60) })
          .select('id')
          .single();
        if (error) return;
        sessionRef.current = data.id;
      }

      await supabase.from('chat_messages').insert({
        session_id: sessionRef.current,
        user_id: userId,
        role,
        content: content as never,
      });
    },
    [],
  );

  const send = useMutation({
    mutationFn: async ({ question, options }: { question: string; options?: AskOptions }) => {
      /**
       * A question with one right answer is answered here, from the closet
       * already in memory.
       *
       * "How many white shirts do I have" used to travel to a model as a
       * DIGEST — prose that had already discarded the individual pieces — and
       * the number that came back was inferred rather than counted. It cost a
       * call, twenty seconds, and a slice of the stylist allowance people are
       * meant to spend on advice.
       *
       * `tryFactAnswer` returns null for anything open-ended, which is most of
       * what gets asked, and that path is unchanged. See `facts.ts` for why the
       * router is closed rather than best-effort.
       */
      const fact = tryFactAnswer(wardrobe, question, Date.now());
      if (fact) {
        return {
          reply: fact.text,
          // No outfits: a lookup is not a styling request, and generating three
          // beneath a count would suggest the number was a suggestion.
          outfits: [],
          followUp: null,
          source: 'closet' as const,
        };
      }

      /**
       * A board-led ask is answered like a fact: on device, deterministically,
       * spending nothing. The board and Pin listings come through the
       * `pinterest-api` proxy live; choosing among them is arithmetic
       * (`inspiration.ts`); the outfit is the same engine as every other
       * turn. No model is called, so no allowance is claimed and no paywall
       * can open — and no Pin content travels anywhere except back to this
       * screen. Failures return as ordinary sentences rather than failed
       * turns: "connect Pinterest first" is an answer, not an outage.
       */
      const inspiration = parseInspirationAsk(question);
      if (inspiration) {
        const empty = { outfits: [], followUp: null, source: 'closet' as const };
        try {
          const boards = await fetchAllBoards();
          if (!boards.length) {
            return { reply: inspirationFailureText('no_boards', null), ...empty };
          }
          const board = inspiration.boardPhrase
            ? chooseBoard(boards, inspiration.boardPhrase)
            : boards.length === 1
              ? boards[0]!
              : null;
          if (!board) {
            return {
              reply: inspirationFailureText('no_board_match', inspiration.boardPhrase),
              ...empty,
            };
          }
          const pins = rankPins(await fetchPins(board.id), question);
          const pin = pins[0];
          if (!pin) {
            return { reply: inspirationFailureText('board_empty', null), ...empty };
          }

          const askContext = contextForQuestion(context, question, options?.intent);
          const outfits = generateOutfits(wardrobe, askContext, {
            weights: profile.weights,
            affinities: profile.affinities,
            count: 2,
            diversity: 0.7,
          });

          const relevant = pinRelevant(pin, question);

          // COUNTS AND CODES ONLY — which door, whether the Pin met the ask,
          // how many outfits. Never the board, the Pin, or the question.
          track('stylist_inspiration', {
            outcome: 'ok',
            relevant,
            outfits: outfits.length,
          });

          return {
            reply: inspirationReplyText(inspiration.boardPhrase, relevant, outfits.length),
            outfits,
            followUp: null,
            source: 'closet' as const,
            pin: {
              boardName: board.name,
              title: pin.title,
              pinUrl: pin.pinUrl,
              imageUrl: pin.imageUrl,
            } satisfies PinReference,
          };
        } catch (err) {
          const code = err instanceof PinterestRequestError ? err.code : 'offline';
          track('stylist_inspiration', { outcome: code });
          const cause =
            code === 'not_connected'
              ? ('not_connected' as const)
              : code === 'unauthorized' || code === 'forbidden'
                ? ('reconnect' as const)
                : code === 'rate_limited'
                  ? ('rate_limited' as const)
                  : code === 'provider_down' || code === 'not_found'
                    ? ('provider_down' as const)
                    : ('offline' as const);
          return { reply: inspirationFailureText(cause, inspiration.boardPhrase), ...empty };
        }
      }

      // Generate against a context built from the question, not from today.
      // Asking "what do I pack for Rome in July" must not be ranked against a
      // February forecast.
      const askContext = contextForQuestion(context, question, options?.intent);
      const shortlist = generateOutfits(wardrobe, askContext, {
        weights: profile.weights,
        affinities: profile.affinities,
        count: SHORTLIST,
        diversity: 0.5,
      });

      // The second fence behind the restore filter: no empty-text turn may
      // reach the wire, because the server 400s the whole request over one.
      const priorTurns = sendableHistory(messages);

      // ── THE CEILING ─────────────────────────────────────────────────────
      //
      // `invoke` carries no timeout of its own, so a flaky network used to
      // mean an INFINITE pending turn — greyed disc, no failure, no retry.
      // The same race the auth run holds its send to (email.tsx, 8s), two
      // seconds longer because a model turn is honestly slower. Rejecting
      // (rather than resolving a shape) keeps the loser out of the success
      // path entirely: the catch below reads the sentinel and the turn
      // settles as a retryable failure.
      const { data, error } = await Promise.race([
        supabase.functions.invoke('stylist-chat', {
          body: {
          message: question,
          history: priorTurns,
          // Only present when the person tapped through the questionnaire. The
          // composed sentence says the same things in prose, but prose is a
          // guess and these are the answers themselves — the model gets to act
          // on "mood: dark" rather than infer it.
          brief: options?.brief,
          digest: closetDigest(wardrobe),
          // The learned taste summary, plus one standing sentence from the
          // lifestyle profile — the server prints each line as "They {s}.",
          // so "are a student and mostly dress for class, going out and game
          // day" reads as a fact beside the learned ones. Composed from the
          // closed vocabularies only, appended last so the learned lines are
          // never displaced, and bounded (the server admits 24 lines; the
          // learner writes far fewer).
          styleSummary: lifestyleLine ? [...profile.summary, lifestyleLine] : profile.summary,
          candidates: shortlist.map((c) => ({
            id: candidateId(c),
            score: c.score,
            notes: Object.values(c.notes).filter(Boolean),
            items: c.items.map((g) => ({
              slot: g.slot,
              name: g.subcategory ?? g.category,
              color: g.colors[0]?.name ?? '',
              formality: g.formality,
            })),
          })),
          context: askContext.weather
            ? {
                weather: {
                  feelsLikeC: askContext.weather.feelsLikeC,
                  precipitationChance: askContext.weather.precipitationChance,
                },
              }
            : undefined,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(SEND_TIMED_OUT)), SEND_CEILING_MS),
        ),
      ]);

      if (error) throw error;
      if (data?.error === 'ai_consent_required') throw new Error('ai_consent_required');
      if (!data?.ok) throw new Error(data?.error ?? 'The stylist is offline.');

      const byId = new Map(shortlist.map((c) => [candidateId(c), c]));
      const outfits = (data.outfitIds as string[])
        .map((id) => byId.get(id))
        .filter((c): c is OutfitCandidate => Boolean(c));

      return {
        reply: data.reply as string,
        outfits,
        followUp: (data.followUp ?? null) as string | null,
        // ── THE SERVER'S OWN ALLOWANCE FACT ───────────────────────────────
        //
        // Three bounded integers, present only for a confirmed Standard
        // settlement — Pro sends null, because "unlimited" has no remainder.
        // Read rather than derived: the client counts nothing, because a
        // number assembled here would be wrong the moment somebody used a
        // second phone.
        allowance: readAllowance(data.allowance),
      };
    },
  });

  /**
   * The asks behind failed turns, keyed by the failed bubble's id, so a retry
   * can re-run the same question in the same bubble. A ref, not state: the map
   * drives no render of its own — the `retryable` flag on the message does.
   */
  const failedAsks = useRef(new Map<string, { question: string; options?: AskOptions }>());

  /**
   * The last allowance the SERVER reported. Null until it says.
   *
   * State rather than a ref, because the opening's chats-left mark renders
   * from it. It is only ever assigned from a settled reply or a refusal that
   * carried the fact — never incremented, never decremented, never guessed.
   */
  const [allowance, setAllowance] = useState<StylistAllowance | null>(null);

  /**
   * One model turn against an already-mounted assistant bubble. Shared by
   * `ask` (fresh bubble) and `retry` (the failed bubble, flipped back to
   * pending) so a retried turn resolves in place rather than replaying the
   * question as a second pair of bubbles.
   */
  const run = useCallback(
    async (placeholderId: string, question: string, options?: AskOptions) => {
      try {
        const result = await send.mutateAsync({ question, options });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  text: result.reply,
                  outfits: result.outfits,
                  followUp: result.followUp,
                  // Present only on an inspiration turn, and never persisted —
                  // see the field's note on ChatMessage.
                  pin: 'pin' in result ? (result.pin ?? null) : null,
                  pending: false,
                  failed: false,
                  retryable: false,
                }
              : m,
          ),
        );
        // Success only, counts only — never the question or the reply.
        // THAT a reply landed. The plate COUNT is reported by the screen from
        // the settled message, bounded there — `outfitCount` here was
        // unbounded by shape, and a reply is not the place to describe a
        // wardrobe.
        track(STYLIST_EVENTS.chatReplyOk, chatReplyOkProps());
        if (result.allowance) setAllowance(result.allowance);
        void persist('assistant', {
          text: result.reply,
          followUp: result.followUp,
          outfitItemIds: result.outfits.map((o) => o.items.map((g) => g.id)),
        });
      } catch (err) {
        const consent = err instanceof Error && err.message === 'ai_consent_required';

        // The race's own sentinel. Not a refusal and not proof the request
        // never arrived — only that the wait outlived the ceiling — so it
        // gets its own sentence and the ordinary transport retry.
        const timedOut = err instanceof Error && err.message === SEND_TIMED_OUT;

        // A refusal is not an outage, and saying "could not be reached" when the
        // real answer is "this is part of Standard" both misleads the user and
        // throws away the one moment they are most likely to upgrade.
        const denial = consent ? null : await classifyDenial(err);

        // ── 503 · THE ALLOWANCE COULD NOT BE CHECKED ──────────────────────
        //
        // Read here rather than in `classifyDenial`, which is shared with
        // Today, the Reveal and the gap feed and has no business learning a
        // stylist-only status. It is RETRYABLE — the server refused to guess,
        // not to serve — and it is neither a paywall nor an outage, so it gets
        // its own sentence rather than borrowing one that would misdescribe it.
        const unavailable = !consent && !denial && (await isAllowanceUnavailable(err));
        const held = !consent && !denial && !unavailable && (await isCapacityHeld(err));

        // ── 503 · THE WORKLOAD IS SWITCHED OFF ────────────────────────────
        //
        // A disabled `ai_config` row used to fall through to the generic
        // "could not be reached" — blaming the network for a dashboard
        // decision. Still retryable: the switch flips back, and a retry then
        // simply works.
        const disabled =
          !consent && !denial && !unavailable && !held && (await isWorkloadDisabled(err));

        // THAT a turn failed, and which of the four bounded causes — declared
        // in the union since redesign 16 and never emitted until the
        // 2026-09-02 audit, so every failed ask read as silence.
        track(
          STYLIST_EVENTS.chatError,
          chatErrorProps(
            consent
              ? 'consent'
              : denial?.kind === 'plan_excluded'
                ? 'plan_excluded'
                : denial?.kind === 'quota_exceeded'
                  ? 'quota'
                  : 'transport',
          ),
        );

        // A refusal that carried the allowance fact updates the mark, so the
        // screen that says no also says how many are left. Both the exhausted
        // 429 and the capacity-held 503 carry it.
        if (denial?.kind === 'quota_exceeded' || held) {
          const carried = await readAllowanceFromError(err);
          if (carried) setAllowance(carried);
        }

        const text = consent
          ? 'Cinch needs your permission to use AI before it can answer. You can turn it on from the Add clothes screen.'
          : denial?.kind === 'plan_excluded'
            ? 'The stylist is part of Standard and Pro.'
            : denial?.kind === 'quota_exceeded'
              ? 'You have used this month’s stylist chats.'
              : unavailable
                // "No SUCCESSFUL chat was used" rather than "nothing was
                // used". The separate internal attempt ceiling has already
                // been consumed by this request, and a blanket "nothing" would
                // be a small lie about the thing the reader cannot see. What
                // they are promised — five successful chats — is intact.
                ? 'Cinch could not check your stylist allowance just now. No successful chat was used — try again in a moment.'
                : held
                  // NOT "you have used this month's chats" — fewer than five
                  // are on record, and the mark beside this still says so.
                  // Nothing about another device, or that one exists.
                  ? CAPACITY_HELD_COPY.body
                : disabled
                  ? WORKLOAD_DISABLED_COPY.body
                : timedOut
                  // Deliberately NOT "nothing was spent": the race abandoned
                  // the wait, not the request, and the reply may still have
                  // landed on the server. The transport line below can say
                  // more because a failed invoke really did not arrive.
                  ? SEND_TIMED_OUT_COPY.body
                : 'The stylist could not be reached. Your outfits on the Today tab still work — they are built on your phone.';

        // Only a transport failure earns a retry affordance; a refusal would
        // simply refuse again, and the denial path below already offers its
        // own next step.
        const retryable = !consent && !denial;
        if (retryable) failedAsks.current.set(placeholderId, { question, options });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId ? { ...m, pending: false, failed: true, retryable, text } : m,
          ),
        );

        if (denial) {
          // Superwall decides whether this particular user sees a paywall here.
          // The question is re-asked only on a grant, so a dismissed paywall
          // leaves the message above standing rather than silently retrying
          // into the same refusal.
          //
          // Through a ref because the retry is `ask` itself: naming it directly
          // would make the callback depend on the value it is defining.
          void gate.present(Placement.OpenStylist, () => askRef.current(question, options));
        }
      }
    },
    [persist, send, gate],
  );

  const ask = useCallback(
    async (question: string, options?: AskOptions) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        outfits: [],
        followUp: null,
      };
      const placeholder: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: '',
        outfits: [],
        followUp: null,
        pending: true,
      };

      setMessages((prev) => [...prev, userMessage, placeholder]);
      void persist('user', { text: trimmed });

      await run(placeholder.id, trimmed, options);
    },
    [persist, run],
  );

  /**
   * Re-run a failed turn in its own bubble.
   *
   * The bubble flips back to pending and the same question goes up again —
   * nothing is appended, so the thread reads as one question that took two
   * tries, which is what happened. The user's turn was already persisted on
   * the first attempt and is not written twice.
   */
  const retry = useCallback(
    (messageId: string) => {
      const failed = failedAsks.current.get(messageId);
      if (!failed || send.isPending) return;
      failedAsks.current.delete(messageId);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, pending: true, failed: false, retryable: false, text: '' } : m,
        ),
      );

      void run(messageId, failed.question, failed.options);
    },
    [run, send.isPending],
  );

  // In an effect, not during render: a ref written while rendering is a value
  // React cannot see change, and the compiler rejects it outright.
  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  /**
   * Start a fresh conversation.
   *
   * Invalidating `chat-history` would be exactly wrong here: the query refetches
   * the most recent session — the one we just walked away from — and the thread
   * reappears. Instead the cached history is replaced with an empty list, which
   * is the truth for a new session, and the next `persist` opens a real one
   * because `sessionRef` is null. The prior conversation stays in the database,
   * where it belongs; this is "new chat", not "delete history".
   *
   * `seeded` is latched here for the same reason, one layer down: a refetch that
   * lands after this point still carries the old thread, and the seeding effect
   * has to know it was already offered and declined.
   */
  const clear = useCallback(() => {
    setMessages([]);
    sessionRef.current = null;
    seeded.current = true;
    qc.setQueryData<ChatMessage[]>(['chat-history'], []);
  }, [qc]);

  return {
    messages,
    ask,
    retry,
    clear,
    isSending: send.isPending,
    /** The server's own allowance fact, or null until it has said. */
    allowance,
  };
}
