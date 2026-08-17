/**
 * The private-groups presentational kit, in one import path.
 *
 * Everything here takes props and draws. Nothing fetches, mutates a membership
 * or navigates — the surface that composes these owns all three, and the split
 * is what lets the nine states be tested without a renderer or a network.
 *
 * The words all come from `@/features/circles/copy`, which is a `.ts` with no
 * React in it, so a sentence that makes a promise about who can see something
 * can be asserted without rendering anything.
 */

export {
  DeleteGroupDialog,
  LeaveGroupDialog,
  RemoveMemberDialog,
} from './confirm-dialogs';
export { GroupRow } from './group-row';
export { InvitationCard } from './invitation-card';
export { MemberRow, PendingInvitationRow } from './member-row';
export { PickerRow } from './picker-row';
export {
  AcceptRefusedNotice,
  AloneState,
  GroupFullNotice,
  GroupsOfflineState,
  NoGroupsState,
} from './state-screens';
