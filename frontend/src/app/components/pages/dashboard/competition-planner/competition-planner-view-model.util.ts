import { Colors, StateColors, States } from 'src/app/shared/types';
import { formatLongDateTime } from 'src/app/shared/date.util';
import {
  getRegistrationStatus,
  getRegistrationStatusColor,
  getRegistrationStatusLabel,
} from 'src/app/shared/registrationStatus.util';
import {
  PlannerCompetition,
  PlannerCompetitionStatus,
  PlannerCompetitionView,
} from 'src/app/models/PlannerCompetition';
import { CurrentUser } from 'src/app/models/CurrentUser';
import { sortEquipmentHolders } from './competition-planner.util';

// Special row types.
export type PlannerTableRow = PlannerCompetition & {
  plannerRowType?: 'holiday' | 'open-weekend';
};

// Display label for each derived Competition Planner Status.
export const PLANNER_STATUS_LABELS: Record<PlannerCompetitionStatus, string> = {
  potential: 'Potential',
  planning: 'Planning',
  announced: 'Announced',
};

// Identifies rows generated for planner calendar dates rather than competitions.
export function isPlannerGeneratedRow(row: PlannerTableRow): boolean {
  return row.plannerRowType !== undefined;
}

export function canEditPlannerCompetition(
  row: PlannerTableRow,
  user: Pick<CurrentUser, 'peopleId' | 'roles'> | null,
): boolean {
  if (isPlannerGeneratedRow(row) || !user) return false;
  if (user.roles.isAdmin || user.roles.isBoard || user.roles.isRegionalDelegate) return true;
  return row.delegates.some((delegate) => delegate.peopleId === user.peopleId);
}

export function canRefreshPlannerCompetition(
  row: PlannerTableRow,
  user: Pick<CurrentUser, 'peopleId' | 'roles'> | null,
): boolean {
  if (!row.wca_competition_id) return false;
  if (row.is_announced) return true;
  return (
    !!user &&
    (user.roles.isAdmin || row.delegates.some((delegate) => delegate.peopleId === user.peopleId))
  );
}

export function hasMissingMultiCityData(row: PlannerCompetition): boolean {
  if (!row.is_multiple_cities_competition) return false;
  return (
    !row.city.trim() ||
    !row.state ||
    !row.venue_address?.trim() ||
    !row.venue_details?.trim() ||
    !row.venue?.trim() ||
    !Number.isFinite(row.latitude_degrees) ||
    !Number.isFinite(row.longitude_degrees) ||
    row.competitor_limit == null ||
    row.competitor_limit < 1 ||
    !row.delegates.some((delegate) => delegate.isLead)
  );
}

export function getCachedCompetitionsForView(
  view: PlannerCompetitionView,
  upcomingCompetitions: PlannerCompetition[] | null,
  pastCompetitions: PlannerCompetition[] | null,
): PlannerCompetition[] | null {
  if (view === 'upcoming') return upcomingCompetitions;
  if (view === 'past') return pastCompetitions;
  if (upcomingCompetitions === null || pastCompetitions === null) return null;

  const competitionsById = new Map<string, PlannerCompetition>();
  for (const competition of [...upcomingCompetitions, ...pastCompetitions]) {
    competitionsById.set(competition.id, competition);
  }
  return [...competitionsById.values()].sort((left, right) =>
    left.start_date.localeCompare(right.start_date),
  );
}

export function getPotentialPlannerCompetitions(
  competitions: PlannerCompetition[],
): PlannerCompetition[] {
  return competitions
    .filter((competition) => competition.status === 'potential')
    .sort((left, right) => left.start_date.localeCompare(right.start_date));
}

// Identifies a holiday row so it can use holiday-specific sorting and styling.
export function isPlannerHolidayRow(row: PlannerTableRow): boolean {
  return row.plannerRowType === 'holiday';
}

