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

// A competition's derived Competition Planner status - 'potential' (no WCA
// competition id yet), 'planning' (linked but not yet announced), or
// 'announced'.
export type PlannerCompetitionStatus = 'potential' | 'planning' | 'announced';

// One row's worth of data - shape returned by
// GET /dashboard/competition-planner/competitions.
export interface PlannerCompetition {
  id: string;
  wca_competition_id: string | null;
  is_announced: boolean;
  status: PlannerCompetitionStatus;
  name: string;
  city: string;
  state: string | null;
  start_date: string;
  end_date: string;
  full_date?: string;
  registration_open: string;
  registration_close: string;
  competitor_limit: number;
  accepted_registrations: number | null;
  delegates: PlannerPerson[];
  organizers: PlannerPerson[];
}
