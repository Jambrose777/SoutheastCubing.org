import { Delegate } from 'src/app/models/Delegate';
import { PlannerCompetition } from 'src/app/models/PlannerCompetition';
import { OTHER_EQUIPMENT_VALUE, sortEquipmentHolders } from '../competition-planner.util';

// Alphabetizes the Delegate roster used by equipment controls.
export function getSortedEquipmentRoster(roster: Delegate[]): Delegate[] {
  return [...roster].sort((left, right) => left.name.localeCompare(right.name));
}

// Adds the generic Other choice and keeps it after named holders.
export function getEquipmentSelectOptions(roster: Delegate[]) {
  return sortEquipmentHolders([
    ...roster.map((delegate) => ({
      value: delegate.peopleId,
      peopleId: delegate.peopleId,
      name: delegate.name,
    })),
    { value: OTHER_EQUIPMENT_VALUE, peopleId: null, name: 'Other' },
  ]);
}

// Resolves selected holders, retaining saved people missing from the roster.
export function getEquipmentAssignments(
  values: string[],
  detailsByHolder: Record<string, string>,
  savedHolders: PlannerCompetition['equipmentHolders'],
  roster: Delegate[],
) {
  return sortEquipmentHolders(
    values.map((value) => {
      const peopleId = value === OTHER_EQUIPMENT_VALUE ? null : value;
      const savedHolder = savedHolders.find((holder) => holder.peopleId === peopleId);
      const person =
        peopleId === null
          ? null
          : (roster.find((delegate) => delegate.peopleId === peopleId) ??
            (savedHolder && savedHolder.peopleId !== null ? savedHolder : null));
      return {
        value,
        peopleId,
        person,
        name: peopleId === null ? 'Other' : (person?.name ?? ''),
        equipmentDetails: detailsByHolder[value] ?? '',
      };
    }),
  );
}
