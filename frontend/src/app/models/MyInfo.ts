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

export type MyInfoPastEntry = MyInfoPastMembership | MyInfoPastLeadershipStint;

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
  memberships: {
    current: MyInfoCurrentMembership[];
    past: MyInfoPastEntry[];
  };
}
