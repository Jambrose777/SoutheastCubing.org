import { PlannerPerson } from 'src/app/models/PlannerCompetition';
import { SelectedPerson } from 'src/app/models/Person';

// Maps a selected person to the Planner's person shape.
export function toPlannerPerson(person: SelectedPerson): PlannerPerson {
  return {
    peopleId: person.peopleId ?? '',
    name: person.name,
    wcaId: person.wcaId ?? null,
    pictureUrl: person.pictureUrl,
    thumbnailCropX: person.thumbnailCropX ?? null,
    thumbnailCropY: person.thumbnailCropY ?? null,
    thumbnailCropW: person.thumbnailCropW ?? null,
    thumbnailCropH: person.thumbnailCropH ?? null,
  };
}

export const OTHER_EQUIPMENT_VALUE = '__other__';

// Converts the select's "Other" sentinel into the API's null person ID.
export function equipmentValuesToPeopleIds(values: string[]): (string | null)[] {
  return values.map((value) => (value === OTHER_EQUIPMENT_VALUE ? null : value));
}

// Converts stored equipment-holder IDs into values understood by the select.
export function equipmentPeopleIdsToValues(peopleIds: (string | null)[]): string[] {
  return peopleIds.map((peopleId) => peopleId ?? OTHER_EQUIPMENT_VALUE);
}
