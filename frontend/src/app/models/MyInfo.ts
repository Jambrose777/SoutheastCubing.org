// One current-list entry on My Info - always a membership row.
export interface MyInfoCurrentMembership {
  type: 'membership';
  membershipId: string;
  teamId: string;
  teamName: string;
  specialRole: string | null;
  isLeader: boolean;
  sinceDate: string;
  linksToWhoWeAre: boolean;
}

// Past-list entry on My Info for past Membership
export interface MyInfoPastMembership {
  type: 'membership';
  membershipId: string;
  teamId: string;
  teamName: string;
  specialRole: string | null;
  startDate: string;
  endDate: string | null;
  linksToWhoWeAre: boolean;
}

// Past-list entry on My Info for past Leaderships
export interface MyInfoPastLeadershipStint {
  type: 'leadershipStint';
  leaderId: string;
  teamId: string;
  teamName: string;
  startDate: string;
  endDate: string | null;
  linksToWhoWeAre: boolean;
}

// Current-list entry for a currently-open personal-rank Delegate stint
// (trainee/junior/delegate), combined with the currently-open state row (if
// any) into one line - e.g. "Junior Delegate - Georgia". `state` is null
// for a regional/senior stint, which is never combined with a state.
export interface MyInfoCurrentDelegateRank {
  type: 'delegateRank';
  rankRowId: string;
  rank: 'trainee' | 'junior' | 'delegate' | 'senior' | 'regional';
  state: string | null;
  stateRowId: string | null;
  sinceDate: string;
}

// Defensive-fallback current-list entry for a state row open with no
// personal-rank row open (shouldn't normally happen).
export interface MyInfoCurrentDelegateState {
  type: 'delegateState';
  stateRowId: string;
  state: string;
  sinceDate: string;
}

export type MyInfoCurrentEntry =
  MyInfoCurrentMembership | MyInfoCurrentDelegateRank | MyInfoCurrentDelegateState;

// Past-list entry for a closed delegate_rank_history row.
export interface MyInfoPastDelegateRank {
  type: 'delegateRank';
  rankRowId: string;
  rank: 'trainee' | 'junior' | 'delegate' | 'senior' | 'regional' | 'temporary';
  startDate: string;
  endDate: string | null;
}

// Past-list entry for a closed delegate_state_history row.
export interface MyInfoPastDelegateState {
  type: 'delegateState';
  stateRowId: string;
  state: string;
  startDate: string;
  endDate: string | null;
}

export type MyInfoPastEntry =
  | MyInfoPastMembership
  | MyInfoPastLeadershipStint
  | MyInfoPastDelegateRank
  | MyInfoPastDelegateState;

// Shape returned by GET /dashboard/my-info - every stored field for the
// signed-in user, plus their roles/memberships split into current vs. past.
export interface MyInfo {
  seciId: string;
  wcaId: string | null;
  wcaUserId: string | null;
  name: string;
  email: string | null;
  dob: string | null;
  pictureUrl: string | null;
  hasManagedPhoto: boolean;
  pictureSyncedWithWca: boolean;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  memberships: {
    current: MyInfoCurrentEntry[];
    past: MyInfoPastEntry[];
  };
  // Only present at all for an actual Delegate - absent entirely (not even
  // sent as null) for every other user.
  delegateBio?: string;
}
