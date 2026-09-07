import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  INVITE_ASK_ANSWERED_KEY,
  INVITE_ASK_COPY,
  inviteAskAnsweredProps,
  shouldOfferInviteAsk,
} from '../src/features/invite/ask-spec';

/**
 * The invite ask on Today — ledger A23 (issued 2026-09-01, shipped
 * 2026-09-06). Four shares ever, three converted; nobody was ever asked.
 */

const read = (p: string) => readFileSync(p, 'utf8');
const TODAY = read('src/app/(tabs)/index.tsx');
const CARD = read('src/components/today/invite-ask-card.tsx');
const HOOK = read('src/features/invite/use-invite-ask.ts');
const SPEC = read('src/features/invite/ask-spec.ts');
const POSTHOG = read('src/lib/posthog.tsx');

test('the card draws only for a closet that can be dressed, once, and never beside the push card', () => {
  const base = { closetUsable: true, answered: false as boolean | undefined, pushAskShowing: false };
  assert.equal(shouldOfferInviteAsk(base), true);
  assert.equal(shouldOfferInviteAsk({ ...base, closetUsable: false }), false);
  assert.equal(shouldOfferInviteAsk({ ...base, answered: true }), false);
  assert.equal(shouldOfferInviteAsk({ ...base, answered: undefined }), false, 'not yet, never a flash');
  assert.equal(shouldOfferInviteAsk({ ...base, pushAskShowing: true }), false, 'push goes first');
});

test('the shapes are bounded and the key is per install', () => {
  assert.deepEqual(inviteAskAnsweredProps('share'), { action: 'share' });
  assert.deepEqual(inviteAskAnsweredProps('not_now'), { action: 'not_now' });
  assert.equal(INVITE_ASK_ANSWERED_KEY, 'cinch.invite.closet-ask.answered');
  // Taste bar of the Today card: no numeral, no urgency.
  assert.doesNotMatch(INVITE_ASK_COPY.kicker, /\d|!/);
  assert.doesNotMatch(INVITE_ASK_COPY.line, /\d|!/);
  const imports = SPEC.match(/^import .*$/gm) ?? [];
  assert.equal(imports.length, 0, 'the spec is pure');
});

test('the names are in the union', () => {
  for (const name of ['invite_ask_shown', 'invite_ask_answered']) {
    assert.match(POSTHOG, new RegExp(`\\| '${name}'`), name);
  }
});

test('Today draws it in the plate’s card slot, after the push card, hidden on the refusal', () => {
  assert.match(
    TODAY,
    /const inviteAsk = useInviteAsk\(\{\s*closetUsable: pushAskCloset === 'usable',\s*pushAskShowing: pushAsk\.show,\s*\}\);/,
  );
  assert.match(TODAY, /\{!nothingWorks && inviteAsk\.show \? \(\s*<InviteAskCard/);
  assert.equal((TODAY.match(/<InviteAskCard/g) ?? []).length, 1);
  const pushAt = TODAY.indexOf('<PushAskCard\n              closet="usable"');
  const inviteAt = TODAY.indexOf('<InviteAskCard');
  assert.ok(pushAt > 0 && pushAt < inviteAt, 'the push card comes first');
  // Never on the floor branch.
  const floorBranch = TODAY.slice(
    TODAY.indexOf('if (belowActivationFloor(items.length, canGenerate(items))) {'),
    TODAY.indexOf('// T-09 · OFFLINE'),
  );
  assert.doesNotMatch(floorBranch, /InviteAskCard/);
});

test('the card reports its own mount once, on a focused tab; the hook owns the answers and the door', () => {
  assert.match(CARD, /if \(visited\) trackOnce\('invite_ask_shown'\)/);
  assert.doesNotMatch(CARD, /\btrack\(/);
  // Share opens the invite screen, which owns `invite_shared` — no second share path.
  assert.match(HOOK, /track\('invite_ask_answered', inviteAskAnsweredProps\('share'\)\);\s*settle\(\);\s*router\.push\('\/invite'\)/);
  assert.match(HOOK, /track\('invite_ask_answered', inviteAskAnsweredProps\('not_now'\)\);\s*settle\(\)/);
  assert.doesNotMatch(HOOK, /Share\.share|track\('invite_shared'/);
  // Hide first, persist after.
  assert.match(HOOK, /setAnswered\(true\);\s*void AsyncStorage\.setItem\(INVITE_ASK_ANSWERED_KEY, '1'\)/);
  // A failed read counts as answered.
  assert.match(HOOK, /\.catch\(\(\) => \{\s*if \(alive\) setAnswered\(true\);/);
});
