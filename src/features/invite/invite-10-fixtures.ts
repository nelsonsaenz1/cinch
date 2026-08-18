import type { InvitePageProps } from '@/components/invite/invite-page';
import type { ArrivalRowModel } from '@/components/invite/arrival-row';

/**
 * Invite / Share — the accepted frames, posed inert. Redesign 10.
 *
 * The artifact's own people and the artifact's own handle, so a fixture route
 * and the frame can be photographed side by side. Every callback is a no-op, so
 * these routes cannot raise a share sheet, write the pasteboard, open a profile
 * or reach the network however hard they are tapped.
 */

const LINK = 'https://cinchstyle.com/i/@priyar';

const arrival = (
  userId: string,
  name: string,
  handle: string,
  isNew = false,
): ArrivalRowModel => ({ userId, name, handle, isNew });

const ARRIVALS: ArrivalRowModel[] = [
  arrival('a-mara', 'Mara Whitfield', '@marawhit', true),
  arrival('a-jo', 'Jo Okonkwo', '@jokonkwo'),
  arrival('a-theo', 'Theo Bassey', '@theob'),
];

const IDLE: InvitePageProps = {
  link: LINK,
  linkDisplay: 'cinchstyle.com/i/@priyar',
  handle: '@priyar',
  linkLoading: false,
  linkError: false,
  onRetryLink: () => {},
  onChooseHandle: () => {},

  onShare: () => {},
  shareFailed: false,
  onRetryShare: () => {},

  onCopy: () => {},
  copied: false,

  arrivals: ARRIVALS,
  arrivalsLoading: false,
  arrivalsError: false,
  arrivalsWithheld: false,
  onRetryArrivals: () => {},
  onOpenArrival: () => {},

  onBack: () => {},
  large: false,
};

const pose = (over: Partial<InvitePageProps>): InvitePageProps => ({ ...IDLE, ...over });

export const INVITE_10_POSES = {
  '01-default': pose({}),
  /** Nobody has joined. It says that, and nothing about how many were invited. */
  '03-empty': pose({ arrivals: [] }),
  /** The link read failed; the roster below is untouched. */
  '05-link-failed': pose({ linkError: true }),
  /** The roster failed; both actions stay fully live. */
  '07-arrivals-failed': pose({ arrivalsError: true, arrivals: [] }),
  /** The link is permanent so it stays shareable; the roster is withheld. */
  '08-offline': pose({ arrivals: [], arrivalsWithheld: true }),
  /** No handle, so no link — the action goes where one is claimed. */
  '09-no-handle': pose({ link: null, linkDisplay: null, handle: null, arrivals: [] }),
  /** Four seconds, same box, same place: only the word and the fill change. */
  '14-copy-confirmed': pose({ copied: true }),
  /** The sheet could not be presented. Copy is promoted; nothing was sent. */
  '12-share-unavailable': pose({ shareFailed: true }),
  /** The control is omitted rather than shown broken. */
  '15-copy-unavailable': pose({ onCopy: undefined }),
  /** Cards go vertical; nothing is clamped. */
  '20-ax': pose({ large: true }),
} as const;

export type Invite10Pose = keyof typeof INVITE_10_POSES;
