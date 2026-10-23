import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  inject,
  input,
  output,
} from '@angular/core';
import { DataTableActions } from '../../../../shared/data-table/data-table.types';
import {
  DataTableComponent,
  DataTableSort,
} from '../../../../shared/data-table/data-table.component';
import { PlannerCompetition, PlannerCompetitionView } from 'src/app/models/PlannerCompetition';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { getYesterdayDateString } from 'src/app/shared/date.util';
import { environment } from 'src/environments/environment';
import { getPlannerMajorHolidaysBetween } from '../competition-planner-holidays.util';
import { getOpenWeekendDates } from '../competition-planner.util';
import { createCompetitionPlannerColumns } from './competition-planner-columns.util';
import {
  canEditPlannerCompetition,
  canRefreshPlannerCompetition,
  hasMissingMultiCityData,
  isPlannerGeneratedRow,
  PlannerTableRow,
  PLANNER_STATUS_LABELS,
  toPlannerGeneratedRow,
} from '../competition-planner-view-model.util';

@Component({
  selector: 'se-competition-planner-table',
  templateUrl: './competition-planner-table.component.html',
  styleUrls: ['./competition-planner-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTableComponent],
})
export class CompetitionPlannerTableComponent {
  rows = input<PlannerCompetition[]>([]);
  view = input<PlannerCompetitionView>('upcoming');
  sortResetKey = input(0);
  showMajorHolidays = input(true);
  showOpenWeekends = input(true);
  consumerState = input<Record<string, unknown>>({});
  refreshingCompetitionIds = input<ReadonlySet<string>>(new Set());
  creatingDriveFolderIds = input<ReadonlySet<string>>(new Set());
  unlinkingCompetitionIds = input<ReadonlySet<string>>(new Set());
  deletingCompetitionIds = input<ReadonlySet<string>>(new Set());

  viewCompetitionRequested = output<PlannerTableRow>();
  editCompetitionRequested = output<PlannerTableRow>();
  refreshCompetitionRequested = output<PlannerTableRow>();
  openWcaLinkSheetRequested = output<PlannerTableRow>();
  createWcaDriveFolderRequested = output<PlannerTableRow>();
  unlinkCompetitionRequested = output<PlannerTableRow>();
  deleteCompetitionRequested = output<PlannerTableRow>();
  sortChange = output<DataTableSort>();
  consumerStateRestored = output<Record<string, unknown>>();
  tableReset = output<void>();

  private authService = inject(AuthService);
  private currentUser = this.authService.currentUser;

  tableRows = computed<PlannerTableRow[]>(() => {
    const competitionRows = this.rows();

    // Returns rows unchanged.
    if (
      this.view() !== 'upcoming' ||
      (!this.showMajorHolidays() && !this.showOpenWeekends()) ||
      competitionRows.length === 0
    ) {
      return competitionRows;
    }

    // Construct date helpers for Generated Rows.
    const lastCompetitionYear = competitionRows.reduce(
      (latestYear, row) => Math.max(latestYear, Number(row.end_date.slice(0, 4))),
      0,
    );
    if (lastCompetitionYear === 0) return competitionRows;
    const startDate = getYesterdayDateString();
    const endDate = `${lastCompetitionYear}-12-31`;

    // zget holidays.
    const holidays = this.showMajorHolidays()
      ? getPlannerMajorHolidaysBetween(startDate, endDate)
      : [];
    const holidayRows = holidays.map((holiday) =>
      toPlannerGeneratedRow(holiday.name, holiday.date, 'holiday'),
    );

    // Get open weekends.
    const openWeekendRows = this.showOpenWeekends()
      ? getOpenWeekendDates(competitionRows, startDate, endDate, holidays).map((date) =>
          toPlannerGeneratedRow('', date, 'open-weekend'),
        )
      : [];

    return [...competitionRows, ...holidayRows, ...openWeekendRows];
  });

  private nameCell = contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('nameCell');
  private dateCell = contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('dateCell');
  private locationCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('locationCell');
  private majorCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('majorCell');
  private delegatesCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('delegatesCell');
  private organizersCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('organizersCell');
  private equipmentHoldersCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('equipmentHoldersCell');
  private eventsCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('eventsCell');
  private unofficialEventsCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('unofficialEventsCell');
  private registrationsCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationsCell');
  private statusCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('statusCell');
  private seciOrganizerConnectedCell = contentChild.required<
    TemplateRef<{ $implicit: PlannerTableRow }>
  >('seciOrganizerConnectedCell');
  private registrationPeriodCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationPeriodCell');
  private registrationStatusCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationStatusCell');
  private driveCell =
    contentChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('driveCell');

  columns = computed(() =>
    createCompetitionPlannerColumns(
      {
        name: this.nameCell(),
        date: this.dateCell(),
        location: this.locationCell(),
        major: this.majorCell(),
        delegates: this.delegatesCell(),
        organizers: this.organizersCell(),
        equipmentHolders: this.equipmentHoldersCell(),
        events: this.eventsCell(),
        unofficialEvents: this.unofficialEventsCell(),
        registrations: this.registrationsCell(),
        status: this.statusCell(),
        seciOrganizerConnected: this.seciOrganizerConnectedCell(),
        registrationPeriod: this.registrationPeriodCell(),
        registrationStatus: this.registrationStatusCell(),
        drive: this.driveCell(),
      },
      (row) => PLANNER_STATUS_LABELS[row.status],
    ),
  );

  defaultSort = computed<DataTableSort>(() => ({
    columnKey: 'date',
    direction: this.view() === 'past' ? 'desc' : 'asc',
  }));

  trackById = (row: PlannerTableRow) => row.id;

  rowActions = computed<DataTableActions<PlannerTableRow>>(() => ({
    overflow: [
      {
        icon: 'fa-circle-exclamation',
        label: 'Location info Needed',
        onClick: (row) => this.editCompetitionRequested.emit(row),
        visible: (row) =>
          canEditPlannerCompetition(row, this.currentUser()) && hasMissingMultiCityData(row),
      },
      {
        icon: 'fa-eye',
        label: 'View',
        onClick: (row) => this.viewCompetitionRequested.emit(row),
        visible: (row) => !isPlannerGeneratedRow(row),
      },
      {
        iconImageSrc: 'assets/wca_logo.svg',
        label: 'Open WCA',
        onClick: (row) => this.openWcaCompetition(row),
        visible: (row) => !!row.wca_competition_id,
      },
      {
        icon: 'fa-pen',
        label: 'Edit',
        onClick: (row) => this.editCompetitionRequested.emit(row),
        visible: (row) => canEditPlannerCompetition(row, this.currentUser()),
      },
      {
        icon: 'fa-arrows-rotate',
        label: 'Refresh WCA data',
        onClick: (row) => this.refreshCompetitionRequested.emit(row),
        visible: (row) => canRefreshPlannerCompetition(row, this.currentUser()),
        disabled: (row) => this.refreshingCompetitionIds().has(row.id),
      },
      {
        icon: 'fa-link',
        label: 'Link to WCA',
        onClick: (row) => this.openWcaLinkSheetRequested.emit(row),
        visible: (row) => row.status === 'potential',
      },
      {
        icon: 'fa-folder-open',
        label: 'View Drive',
        onClick: (row) => this.openWcaDriveFolder(row),
        visible: (row) => !row.is_major && !!row.wca_drive_link,
      },
      {
        icon: 'fa-folder-plus',
        label: 'Create Drive',
        onClick: (row) => this.createWcaDriveFolderRequested.emit(row),
        visible: (row) =>
          canEditPlannerCompetition(row, this.currentUser()) &&
          !row.is_major &&
          !row.wca_drive_link,
        disabled: (row) => this.creatingDriveFolderIds().has(row.id),
      },
      {
        icon: 'fa-link',
        label: 'Link Drive',
        onClick: (row) => this.editCompetitionRequested.emit(row),
        visible: (row) =>
          canEditPlannerCompetition(row, this.currentUser()) &&
          !row.is_major &&
          !row.wca_drive_link,
      },
      {
        icon: 'fa-link-slash',
        label: 'Unlink from WCA',
        onClick: (row) => this.unlinkCompetitionRequested.emit(row),
        visible: (row) =>
          canEditPlannerCompetition(row, this.currentUser()) && row.status === 'planning',
        disabled: (row) => this.unlinkingCompetitionIds().has(row.id),
      },
      {
        icon: 'fa-trash',
        label: 'Delete',
        onClick: (row) => this.deleteCompetitionRequested.emit(row),
        visible: (row) =>
          canEditPlannerCompetition(row, this.currentUser()) && row.status !== 'announced',
        disabled: (row) => this.deletingCompetitionIds().has(row.id),
      },
    ],
  }));

  onSortChange(sort: DataTableSort): void {
    this.sortChange.emit(sort);
  }

  private openWcaDriveFolder(row: PlannerTableRow): void {
    if (!row.wca_drive_link) return;
    window.open(row.wca_drive_link, '_blank', 'noopener,noreferrer');
  }

  private openWcaCompetition(row: PlannerTableRow): void {
    if (!row.wca_competition_id) return;
    window.open(
      `${environment.links.wcaCompetition}${row.wca_competition_id}`,
      '_blank',
      'noopener,noreferrer',
    );
  }
}
