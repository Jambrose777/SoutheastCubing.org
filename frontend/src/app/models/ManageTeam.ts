// Shapes for the Manage Teams dashboard

export type TeamKind = 'admin' | 'board' | 'officer' | 'board_liaisons' | 'ordinary';

// Fixed subset of frontend/src/styles/color-pallet.scss colors a
// membership/leadership color tag can take.
export type TeamMemberColor =
  'black' | 'blue' | 'dark_grey' | 'green' | 'grey' | 'yellow' | 'purple' | 'orange' | 'red';

export interface TeamMembership {
  id: string;
  team_id: string;
  people_id: string;
  start_date: string;
  end_date: string | null;
  special_role: string | null;
  color: TeamMemberColor | null;
  name: string;
  picture_url: string | null;
  wca_id: string | null;
  is_active_leader: boolean;
  // Only ever set on the Board team's own members - their current Officer
  // team's name (e.g. "President").
  officerRole?: string | null;
  // Only ever set on the Board team's own members - their current Officer
  // row's own color, which wins over this row's own `color` for display.
  officerColor?: TeamMemberColor | null;
}

export interface TeamLeaderStint {
  id: string;
  team_id: string;
  people_id: string;
  start_date: string;
  end_date: string | null;
  name: string;
  picture_url: string | null;
}

export interface ManageTeam {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  hidden: boolean;
  archivedAt: string | null;
  kind: TeamKind;
  isFixed: boolean;
  members: TeamMembership[];
  leadershipHistory: TeamLeaderStint[];
}

export interface PersonSearchResult {
  id: string;
  name: string;
  picture_url: string | null;
  wca_id: string | null;
  wca_user_id: string | null;
  email: string | null;
  has_account: boolean;
}

// An "add by WCA ID" fallback result, proxied from WCA directly - not yet a
// `people` row until actually selected/added.
export interface WcaPersonLookupResult {
  wcaId: string;
  name: string;
  pictureUrl: string | null;
}
