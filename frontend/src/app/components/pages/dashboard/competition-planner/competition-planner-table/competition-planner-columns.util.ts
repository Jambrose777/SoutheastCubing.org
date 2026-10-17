import { TemplateRef } from '@angular/core';
import { DataTableColumn } from '../../../../shared/data-table/data-table.types';
import { formatLongDateRange } from 'src/app/shared/date.util';
import { EventNames } from 'src/app/shared/types';
import { PlannerCompetition } from 'src/app/models/PlannerCompetition';
import {
  isPlannerHolidayRow,
  PlannerTableRow,
  registrationDisplay,
  registrationsText,
  seciOrganizerConnectionStatus,
  visibleEquipmentHolders,
  visibleOrganizers,
} from '../competition-planner-view-model.util';

export interface CompetitionPlannerTableCells {
  name: TemplateRef<{ $implicit: PlannerTableRow }>;
  date: TemplateRef<{ $implicit: PlannerTableRow }>;
  location: TemplateRef<{ $implicit: PlannerTableRow }>;
  major: TemplateRef<{ $implicit: PlannerTableRow }>;
  delegates: TemplateRef<{ $implicit: PlannerTableRow }>;
  organizers: TemplateRef<{ $implicit: PlannerTableRow }>;
  equipmentHolders: TemplateRef<{ $implicit: PlannerTableRow }>;
  events: TemplateRef<{ $implicit: PlannerTableRow }>;
  unofficialEvents: TemplateRef<{ $implicit: PlannerTableRow }>;
  registrations: TemplateRef<{ $implicit: PlannerTableRow }>;
  status: TemplateRef<{ $implicit: PlannerTableRow }>;
  seciOrganizerConnected: TemplateRef<{ $implicit: PlannerTableRow }>;
  registrationPeriod: TemplateRef<{ $implicit: PlannerTableRow }>;
  registrationStatus: TemplateRef<{ $implicit: PlannerTableRow }>;
  drive: TemplateRef<{ $implicit: PlannerTableRow }>;
}

export function createCompetitionPlannerColumns(
  cells: CompetitionPlannerTableCells,
  statusLabel: (row: PlannerCompetition) => string,
): DataTableColumn<PlannerTableRow>[] {
  return [
    {
      key: 'name',
      label: 'Name',
      width: '250px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.name,
      searchValue: (row) => row.name,
      cellTemplate: cells.name,
    },
    {
      key: 'date',
      label: 'Date(s)',
      width: '135px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => `${row.start_date}-${isPlannerHolidayRow(row) ? '0' : '1'}`,
      searchValue: (row) => formatLongDateRange(row.start_date, row.end_date),
      cellTemplate: cells.date,
    },
    {
      key: 'location',
      label: 'Location',
      width: '200px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => [row.state ?? ''],
      visibleByDefault: true,
      sortValue: (row) => row.city,
      searchValue: (row) => row.city,
      cellTemplate: cells.location,
    },
    {
      key: 'major',
      label: 'Major',
      width: '85px',
      filterable: true,
      filterType: 'custom-multiselect',
      filterOptions: [
        { value: 'major', label: 'Major' },
        { value: 'regular', label: 'Regular' },
      ],
      filterValue: (row) => [row.is_major ? 'major' : 'regular'],
      visibleByDefault: false,
      searchValue: (row) => (row.is_major ? 'Major' : 'Regular'),
      cellTemplate: cells.major,
    },
    {
      key: 'delegates',
      label: 'Delegates',
      width: '160px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => row.delegates.map((delegate) => delegate.name),
      visibleByDefault: true,
      searchValue: (row) => row.delegates.map((delegate) => delegate.name).join(', '),
      cellTemplate: cells.delegates,
    },
    {
      key: 'organizers',
      label: 'Organizers',
      width: '125px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => visibleOrganizers(row).map((organizer) => organizer.name),
      visibleByDefault: true,
      searchValue: (row) =>
        visibleOrganizers(row)
          .map((organizer) => organizer.name)
          .join(', '),
      cellTemplate: cells.organizers,
    },
    {
      key: 'equipmentHolders',
      label: 'Equipment',
      width: '125px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => visibleEquipmentHolders(row).map((holder) => holder.name),
      visibleByDefault: false,
      searchValue: (row) =>
        visibleEquipmentHolders(row)
          .map((holder) => holder.name)
          .join(', '),
      cellTemplate: cells.equipmentHolders,
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      filterable: true,
      filterType: 'custom-multiselect',
      filterOptions: [
        { value: 'potential', label: 'Potential' },
        { value: 'planning', label: 'Planning' },
        { value: 'announced', label: 'Announced' },
      ],
      filterValue: (row) => [row.status],
      visibleByDefault: true,
      sortValue: (row) => row.status,
      searchValue: (row) => statusLabel(row),
      cellTemplate: cells.status,
    },
    {
      key: 'seciOrganizerConnected',
      label: 'SECI Organizer Connected',
      width: '180px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => [seciOrganizerConnectionStatus(row)],
      visibleByDefault: false,
      sortValue: (row) => seciOrganizerConnectionStatus(row),
      searchValue: (row) => seciOrganizerConnectionStatus(row),
      cellTemplate: cells.seciOrganizerConnected,
    },
    {
      key: 'wcaDrive',
      label: 'WCA Drive',
      width: '132px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.wca_drive_link ?? '',
      searchValue: (row) => row.wca_drive_link ?? '',
      cellTemplate: cells.drive,
    },
    {
      key: 'events',
      label: 'Events',
      width: '165px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => row.event_ids,
      visibleByDefault: true,
      searchValue: (row) => row.event_ids.map((event) => EventNames[event]).join(', '),
      cellTemplate: cells.events,
    },
    {
      key: 'unofficialEvents',
      label: 'Unofficial',
      width: '95px',
      filterable: false,
      visibleByDefault: false,
      searchValue: (row) =>
        (row.unofficial_events ?? []).map((event) => event.event_name).join(', '),
      cellTemplate: cells.unofficialEvents,
    },
    {
      key: 'registrations',
      label: '# Reg.',
      width: '100px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.accepted_registrations ?? 0,
      searchValue: registrationsText,
      cellTemplate: cells.registrations,
    },
    {
      key: 'registrationStatus',
      label: 'Reg. Status',
      width: '130px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => [registrationDisplay(row).statusText],
      visibleByDefault: true,
      sortValue: (row) => registrationDisplay(row).statusText,
      searchValue: (row) => registrationDisplay(row).statusText,
      cellTemplate: cells.registrationStatus,
    },
    {
      key: 'registrationPeriod',
      label: 'Registration Period',
      width: '140px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.registration_open,
      searchValue: (row) => formatLongDateRange(row.registration_open, row.registration_close),
      cellTemplate: cells.registrationPeriod,
    },
  ];
}
