/**
 * The IO half of `handle-seed.ts` — the claim itself.
 *
 * A separate file for the reason every `*-io.ts` in this codebase exists:
 * `@/lib/supabase` throws at import time without the Expo env, and the
 * candidate rules must stay executable under bare `node --test`.
 *
 * NEVER THROWS. Both callers are on paths that must not feel a failure —
 * the invite screen's arrival (which falls back to "Choose a handle first")
 * and the plate share's link read (which ships the share one sentence
 * shorter). A claim that could not complete returns null and the person
 * keeps every option they had before.
 */

import { queryClient } from '@/lib/query-client';
import { track } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';

import { seedHandleCandidates } from './handle-seed';

/** Postgres: the unique index refused — `profiles_username_key`. */
const UNIQUE_VIOLATION = '23505';
/** Postgres: a check constraint refused — cannot happen for a valid candidate, tolerated. */
const CHECK_VIOLATION = '23514';

function pgCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}

/**
 * Ensure the signed-in account has a handle, seeding one if it has none.
 *
 * Resolves with the handle now on the row — the existing one untouched when
 * there was one, the seeded one otherwise — or null when nothing could be
 * claimed (signed out, unreadable profile, every candidate taken, network).
 *
 * `handle_seeded` fires once per successful seed with the bounded `source`
 * and the number of candidates it took, so the nightly can read how often
 * a name suffices and how often the walk reaches the stub. Nothing fires
 * for an account that already had one.
 */
export async function claimSeedHandle(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('user_id', user.id)
      .maybeSingle<{ username: string | null; display_name: string | null }>();
    if (error) return null;
    if (profile?.username) return profile.username;

    const candidates = seedHandleCandidates({
      displayName: profile?.display_name ?? user.user_metadata?.full_name ?? null,
      email: user.email ?? null,
      userId: user.id,
    });

    let attempts = 0;
    for (const candidate of candidates) {
      attempts += 1;
      // An upsert on `user_id`: the profile row may not exist yet (nothing at
      // sign-up creates one until the first write), and when it does exist
      // only the two columns named here move.
      const { error: writeError } = await supabase.from('profiles').upsert(
        { user_id: user.id, username: candidate.handle, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (!writeError) {
        track('handle_seeded', { source: candidate.source, attempts });
        // Every surface that prints the handle — the invite screen derives
        // its link from `my-profile`, so this is what turns the share on.
        void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['closet-identity'] });
        void queryClient.invalidateQueries({ queryKey: ['profile-header'] });
        return candidate.handle;
      }
      const code = pgCode(writeError);
      if (code === UNIQUE_VIOLATION || code === CHECK_VIOLATION) continue;
      // Anything else — RLS, network, a column that moved — is not a
      // collision, and walking on would repeat the same failure five times.
      return null;
    }
    return null;
  } catch {
    return null;
  }
}
