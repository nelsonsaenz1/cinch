import { uuid } from 'expo-modules-core';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * Transactional, idempotent server commands.
 *
 * Some user actions are several database writes that only make sense together —
 * wearing an outfit creates the outfit, attaches its garments, and counts the
 * wear. Issued from the client as separate requests they are neither atomic nor
 * safely retryable: losing signal between two of them leaves an empty outfit or
 * an uncounted wear, and tapping again makes a SECOND outfit while
 * double-counting every garment.
 *
 * `supabase/migrations/20260804200000_public_boundary_tenant_integrity_and_commands.sql`
 * moves each of those sequences into one PL/pgSQL function, keyed by a
 * client-generated operation id recorded in `command_log`. Replaying the same
 * id returns the original outfit id without redoing the work — which is only
 * true if the id survives the retry, hence `createOperationIds` below.
 */

/** The commands this module knows how to call. */
type CommandName = 'wear_outfit_tx' | 'plan_outfit_tx';
type Command<Name extends CommandName> = Database['public']['Functions'][Name];

/** Run one transactional command and return the id of the outfit it produced. */
export async function runCommand<Name extends CommandName>(
  name: Name,
  args: Command<Name>['Args'],
): Promise<string> {
  const { data, error } = await supabase.rpc(name, args);

  if (error) throw error;
  if (!data) throw new Error(`${name} did not return an outfit.`);
  return data;
}

/** A fresh RFC 4122 v4 operation id, from the native generator in expo-modules-core. */
export function newOperationId(): string {
  return uuid.v4();
}

/**
 * Operation ids that persist across retries of the same user action.
 *
 * This is the whole point of idempotency and the easiest part to get wrong: if
 * a failed "Wear it" is retried with a *fresh* id the server has no way to know
 * it is the same action, and the retry does the work a second time. So the id
 * is minted once per action key and held until the command actually succeeds.
 *
 * `settle` is called on success rather than in a `finally`, so a failure keeps
 * the id available for the next attempt. Wearing the same outfit again later is
 * a genuinely new action and correctly gets a new id.
 */
export function createOperationIds() {
  const ids = new Map<string, string>();

  return {
    /** The id for this action, minting one on first use. */
    for(key: string): string {
      const existing = ids.get(key);
      if (existing) return existing;
      const fresh = newOperationId();
      ids.set(key, fresh);
      return fresh;
    },

    /** The action committed; the next one with this key starts over. */
    settle(key: string): void {
      ids.delete(key);
    },
  };
}