// Adapts a generated calendar date into the planner's table shape.
export function toPlannerGeneratedRow(
  name: string,
  date: string,
  plannerRowType: 'holiday' | 'open-weekend',
): PlannerTableRow {
  return {
    id: `${plannerRowType}-${date}`,
    wca_competition_id: null,
    wca_drive_link: null,
    is_major: false,
    is_announced: false,
    is_multiple_cities_competition: false,
    status: 'announced',
    name,
    city: '',
    state: null,
    venue_address: null,
    venue_details: null,
    venue: null,
    venue_url: null,
    latitude_degrees: null,
    longitude_degrees: null,
    start_date: date,
    end_date: date,
    registration_open: '',
    registration_close: '',
    competitor_limit: null,
    accepted_registrations: null,
    waiting_list_count: null,
    waiting_list_count_updated_at: null,
    event_ids: [],
    delegates: [],
    organizers: [],
    equipmentHolders: [],
    plannerRowType,
  };
}

// Formats the registrations/competitor-limit table cell.
export function registrationsText(row: PlannerCompetition): string {
  if (row.competitor_limit == null) return '--';
  return `${row.accepted_registrations ?? 0} / ${row.competitor_limit}`;
}

// Shows a nonzero waiting-list count once a finite competitor limit is reached.
export function showWaitingList(row: PlannerCompetition): boolean {
  const waitingListCount = row.waiting_list_count;
  if (waitingListCount == null || waitingListCount <= 0) return false;
  if (row.competitor_limit == null) return true;
  return (row.accepted_registrations ?? 0) + waitingListCount >= row.competitor_limit;
}

// Formats the waiting-list count's last successful admin-fetch date.
export function waitingListTooltip(row: PlannerCompetition): string {
  const updatedAt = row.waiting_list_count_updated_at;
  return `Waiting List updated at:\n${updatedAt ? formatLongDateTime(updatedAt) : 'Unknown'}`;
}

// Treats missing or invalid timestamps as stale, as well as values older than 24 hours.
export function isWaitingListStale(row: PlannerCompetition): boolean {
  const updatedAt = row.waiting_list_count_updated_at;
  if (!updatedAt) return true;
  const updatedAtMs = Date.parse(updatedAt);
  return !Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > 24 * 60 * 60 * 1000;
}

// Name of the org's own WCA account, sunced onto nearly every competition as
// an organizer - noise in the Organizers column, so it's filtered out of
// what's shown there.
const SOUTHEAST_CUBING_ORGANIZER_NAME = 'Southeast Cubing';
const SOUTHEAST_STATE_CODES = new Set([...Object.keys(States), ...Object.values(States)]);

// Hides Southeast Cubing's synced WCA organizer account from the avatar list.
export function visibleOrganizers(row: PlannerCompetition) {
  return row.organizers.filter((organizer) => organizer.name !== SOUTHEAST_CUBING_ORGANIZER_NAME);
}

export function isSeciOrganizerConnected(row: PlannerCompetition): boolean {
  return row.organizers.some((organizer) => organizer.name === SOUTHEAST_CUBING_ORGANIZER_NAME);
}

export function seciOrganizerConnectionStatus(row: PlannerTableRow): string {
  if (isPlannerGeneratedRow(row) || row.is_major) return 'Not applicable';
  return isSeciOrganizerConnected(row) ? 'Connected' : 'Not connected';
}

// Uses the registration-status palette for the connected-state pill.
export function seciOrganizerConnectedColor(row: PlannerCompetition): Colors {
  return isSeciOrganizerConnected(row) ? Colors.green : Colors.red;
}

// Sorts holders alphabetically and always places the generic assignment last.
export function visibleEquipmentHolders(row: PlannerCompetition) {
  return sortEquipmentHolders(
    row.equipmentHolders.map((holder) => ({
      ...holder,
      name: holder.peopleId === null ? 'Other' : holder.name,
    })),
  );
}

export function isNonSoutheastMajor(row: PlannerCompetition): boolean {
  return row.is_major && !SOUTHEAST_STATE_CODES.has(row.state ?? '');
}

export function plannerLocationColor(row: PlannerCompetition): Colors {
  return isNonSoutheastMajor(row) ? Colors.black : StateColors[row.state ?? '??'];
}

// Derives registration cell text, colors, and date presence from one status.
export function registrationDisplay(row: PlannerCompetition) {
  const status = getRegistrationStatus(row);
  return {
    hasPeriod: status !== null,
    statusText: status ? getRegistrationStatusLabel(status) : '--',
    statusColor: status ? getRegistrationStatusColor(status) : Colors.grey,
  };
}
