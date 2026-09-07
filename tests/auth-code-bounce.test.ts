import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SIGN_IN_SUBJECT,
  WINDOW_MS,
  bouncedInWindow,
} from '../supabase/functions/auth-code-status/bounced';
import { CHANGE_ADDRESS, bouncedTrouble, showsOwnCta } from '../src/features/auth/auth-run-spec';

/**
 * The bounced sign-in code (ledger A49, 2026-09-06). 09-05 17:35:53Z: a
 * valid-looking address that does not exist, a hard bounce at Resend within
 * seconds, and a person on "check your email" waiting for a code that could
 * never come. The app never learned. Now it asks.
 */

const NOW = Date.parse('2026-09-05T17:36:30.000Z');
const row = (to: string, at: string, last_event: string, subject = SIGN_IN_SUBJECT) => ({
  to: [to],
  subject,
  created_at: at,
  last_event,
});

test('the fixture from the night it happened: the typo bounced, the retry delivered', () => {
  const page = {
    data: [
      row('sanasharifi179@gmail.com', '2026-09-05T17:37:16.120Z', 'delivered'),
      row('sanasharifi@gmail.com', '2026-09-05T17:35:53.592Z', 'bounced'),
      row('mirbuttion@gmail.com', '2026-09-05T17:28:44.931Z', 'delivered'),
    ],
  };
  assert.equal(bouncedInWindow(page, 'sanasharifi@gmail.com', NOW), true);
  assert.equal(bouncedInWindow(page, 'sanasharifi179@gmail.com', NOW), false);
  assert.equal(bouncedInWindow(page, 'nobody@example.com', NOW), false);
});

test('the newest send to the address decides — a delivered resend clears an earlier bounce', () => {
  const page = {
    data: [
      row('a@b.com', '2026-09-05T17:36:00.000Z', 'delivered'),
      row('a@b.com', '2026-09-05T17:35:00.000Z', 'bounced'),
    ],
  };
  assert.equal(bouncedInWindow(page, 'a@b.com', NOW), false);
});

test('only sign-in codes count, only inside the window, and the address match is case-blind', () => {
  const bounced = row('A@B.com ', '2026-09-05T17:35:00.000Z', 'bounced');
  assert.equal(bouncedInWindow({ data: [bounced] }, 'a@b.com', NOW), true);
  assert.equal(
    bouncedInWindow({ data: [{ ...bounced, subject: '[Cinch support] anything' }] }, 'a@b.com', NOW),
    false,
  );
  const old = new Date(NOW - WINDOW_MS - 1).toISOString();
  assert.equal(bouncedInWindow({ data: [row('a@b.com', old, 'bounced')] }, 'a@b.com', NOW), false);
  // Malformed pages answer no, never throw.
  assert.equal(bouncedInWindow(null, 'a@b.com', NOW), false);
  assert.equal(bouncedInWindow({ data: 'nope' }, 'a@b.com', NOW), false);
  assert.equal(bouncedInWindow({ data: [{ to: 7, subject: SIGN_IN_SUBJECT }] }, 'a@b.com', NOW), false);
});

test('the function answers `bounced` and nothing else, unauthenticated by necessity, false on every failure', () => {
  const fn = readFileSync('supabase/functions/auth-code-status/index.ts', 'utf8');
  const config = readFileSync('supabase/config.toml', 'utf8');
  assert.match(config, /\[functions\.auth-code-status\]\nverify_jwt = false/);
  // Every 200 body is exactly { bounced } — the literal false, or the rule's answer.
  const bodies = fn.match(/json\(\{ bounced[^}]*\}\)/g) ?? [];
  assert.ok(bodies.length >= 3);
  for (const b of bodies) assert.match(b, /^json\(\{ bounced(: false)? \}\)$/);
  assert.match(fn, /const bounced = bouncedInWindow\(page, address, Date\.now\(\)\);/);
  assert.doesNotMatch(fn, /last_event/);
  // A read-capable key first, the send-only key as a fallback — and no key answers false.
  assert.match(fn, /Deno\.env\.get\('RESEND_READ_API_KEY'\) \?\? Deno\.env\.get\('RESEND_API_KEY'\)/);
  assert.match(fn, /if \(!key\) return json\(\{ bounced: false \}\)/);
  // A refused list call is logged (it is the pending signal for a missing key) and still answers false.
  assert.match(fn, /if \(!res\.ok\) \{[\s\S]{0,400}console\.warn\(`auth-code-status: Resend list answered \$\{res\.status\}`\);\s*return json\(\{ bounced: false \}\);/);
  assert.match(fn, /catch \{\s*return json\(\{ bounced: false \}\);/);
  // Bounded input, one field.
  assert.match(fn, /readBoundedJson\(req\)/);
  assert.match(fn, /MAX_EMAIL_CHARS = 254/);
});

test('the code screen watches the first half-minute, restarts on a resend, and its card goes back to the address', () => {
  const screen = readFileSync('src/app/(auth)/code.tsx', 'utf8');
  const client = readFileSync('src/features/auth/code-status.ts', 'utf8');
  // The client module reaches `@/lib/supabase`, which the node suite cannot
  // load — so the schedule is pinned from source.
  assert.match(client, /export const CODE_BOUNCE_CHECKS_MS = \[5_000, 12_000, 25_000\] as const;/);
  // Email only; stops once bounced; every timer cleared on unmount.
  assert.match(screen, /if \(viaPhone \|\| bounced\) return;\s*let alive = true;\s*const timers = CODE_BOUNCE_CHECKS_MS\.map/);
  assert.match(screen, /setBounced\(true\);\s*track\('auth_code_bounced', \{ method: 'email' \}\);/);
  assert.match(screen, /for \(const t of timers\) clearTimeout\(t\);/);
  assert.match(screen, /\}, \[viaPhone, email, bounced, sendSerial\]\);/);
  // A resend restarts the watch.
  assert.match(screen, /setBounced\(false\);\s*setSendSerial\(\(n\) => n \+ 1\);/);
  // Drawn only while the screen is still waiting.
  assert.match(screen, /bounced && value\.length === 0 && !wrong && !verifying \? bouncedTrouble\(\) : null/);
  // The card's door is the address screen, every other card's a fresh send.
  assert.match(screen, /onAction=\{shownTrouble\.door === 'address' \? \(\) => router\.back\(\) : \(\) => void resend\(\)\}/);
  const trouble = bouncedTrouble();
  assert.equal(trouble.door, 'address');
  assert.equal(trouble.action, CHANGE_ADDRESS);
  assert.equal(trouble.tone, 'neutral');
  assert.equal(showsOwnCta(trouble), false);
  // The client reads false on every failure and never throws.
  assert.match(client, /if \(!answer \|\| answer\.error\) return false;/);
  assert.match(client, /return answer\.data\?\.bounced === true;/);
  assert.match(client, /catch \{\s*return false;/);
});
