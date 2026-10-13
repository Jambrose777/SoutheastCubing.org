// Shapes for the Manage Users dashboard

// One active team membership, as shown on a Manage Users row.
export interface ManageUserTeam {
  teamId: string;
  teamName: string;
  specialRole: string | null;
  isLeader: boolean;
}

// One row's worth of data - shape returned by GET /dashboard/manage-users.
export interface ManageUser {
  peopleId: string;
  seciId: string;
  wcaId: string | null;
  wcaUserId: string | null;
  name: string;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  hasManagedPhoto: boolean;
  pictureSyncedWithWca: boolean;
  email: string | null;
  dob: string | null;
  hasDelegateHistory: boolean;
  delegateRank: 'trainee' | 'junior' | 'delegate' | 'senior' | 'regional' | null;
  delegateState: string | null;
  bio: string | null;
  discordUserId: string | null;
  needsDiscordUserId: boolean;
  teams: ManageUserTeam[];
  updatedAt: string | null;
}
