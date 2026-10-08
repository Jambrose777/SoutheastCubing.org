// Shapes for the Competition Planner dashboard tool.

// A Delegate or Organizer on a planner competition row.
export interface PlannerPerson {
  peopleId: string;
  name: string;
  wcaId: string | null;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  isLead?: boolean;
}

// An Equipment holder on a planner competition row - `peopleId` is null for
// the plain "Other" option, which never resolves to a person.
export type PlannerEquipmentHolder = { peopleId: null } | PlannerPerson;

// A competition's derived Competition Planner status - 'potential' (no WCA
// competition id yet), 'planning' (linked but not yet announced), or
// 'announced'.
export type PlannerCompetitionStatus = 'potential' | 'planning' | 'announced';

// One row's worth of data - shape returned by
// GET /dashboard/competition-planner/competitions.
export interface PlannerCompetition {
  id: string;
  url?: string | null;
  website?: string | null;
  wca_competition_id: string | null;
  wca_drive_link: string | null;
  country_iso2?: string | null;
  is_announced: boolean;
  is_multiple_cities_competition: boolean;
  is_in_volunteer_application?: boolean | null;
  status: PlannerCompetitionStatus;
  name: string;
  city: string;
  state: string | null;
  venue_address: string | null;
  venue_details: string | null;
  venue: string | null;
  venue_url: string | null;
  latitude_degrees: number | null;
  longitude_degrees: number | null;
  start_date: string;
  end_date: string;
  full_date?: string;
  registration_open: string;
  registration_close: string;
  competitor_limit: number | null;
  accepted_registrations: number | null;
  waiting_list_count: number | null;
  waiting_list_count_updated_at: string | null;
  event_ids: string[];
  delegates: PlannerPerson[];
  organizers: PlannerPerson[];
  equipmentHolders: PlannerEquipmentHolder[];
}

export interface PlannerRefreshMeta {
  lastBulkRefreshAt: string | null;
}

export interface PlannerCompetitionsResponse {
  competitions: PlannerCompetition[];
  meta: PlannerRefreshMeta;
}

export interface PlannerBulkRefreshResponse {
  competitions: unknown[];
  discordPostFailures: { id: string; name: string }[];
  privateDataRefreshFailed: boolean;
  multiCityRefreshFailedIds: string[];
  meta: PlannerRefreshMeta;
}

export interface PlannerBulkRefreshConflictResponse {
  message: string;
  meta: PlannerRefreshMeta;
}

export interface PlannerCompetitionRefreshResponse {
  id: string;
  wca_competition_id: string;
  is_announced: boolean;
}

// Body for POST/PUT /dashboard/competition-planner/competitions(/:competitionId)
// - the Add/Edit Competition sheet's save payload, shared by create and edit mode.
export interface PlannerCompetitionSaveRequest {
  name: string;
  city: string;
  state: string;
  venueAddress?: string | null;
  venueDetails?: string | null;
  venue?: string | null;
  venueUrl?: string | null;
  latitudeDegrees?: number | null;
  longitudeDegrees?: number | null;
  startDate: string;
  endDate: string;
  competitorLimit?: number | null;
  leadPeopleId: string;
  delegatePeopleIds?: string[];
  organizerPeopleIds?: string[];
  equipmentPeopleIds?: (string | null)[];
  eventIds?: string[];
  createWcaDriveFolder?: boolean;
  wcaDriveLink?: string | null;
}

export interface PlannerWcaDriveFolderResponse {
  folderLink: string;
}

// An eligible WCA competition that the signed-in user manages and has not linked in Planner.
export interface PlannerWcaCompetitionOption {
  wca_competition_id: string;
  name: string;
  url?: string | null;
  website?: string | null;
  city: string;
  state?: string;
  start_date: string;
  end_date?: string;
  event_ids?: string[];
  delegates?: PlannerWcaDelegateOption[];
  organizers?: string[];
  is_multiple_cities_competition: boolean;
}

export interface PlannerWcaDelegateOption {
  name: string;
  wcaId: string | null;
}

// Body for POST /dashboard/competition-planner/competitions/link-wca.
export interface PlannerWcaLinkRequest {
  wcaCompetitionId: string;
  plannerCompetitionId?: string;
  createWcaDriveFolder?: boolean;
  wcaDriveLink?: string | null;
}

export interface PlannerMultiCityLocationRequest {
  city: string;
  state: string;
  venueAddress: string;
  venueDetails: string;
  venue: string;
  venueUrl?: string | null;
  latitudeDegrees: number;
  longitudeDegrees: number;
  competitorLimit: number;
  leadPeopleId: string;
  delegatePeopleIds: string[];
  equipmentPeopleIds?: (string | null)[];
}

export interface PlannerMultiCityCreateRequest {
  wcaCompetitionId: string;
  locations: PlannerMultiCityLocationRequest[];
  createWcaDriveFolder?: boolean;
  wcaDriveLink?: string | null;
}
