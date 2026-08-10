/**
 * Atlas 39's routing table, held as assertions.
 *
 * `handleFromUrl` decides four of the five branches in "Where the link goes",
 * and it is the only place in the wave where a wrong answer has a security
 * shape rather than a visual one: `apply_invite` treats the tap on the link AS
 * the consent to the friendship, so a URL that parses when it should not is a
 * way to make somebody a friend of an account they never chose.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bareHandle,
  handleFromUrl,
  inviteUrl,
  inviteUrlForDisplay,
  shareTitle,
} from '../src/features/invite/link';

test('the link is built from the handle, with the @ kept', () => {
  assert.equal(inviteUrl('sophie'), 'https://cinchstyle.com/i/@sophie');
  // Either form in, one form out — the card prints a person, not a row.
  assert.equal(inviteUrl('@Sophie'), 'https://cinchstyle.com/i/@sophie');
});

test('bareHandle strips the sigil and folds case', () => {
  assert.equal(bareHandle('@Sophie'), 'sophie');
  assert.equal(bareHandle('  sophie '), 'sophie');
  assert.equal(bareHandle('@@sophie'), 'sophie');
});

test('the share title is the sentence the landing page prints', () => {
  // The atlas is explicit that these must match: the invite has to read the
  // same in Messages as it does in the browser.
  assert.equal(shareTitle('Sophie'), 'Sophie added you on Cinch');
});

test('the real universal link parses, with or without the @', () => {
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@sophie'), 'sophie');
  assert.equal(handleFromUrl('https://cinchstyle.com/i/sophie'), 'sophie');
  assert.equal(handleFromUrl('https://www.cinchstyle.com/i/@sophie'), 'sophie');
  assert.equal(handleFromUrl('https://CinchStyle.com/i/@Sophie'), 'sophie');
});

test('the custom scheme parses, including the tolerated spelling', () => {
  // cinch:// puts `i` in the host and `@sophie` in the path, which is why the
  // two schemes are read differently rather than through one regex.
  assert.equal(handleFromUrl('cinch://i/@sophie'), 'sophie');
  assert.equal(handleFromUrl('cinch://invite/sophie'), 'sophie');
});

test('a percent-encoded handle is decoded', () => {
  assert.equal(handleFromUrl('https://cinchstyle.com/i/%40sophie'), 'sophie');
});

test('another host is never an invite, however much it looks like one', () => {
  // The whole premise of apply_invite is that tapping the link is the consent.
  // An invite that could be spoofed from any domain would make that false.
  assert.equal(handleFromUrl('https://evil.example/i/@sophie'), null);
  assert.equal(handleFromUrl('https://cinchstyle.com.evil.example/i/@sophie'), null);
  assert.equal(handleFromUrl('https://notcinchstyle.com/i/@sophie'), null);
});

test('a path that is not an invite is not an invite', () => {
  assert.equal(handleFromUrl('https://cinchstyle.com/privacy'), null);
  assert.equal(handleFromUrl('https://cinchstyle.com/'), null);
  assert.equal(handleFromUrl('https://cinchstyle.com/i/'), null);
  assert.equal(handleFromUrl('https://cinchstyle.com/x/@sophie'), null);
});

test('a segment that cannot be a handle is rejected rather than looked up', () => {
  // Mirrors the handle rules the account screen enforces. Passing these to the
  // RPC would be a lookup guaranteed to miss.
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@a'), null, 'too short');
  assert.equal(handleFromUrl(`https://cinchstyle.com/i/@${'a'.repeat(31)}`), null, 'too long');
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@so phie'), null, 'space');
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@sophie!'), null, 'punctuation');
});

test('a trailing segment does not get to disguise a working link', () => {
  // This one caught a real bug: reading the first two segments and ignoring
  // the rest resolved `/i/@so/phie` to `so`, which is free space in which to
  // dress a link up as something else while it still lands on a real account.
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@so/phie'), null);
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@sophie/extra'), null);
  // A bare trailing slash is still the same link, though.
  assert.equal(handleFromUrl('https://cinchstyle.com/i/@sophie/'), 'sophie');
});

test('rubbish in, null out — never a throw', () => {
  // This runs on every cold launch against whatever URL opened the app, so it
  // has to be total.
  assert.equal(handleFromUrl(''), null);
  assert.equal(handleFromUrl('not a url'), null);
  assert.equal(handleFromUrl('javascript:alert(1)'), null);
  assert.equal(handleFromUrl('mailto:hello@mail.cinchstyle.com'), null);
});

test('the card prints the address without the scheme', () => {
  // Caught by holding the simulator against the PNG: both strings are correct
  // and only one is the design. `https://` turns an address a person owns into
  // a URL a machine parses, so the card drops it — and only the card does.
  assert.equal(inviteUrlForDisplay('sophie'), 'cinchstyle.com/i/@sophie');
  assert.equal(inviteUrlForDisplay('@Sophie'), 'cinchstyle.com/i/@sophie');
  // What is SENT keeps the scheme, or it will not linkify in Messages.
  assert.match(inviteUrl('sophie'), /^https:\/\//);
});
