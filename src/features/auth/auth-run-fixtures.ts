/**
 * DEV ONLY · Redesign 19 — the poses the auth-run fixtures draw.
 *
 * This lives in `features/` rather than beside the fixtures for one practical
 * reason: a fixture is often copied alone into `src/app/` to be opened in the
 * simulator, and a relative sibling import breaks the moment it moves. Reached
 * through the `@/` alias, this file works from either location.
 *
 * It holds POSES, not fakes. Every sentence and every colour the fixtures draw
 * comes from `auth-run-spec.ts` — the shipping module — so a fixture that looks
 * right is evidence about the app rather than about itself. What is invented
 * here is only the STATE: which second of the cooldown, which failure, how many
 * tries are left. Those are the things a network cannot be asked for on demand.
 */

import {
  RATE_LIMIT_S,
  expiredTrouble,
  nameFailedTrouble,
  offlineTrouble,
  rateLimitedTrouble,
  resendFailedTrouble,
  sendFailedTrouble,
  type Trouble,
} from './auth-run-spec';

export const FIXTURE_EMAIL = 'priya@example.com';
export const FIXTURE_NAME = 'Priya';

// ---------------------------------------------------------------------------

export type EmailPose =
  | 'empty'
  | 'valid'
  | 'invalid'
  | 'sending'
  | 'send-failed'
  | 'rate-limited'
  | 'offline';

export const EMAIL_POSES: readonly EmailPose[] = [
  'empty',
  'valid',
  'invalid',
  'sending',
  'send-failed',
  'rate-limited',
  'offline',
];

export type EmailFrame = {
  readonly value: string;
  readonly tone: 'active' | 'rest' | 'busy' | 'refused';
  readonly invalid: boolean;
  readonly sending: boolean;
  readonly trouble: Trouble | null;
  /** False when the CTA is disabled — an unparsed address, or a live limit. */
  readonly armed: boolean;
};

/** The rate-limit frame is drawn mid-window, where the count is the point. */
const RATE_LIMIT_POSED_S = RATE_LIMIT_S - 60;

export function emailFrame(pose: EmailPose): EmailFrame {
  switch (pose) {
    case 'empty':
      return { value: '', tone: 'active', invalid: false, sending: false, trouble: null, armed: false };
    case 'valid':
      return {
        value: FIXTURE_EMAIL,
        tone: 'active',
        invalid: false,
        sending: false,
        trouble: null,
        armed: true,
      };
    case 'invalid':
      return {
        value: 'priya@example',
        tone: 'refused',
        invalid: true,
        sending: false,
        trouble: null,
        armed: false,
      };
    case 'sending':
      return {
        value: FIXTURE_EMAIL,
        tone: 'busy',
        invalid: false,
        sending: true,
        trouble: null,
        armed: true,
      };
    case 'send-failed':
      return {
        value: FIXTURE_EMAIL,
        tone: 'rest',
        invalid: false,
        sending: false,
        trouble: sendFailedTrouble(),
        armed: true,
      };
    case 'rate-limited':
      return {
        value: FIXTURE_EMAIL,
        tone: 'rest',
        invalid: false,
        sending: false,
        trouble: rateLimitedTrouble(RATE_LIMIT_POSED_S),
        armed: false,
      };
    case 'offline':
      return {
        value: FIXTURE_EMAIL,
        tone: 'rest',
        invalid: false,
        sending: false,
        trouble: offlineTrouble(),
        armed: true,
      };
  }
}

// ---------------------------------------------------------------------------

export type CodePose =
  | 'empty'
  | 'verifying'
  | 'wrong'
  | 'exhausted'
  | 'expired'
  | 'cooldown'
  | 'resending'
  | 'resend-failed';

export const CODE_POSES: readonly CodePose[] = [
  'empty',
  'verifying',
  'wrong',
  'exhausted',
  'expired',
  'cooldown',
  'resending',
  'resend-failed',
];

