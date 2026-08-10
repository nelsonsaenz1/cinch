import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DataExport } from '@/features/privacy/format';
import { getUserId, supabase } from '@/lib/supabase';

/**
 * PD-04 / PD-05's whole data layer.
 *
 * The export page is a rendering of `data_exports` and nothing else — the
 * migration says so in as many words (`20260810120000_data_exports.sql:33`),
 * which is what lets "Earlier exports" exist without a second source of truth.
 *
 * `data_exports` and `request_data_export()` are not in the generated
 * `Database` type yet (that file is regenerated from production after a
 * migration ships), so both go through an untyped client and cast at the
 * boundary — the pattern `features/event-outfits/queries.ts:22-29` and
 * `features/profile/queries.ts:80-95` already document. Cast the CLIENT, never
 * the method: pulling `rpc` off the object detaches its `this` and the builder
 * throws before reaching the network. Delete the casts after the next
 * `npm run gen:types` and every call site keeps working.
 */
const exportsDb = supabase as unknown as SupabaseClient;

type DataExportRow = {
  id: string;
  requested_at: string;
  status: 'pending' | 'ready' | 'failed';
  ready_at: string | null;
  bytes: number | null;
  expires_at: string | null;
  error: string | null;
};

function toDataExport(row: DataExportRow): DataExport {
  return {
    id: row.id,
    requestedAt: row.requested_at,
    status: row.status,
    readyAt: row.ready_at,
    bytes: row.bytes,
    expiresAt: row.expires_at,
    error: row.error,
  };
}

/** How often a pending export is re-asked while the page is open. */
const PENDING_POLL_MS = 15_000;

/**
 * Every export this account has ever asked for, newest first.
 *
 * The whole history rather than a page of it: there is one row a day at most,
 * and the page's argument is that exporting is "a normal, repeatable thing
 * rather than a one-off escape hatch", which needs the record to be there.
 *
 * RLS returns only the caller's own rows — select-own is the only policy on the
 * table (`20260810120000_data_exports.sql:46-49`) — but the `user_id` filter is
 * written anyway, so the query means what it says without the reader having to
 * go and check the policy.
 */
export function useDataExports() {
  return useQuery({
    queryKey: ['data-exports'],
    // Polls only while something is actually being assembled. A page of
    // finished rows has nothing to wait for, and a fixed interval on it would
    // be a request every fifteen seconds for a number that cannot change.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((row) => row.status === 'pending') ? PENDING_POLL_MS : false,
    queryFn: async (): Promise<DataExport[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await exportsDb
        .from('data_exports')
        .select('id, requested_at, status, ready_at, bytes, expires_at, error')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .returns<DataExportRow[]>();

      if (error) throw error;
      return (data ?? []).map(toDataExport);
    },
  });
}

/**
 * Ask for an export.
 *
 * Through the definer function, never an insert: the table has no insert
 * policy, deliberately, because "a daily limit the client can route around is
 * not a limit" (`20260810120000_data_exports.sql:41-45`). The one-a-day refusal
 * comes back as a Postgres exception with a sentence already written for a
 * human — "you can ask for one export a day" — so the screen surfaces the
 * message rather than inventing its own.
 */
export function useRequestDataExport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const client = supabase as unknown as {
        rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };

      const { data, error } = await client.rpc('request_data_export');
      if (error) throw new Error(error.message);

      const exportId = String(data ?? '');

      // Asking for the export and BUILDING it are two calls, and the second
      // one was missing entirely — the row was created and nothing on earth
      // would ever pick it up. The button worked, the card said "being put
      // together", and it stayed that way forever.
      //
      // Fire-and-forget on purpose. The request has already succeeded by this
      // point: the row exists, it is the user's one for today, and a network
      // blip here must not be reported as a failed request or the daily limit
      // is spent on nothing. If this call never lands, the cron sweep builds
      // the row a few minutes later and the page fills in on its own.
      void supabase.functions
        .invoke('build-export', { body: { exportId } })
        .then(() => qc.invalidateQueries({ queryKey: ['data-exports'] }))
        .catch(() => {});

      return exportId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['data-exports'] });
    },
  });
}

/**
 * A fresh download link for a finished export.
 *
 * The archive lives in a bucket with no policies at all, so a signed-in client
 * cannot mint its own signed URL — it holds `object_path` from its own row and
 * asks the function for a redemption. That is the whole reason `action: 'link'`
 * exists, and why the row's `object_path` is not itself a download.
 *
 * Minted per tap rather than stored, because a signed URL is short-lived by
 * design: a link cached on the page would be a button that works for a while
 * and then quietly stops. The seven-day expiry that the copy promises is
 * `expires_at` on the row, which this refuses past — the two are different
 * clocks and only one of them is a promise to the reader.
 */
export function useExportDownloadLink() {
  return useMutation({
    mutationFn: async (exportId: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean;
        url?: string;
        error?: string;
      }>('build-export', { body: { action: 'link', exportId } });

      // A non-2xx arrives as an error whose `context` is the original
      // Response; the readable sentence is in its body, not in `error.message`.
      if (error) {
        const response = (error as { context?: unknown }).context;
        if (response instanceof Response) {
          try {
            const parsed = (await response.clone().json()) as { error?: unknown };
            if (typeof parsed.error === 'string' && parsed.error.trim()) {
              throw new Error(parsed.error.trim());
            }
          } catch (readFailure) {
            if (readFailure instanceof Error && readFailure.message) throw readFailure;
          }
        }
        throw new Error('That download link could not be made just now.');
      }

      if (!data?.url) throw new Error('That download link could not be made just now.');
      return data.url;
    },
  });
}

/**
 * The address the archive is emailed to.
 *
 * Read off the LOCAL session rather than `getClaims()`, the same call
 * `features/closet/profile.ts:37-42` documents: on Hermes `getClaims()`
 * degrades to a network `getUser()` and inherits the auth client's hang modes,
 * and a verified claim buys nothing when the only use is printing the address
 * back to the person already signed in on this device.
 */
export function useAccountEmail() {
  return useQuery({
    queryKey: ['account-email'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.email ?? null;
    },
  });
}
