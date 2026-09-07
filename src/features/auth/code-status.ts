import { supabase } from '@/lib/supabase';

import { normalizeEmail } from './email';

/**
 * Did the sign-in code sent to this address bounce? (ledger A49)
 *
 * The code screen asks a few seconds after the send — see
 * `CODE_BOUNCE_CHECKS_MS` — because the app otherwise never learns about a
 * hard bounce: Supabase says "sent", the SMTP layer says "no such mailbox"
 * seconds later, and the person waits on "check your email" for a code that
 * cannot come. The edge function reads Resend's own log and answers a bare
 * yes/no; see `supabase/functions/auth-code-status/index.ts` for what it
 * refuses to say and why.
 *
 * FALSE ON EVERY FAILURE. A network error, a slow function, a 5xx — all read
 * as "not bounced". The one thing this must never do is tell a person with a
 * working address that it bounced; the cost of a missed bounce is the
 * pre-A49 screen, which is bad, and the cost of a false one is a person
 * abandoning a good address, which is worse.
 */
export const CODE_BOUNCE_CHECKS_MS = [5_000, 12_000, 25_000] as const;

/** Past this the answer is treated as "no", whatever is still in flight. */
const CHECK_CEILING_MS = 6_000;

export async function signInCodeBounced(email: string): Promise<boolean> {
  try {
    const answer = await Promise.race([
      supabase.functions.invoke<{ bounced?: unknown }>('auth-code-status', {
        method: 'POST',
        body: { email: normalizeEmail(email) },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CHECK_CEILING_MS)),
    ]);
    if (!answer || answer.error) return false;
    return answer.data?.bounced === true;
  } catch {
    return false;
  }
}
