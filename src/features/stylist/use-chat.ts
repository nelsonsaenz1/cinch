import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { track } from '@/lib/posthog';
import { Placement } from '@/features/billing/placements';
import { classifyDenial, useGate } from '@/features/billing/use-gate';
import { generateOutfits, type Garment, type OutfitCandidate, type StyleContext } from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

import type { StyleProfile } from '../styling/queries';
import { closetDigest, contextForQuestion } from './intent';
import type { BriefIntent, StylistBrief } from './questionnaire';

const SHORTLIST = 10;

/** Everything a tapped-through questionnaire knows that the sentence does not. */
export type AskOptions = { brief?: StylistBrief; intent?: BriefIntent };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Outfits the stylist pointed at, resolved back to real candidates. */
  outfits: OutfitCandidate[];
  followUp: string | null;
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
  const gate = useGate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

      return restored;
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

      const priorTurns = messages
        .filter((m) => !m.pending && !m.failed)
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('stylist-chat', {
        body: {
          message: question,
          history: priorTurns,
          // Only present when the person tapped through the questionnaire. The
          // composed sentence says the same things in prose, but prose is a
          // guess and these are the answers themselves — the model gets to act
          // on "mood: dark" rather than infer it.
          brief: options?.brief,
          digest: closetDigest(wardrobe),
          styleSummary: profile.summary,
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
      });

      if (error) throw error;
      if (data?.error === 'ai_consent_required') throw new Error('ai_consent_required');
      if (!data?.ok) throw new Error(data?.error ?? 'The stylist is offline.');

      const byId = new Map(shortlist.map((c) => [candidateId(c), c]));
      const outfits = (data.outfitIds as string[])
        .map((id) => byId.get(id))
        .filter((c): c is OutfitCandidate => Boolean(c));

      return { reply: data.reply as string, outfits, followUp: (data.followUp ?? null) as string | null };
    },
  });

  /**
   * The asks behind failed turns, keyed by the failed bubble's id, so a retry
   * can re-run the same question in the same bubble. A ref, not state: the map
   * drives no render of its own — the `retryable` flag on the message does.
   */
  const failedAsks = useRef(new Map<string, { question: string; options?: AskOptions }>());

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
                  pending: false,
                  failed: false,
                  retryable: false,
                }
              : m,
          ),
        );
        // Success only, counts only — never the question or the reply.
        track('stylist_question_answered', { outfitCount: result.outfits.length });
        void persist('assistant', {
          text: result.reply,
          followUp: result.followUp,
          outfitItemIds: result.outfits.map((o) => o.items.map((g) => g.id)),
        });
      } catch (err) {
        const consent = err instanceof Error && err.message === 'ai_consent_required';

        // A refusal is not an outage, and saying "could not be reached" when the
        // real answer is "this is part of Standard" both misleads the user and
        // throws away the one moment they are most likely to upgrade.
        const denial = consent ? null : await classifyDenial(err);

        const text = consent
          ? 'Cinch needs your permission to use AI before it can answer. You can turn it on from the Add clothes screen.'
          : denial?.kind === 'plan_excluded'
            ? 'The stylist is part of Standard and Pro.'
            : denial?.kind === 'quota_exceeded'
              ? "You have used this month's stylist messages."
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
    isLoading: history.isLoading,
  };
}
