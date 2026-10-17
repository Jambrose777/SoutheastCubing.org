import { Moment } from 'moment';
import {
  PlannerCompetition,
  PlannerCompetitionSaveRequest,
  PlannerEquipmentHolderInput,
  PlannerMajorCompetitionSaveRequest,
  PlannerPerson,
} from 'src/app/models/PlannerCompetition';
import { UnofficialEventDraft } from '../../../../shared/unofficial-event-icon/unofficial-events.util';

interface CompetitionFormValue {
  name: string | null;
  city: string | null;
  state: string | null;
  venueAddress: string | null;
  venueDetails: string | null;
  venue: string | null;
  venueUrl: string | null;
  latitudeDegrees: number | null;
  longitudeDegrees: number | null;
  startDate: Moment | null;
  endDate: Moment | null;
  competitorLimit: number | null;
  leadPeopleId: string | null;
  createWcaDriveFolder: boolean;
  wcaDriveLink: string | null;
}

interface EquipmentAssignmentDraft {
  peopleId: string | null;
  equipmentDetails: string;
}

interface CompetitionSaveDraft {
  value: CompetitionFormValue;
  delegates: PlannerPerson[];
  organizers: PlannerPerson[];
  equipmentAssignments: EquipmentAssignmentDraft[];
  eventIds: string[];
  unofficialEvents: Pick<UnofficialEventDraft, 'eventName' | 'icon'>[];
  existing: PlannerCompetition | null;
  isMajor: boolean;
}

interface CompetitionSaveBodies {
  regularBody: PlannerCompetitionSaveRequest;
  majorBody: PlannerMajorCompetitionSaveRequest;
}

// Builds regular and major request bodies from the current form draft.
export function buildCompetitionSaveBodies({
  value,
  delegates,
  organizers,
  equipmentAssignments,
  eventIds,
  unofficialEvents,
  existing,
  isMajor,
}: CompetitionSaveDraft): CompetitionSaveBodies {
  const equipmentHolders: PlannerEquipmentHolderInput[] = equipmentAssignments.map(
    ({ peopleId, equipmentDetails }) => ({
      peopleId,
      equipmentDetails: equipmentDetails.trim() || null,
    }),
  );
  const sharedBody = {
    name: value.name ?? '',
    city: value.city ?? '',
    venueAddress: value.venueAddress || null,
    venueDetails: value.venueDetails || null,
    venue: value.venue || null,
    venueUrl: value.venueUrl || null,
    latitudeDegrees: value.latitudeDegrees,
    longitudeDegrees: value.longitudeDegrees,
    startDate: value.startDate?.format('YYYY-MM-DD') ?? '',
    endDate: value.endDate?.format('YYYY-MM-DD') ?? '',
    competitorLimit: value.competitorLimit,
    leadPeopleId: value.leadPeopleId,
    delegatePeopleIds: delegates.map((delegate) => delegate.peopleId),
    organizerPeopleIds: organizers.map((organizer) => organizer.peopleId),
    equipmentHolders,
    eventIds,
    unofficialEvents: unofficialEvents.map(({ eventName, icon }) => ({ eventName, icon })),
  };
  const regularBody: PlannerCompetitionSaveRequest = {
    ...sharedBody,
    state: value.state ?? '',
    leadPeopleId: value.leadPeopleId ?? '',
  };
  const majorBody: PlannerMajorCompetitionSaveRequest = {
    ...sharedBody,
    stateOrCountry: value.state ?? '',
  };

  if (existing && !isMajor) {
    const wcaDriveLink = value.wcaDriveLink?.trim() ?? '';
    if (wcaDriveLink !== (existing.wca_drive_link ?? '')) {
      regularBody.wcaDriveLink = wcaDriveLink || null;
    }
  } else if (!existing && !isMajor) {
    regularBody.createWcaDriveFolder = value.createWcaDriveFolder;
    if (!value.createWcaDriveFolder && value.wcaDriveLink?.trim()) {
      regularBody.wcaDriveLink = value.wcaDriveLink.trim();
    }
  }

  return { regularBody, majorBody };
}
