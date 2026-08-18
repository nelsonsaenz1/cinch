/**
 * Redesign 29's Settings surface, in one import path.
 *
 * The per-file paths keep working; the route and the eight `dev-se-*` fixtures
 * should not need to know which of two files each part lives in. Same barrel
 * convention as `components/activity-center/index.ts`.
 */

export { SettingsBody, type SettingsBodyProps } from './settings-body';
export {
  DiagnosticsRow,
  InviteRow,
  MembershipPlate,
  PreferenceRow,
  SettingsKicker,
  SettingsPlate,
  StatementRow,
} from './settings-parts';
