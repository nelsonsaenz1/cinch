import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { generateOutfits, type Garment, type OutfitCandidate, type StyleContext } from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

import type { StyleProfile } from '../styling/queries';
import { closetDigest, contextForQuestion } from './intent';

const SHORTLIST = 10;

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Outfits the stylist pointed at, resolved back to real candidates. */
  outfits: OutfitCandidate[];
  followUp: string | null;
  pending?: boolean;
  failed?: boolean;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionRef = useRef<string | null>(null);

  /**
   * Rehydrate the most recent conversation.
   *
   * Outfits are rebuilt by looking their item ids back up in the wardrobe, so a
   * reloaded thread still shows real garments — and a piece deleted since the
   * conversation happened simply drops out rather than rendering as a ghost.
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

      setMessages(restored);
      return restored;
    },
  });

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
    mutationFn: async (question: string) => {
      // Generate against a context built from the question, not from today.
      // Asking "what do I pack for Rome in July" must not be ranked against a
      // February forecast.
      const askContext = contextForQuestion(context, question);
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

  const ask = useCallback(
    async (question: string) => {
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

      try {
        const result = await send.mutateAsync(trimmed);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, text: result.reply, outfits: result.outfits, followUp: result.followUp, pending: false }
              : m,
          ),
        );
        void persist('assistant', {
          text: result.reply,
          followUp: result.followUp,
          outfitItemIds: result.outfits.map((o) => o.items.map((g) => g.id)),
        });
      } catch (err) {
        const consent = err instanceof Error && err.message === 'ai_consent_required';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  pending: false,
                  failed: true,
                  text: consent
                    ? 'Cinch needs your permission to use AI before it can answer. You can turn it on from the Add clothes screen.'
                    : 'The stylist could not be reached. Your outfits on the Today tab still work — they are built on your phone.',
                }
              : m,
          ),
        );
      }
    },
    [persist, send],
  );

  /**
   * Start a fresh conversation.
   *
   * Invalidating `chat-history` would be exactly wrong here: the query refetches
   * the most recent session — the one we just walked away from — and its
   * `queryFn` calls `setMessages`, so the thread reappears. Instead the cached
   * history is replaced with an empty list, which is the truth for a new
   * session, and the next `persist` opens a real one because `sessionRef` is
   * null. The prior conversation stays in the database, where it belongs; this
   * is "new chat", not "delete history".
   */
  const clear = useCallback(() => {
    setMessages([]);
    sessionRef.current = null;
    qc.setQueryData<ChatMessage[]>(['chat-history'], []);
  }, [qc]);

  return {
    messages,
    ask,
    clear,
    isSending: send.isPending,
    isLoading: history.isLoading,
  };
}