export type CodeFrame = {
  readonly value: string;
  readonly tone: 'active' | 'busy' | 'refused';
  readonly activeIndex: number;
  readonly wrong: boolean;
  readonly attemptsLeft: number;
  readonly verifying: boolean;
  readonly resending: boolean;
  readonly cooldown: number | null;
  readonly trouble: Trouble | null;
  readonly canChangeEmail: boolean;
};

const NO_TROUBLE = {
  wrong: false,
  attemptsLeft: 3,
  verifying: false,
  resending: false,
  cooldown: null,
  trouble: null,
} as const;

/** The frame draws the cooldown at 47 seconds, and so does the fixture. */
export const POSED_COOLDOWN_S = 47;

export function codeFrame(pose: CodePose): CodeFrame {
  switch (pose) {
    case 'empty':
      return { ...NO_TROUBLE, value: '', tone: 'active', activeIndex: 0, canChangeEmail: true };
    case 'verifying':
      return {
        ...NO_TROUBLE,
        value: '482917',
        tone: 'busy',
        activeIndex: -1,
        verifying: true,
        canChangeEmail: false,
      };
    case 'wrong':
      return {
        ...NO_TROUBLE,
        value: '482913',
        tone: 'refused',
        activeIndex: -1,
        wrong: true,
        attemptsLeft: 2,
        canChangeEmail: false,
      };
    case 'exhausted':
      return {
        ...NO_TROUBLE,
        value: '482913',
        tone: 'refused',
        activeIndex: -1,
        wrong: true,
        attemptsLeft: 0,
        canChangeEmail: false,
      };
    case 'expired':
      return {
        ...NO_TROUBLE,
        value: '',
        tone: 'active',
        activeIndex: -1,
        trouble: expiredTrouble(),
        canChangeEmail: false,
      };
    case 'cooldown':
      return {
        ...NO_TROUBLE,
        value: '',
        tone: 'active',
        activeIndex: 0,
        cooldown: POSED_COOLDOWN_S,
        canChangeEmail: false,
      };
    case 'resending':
      return {
        ...NO_TROUBLE,
        value: '',
        tone: 'active',
        activeIndex: 0,
        resending: true,
        canChangeEmail: false,
      };
    case 'resend-failed':
      return {
        ...NO_TROUBLE,
        value: '',
        tone: 'active',
        activeIndex: -1,
        trouble: resendFailedTrouble(),
        canChangeEmail: false,
      };
  }
}

// ---------------------------------------------------------------------------

export type NamePose = 'empty' | 'typed' | 'saving' | 'failed';

export const NAME_POSES: readonly NamePose[] = ['empty', 'typed', 'saving', 'failed'];

export type NameFrame = {
  readonly value: string;
  readonly tone: 'active' | 'rest' | 'busy';
  readonly saving: boolean;
  readonly trouble: Trouble | null;
  readonly armed: boolean;
};

export function nameFrame(pose: NamePose): NameFrame {
  switch (pose) {
    case 'empty':
      return { value: '', tone: 'active', saving: false, trouble: null, armed: false };
    case 'typed':
      return { value: FIXTURE_NAME, tone: 'active', saving: false, trouble: null, armed: true };
    case 'saving':
      return { value: FIXTURE_NAME, tone: 'busy', saving: true, trouble: null, armed: true };
    case 'failed':
      return {
        value: FIXTURE_NAME,
        tone: 'rest',
        saving: false,
        trouble: nameFailedTrouble(),
        armed: true,
      };
  }
}

// ---------------------------------------------------------------------------

export type HandoffPose = 'new' | 'returning' | 'nameless';

export const HANDOFF_POSES: readonly HandoffPose[] = ['new', 'returning', 'nameless'];

export function handoffFrame(pose: HandoffPose): { isNew: boolean; name: string | null } {
  if (pose === 'new') return { isNew: true, name: FIXTURE_NAME };
  if (pose === 'returning') return { isNew: false, name: FIXTURE_NAME };
  // The greeting the screen falls back to when the session read cannot answer.
  return { isNew: false, name: null };
}
