import { PlannerCompetition, PlannerPerson } from 'src/app/models/PlannerCompetition';
import { SelectedPerson } from 'src/app/models/Person';
import { PlannerMajorHoliday } from './competition-planner-holidays.util';

type CompetitionDateRange = Pick<PlannerCompetition, 'start_date' | 'end_date'>;

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

// Alphabetizes person holders and always places the generic "Other" assignment last.
export function sortEquipmentHolders<T extends { peopleId: string | null; name: string }>(
  holders: T[],
): T[] {
  return [...holders].sort((left, right) => {
    if (left.peopleId === null) return right.peopleId === null ? 0 : 1;
    if (right.peopleId === null) return -1;
    return left.name.localeCompare(right.name);
  });
}

// Returns Saturdays whose Saturday and Sunday dates are both free of competitions.
// Returns Saturdays free of competitions and, when supplied, major holidays.
export function getOpenWeekendDates(
  competitions: CompetitionDateRange[],
  startDate: string,
  endDate: string,
  holidays: Pick<PlannerMajorHoliday, 'date'>[] = [],
): string[] {
  if (startDate > endDate) return [];

  const firstDate = new Date(`${startDate}T00:00:00.000Z`);
  const lastDate = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(firstDate.getTime()) || !Number.isFinite(lastDate.getTime())) return [];

  const daysUntilSaturday = (6 - firstDate.getUTCDay() + 7) % 7;
  const saturday = new Date(firstDate);
  saturday.setUTCDate(saturday.getUTCDate() + daysUntilSaturday);

  const openWeekendDates: string[] = [];
  while (saturday <= lastDate) {
    const saturdayDate = saturday.toISOString().slice(0, 10);
    const sunday = new Date(saturday);
    sunday.setUTCDate(sunday.getUTCDate() + 1);
    const sundayDate = sunday.toISOString().slice(0, 10);
    const hasCompetition = competitions.some(
      (competition) => competition.start_date <= sundayDate && competition.end_date >= saturdayDate,
    );
    const hasHoliday = holidays.some(
      (holiday) => holiday.date >= saturdayDate && holiday.date <= sundayDate,
    );

    if (!hasCompetition && !hasHoliday) openWeekendDates.push(saturdayDate);
    saturday.setUTCDate(saturday.getUTCDate() + 7);
  }

  return openWeekendDates;
}
