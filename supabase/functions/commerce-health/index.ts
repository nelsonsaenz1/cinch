import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import {
  ALLOWED_MERCHANTS,
  ALLOWLIST_OWNER,
  ALLOWLIST_REVIEW_BY,
  ALLOWLIST_REVIEWED_ON,
} from '../_shared/merchants.ts';

import { evaluate, type Report, type Alert } from './thresholds.ts';
import { alertMail } from './mail.ts';

/**
 * commerce-health — audit items 17 and 26.
 *
 * TWO MODES, ONE SET OF NUMBERS
 *
 *   report   what is true right now, as JSON. For a human.
 *   check    the same numbers run through `thresholds.ts`, and an email if
 *            anything is wrong. For `pg_cron`.
 *
 * They share `commerce_health_report()` deliberately. A dashboard and an alert
 * that compute their facts separately are two systems that can disagree, and
 * the disagreement always surfaces at the worst moment — the graph looks fine
 * and the page never fired, or the reverse.
 *
 * WHY THE COMMERCE SURFACES NEEDED THIS AT ALL
 *
 * Datafeedr stops dead at 10,000 requests with no overage: at the limit it
 * returns error 301 until the bill day, and Cinch's whole commerce path
 * silently becomes "no products" — a state that looks exactly like a garment
 * nobody sells. Every other failure here has the same shape. A cache write that
 * fails costs money and reports nothing, because the user still got their
 * answer from the response already in hand. A merchant allowlist that drifts
 * out of date returns fewer rows, not an error. None of it pages anybody, and
 * none of it is visible from the app.
 *
 * So the point of this function is that the quiet failures make a noise.
 *
 * ── AUTHENTICATION ─────────────────────────────────────────────────────────
 *
 * Same posture as `send-push` and `superwall-webhook`: the caller is `pg_net`
 * or a human with the operator secret, not a Supabase session, so `verify_jwt`
 * is off and `x-cinch-cron` is the entire gate. An unset `PUSH_CRON_SECRET`
 * refuses everything rather than degrading to "accept anything" — this endpoint
 * reports quota levels and merchant counts, which is exactly the shape of thing
 * that should not be readable by a stranger.
 */

function fail(code: string, status: number): Response {
  return Response.json({ error: code }, { status });
}

export default {
  async fetch(req: Request): Promise<Response> {
    const secret = Deno.env.get('PUSH_CRON_SECRET');
    if (!secret) {
      console.error('commerce-health: PUSH_CRON_SECRET is unset; refusing every request.');
      return fail('not_configured', 503);
    }
    if (req.headers.get('x-cinch-cron') !== secret) return fail('forbidden', 403);

    let mode = 'report';
    try {
      const body = (await req.json()) as { mode?: unknown };
      if (body?.mode === 'check' || body?.mode === 'report') mode = body.mode;
    } catch {
      // No body is a report. The cron job always sends one.
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    ) as SupabaseClient<Database>;

    const { data, error } = await admin.rpc('commerce_health_report');
    if (error) return fail('report_failed', 500);

    // ── The half the database cannot see ────────────────────────────────────
    //
    // Whether the provider is configured at all is a property of THIS runtime's
    // environment, not of any table — and it is the single most consequential
    // fact in the report, because an unset key makes every commerce surface
    // return an empty list that is indistinguishable from a real empty result.
    // Presence only. No key, no prefix, no length: a "starts with df_" in an
    // ops email is still a piece of a credential.
    const report: Report = {
      ...(data as unknown as Omit<Report, 'provider' | 'merchants'>),
      provider: {
        datafeedr_configured: Boolean(
          Deno.env.get('DATAFEEDR_ACCESS_ID') && Deno.env.get('DATAFEEDR_ACCESS_KEY'),
        ),
        // Publisher ids do not gate the catalogue — only whether a tracking URL
        // can be built. Reported because "we have an Awin id but zero joined
        // programmes" is precisely the state that makes a paid-link claim false.
        awin_publisher_id_set: Boolean(Deno.env.get('AWIN_PUBLISHER_ID')),
        rakuten_tracking_id_set: Boolean(Deno.env.get('RAKUTEN_TRACKING_ID')),
        unlicensed_fallback_on: Deno.env.get('GARMENT_SEARCH_ALLOW_UNLICENSED') === 'true',
      },
      merchants: {
        allowlisted: ALLOWED_MERCHANTS.length,
        owner: ALLOWLIST_OWNER,
        reviewed_on: ALLOWLIST_REVIEWED_ON,
        review_by: ALLOWLIST_REVIEW_BY,
        // Whole days, floored, so "0" means the review is due today rather
        // than a few hours either side of it.
        review_in_days: Math.floor(
          (Date.parse(`${ALLOWLIST_REVIEW_BY}T00:00:00Z`) - Date.now()) / 86_400_000,
        ),
      },
    };

    const alerts = evaluate(report);

    if (mode === 'report') {
      return Response.json({ report, alerts });
    }

    // ── check ───────────────────────────────────────────────────────────────
    if (alerts.length === 0) return Response.json({ ok: true, alerts: [] });

    // Fires once per state change, not once per tick. Without this an alert
    // that stays true — which is what a quota alert IS — would send an email
    // every hour until the bill day, and an alert nobody can bear to read is
    // the same as no alert.
    const fresh: Alert[] = [];
    for (const alert of alerts) {
      const { data: noted } = await admin.rpc('claim_commerce_alert', {
        p_key: alert.key,
        p_cooldown_hours: alert.cooldownHours,
      });
      if (noted === true) fresh.push(alert);
    }

    if (fresh.length === 0) return Response.json({ ok: true, alerts: [], suppressed: alerts.length });

    const sent = await alertMail(fresh, report);

    // An alert that could not be delivered has not been sent, so the claim goes
    // back and the next tick tries again. Without this, an outage at the mail
    // provider silences the condition for its whole cooldown — and the moment
    // the mail provider is unhealthy is not the moment to stop reporting.
    if (sent !== 'sent') {
      for (const alert of fresh) {
        await admin.rpc('release_commerce_alert', { p_key: alert.key });
      }
    }

    return Response.json({
      ok: sent === 'sent',
      alerts: fresh.map((a) => a.key),
      mail: sent,
    });
  },
};
