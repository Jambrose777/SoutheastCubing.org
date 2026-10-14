import { getPlannerMajorHolidaysBetween } from './competition-planner-holidays.util';
import {
  getOpenWeekendDates,
  getVisibleWcaAnnouncementDeadlineCompetitions,
  sortEquipmentHolders,
} from './competition-planner.util';
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  viewChild,
  TemplateRef,
  computed,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { Colors, EventNames, StateColors, States } from 'src/app/shared/types';
import {
  formatLongDateRange,
  formatLongDateTime,
  formatWeekdayDateRange,
  getYesterdayDateString,
} from 'src/app/shared/date.util';
import {
  PlannerCompetition,
  PlannerCompetitionStatus,
  PlannerCompetitionView,
  PlannerWcaCompetitionOption,
} from 'src/app/models/PlannerCompetition';
import { environment } from 'src/environments/environment';
import { NgClass } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { StripYearPipe } from 'src/app/pipes/stripYear.pipe';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { ManageCompetitionsPromptComponent } from '../../../shared/manage-competitions-prompt/manage-competitions-prompt.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { DataTableComponent, DataTableSort } from '../../../shared/data-table/data-table.component';
import { DataTableActions, DataTableColumn } from '../../../shared/data-table/data-table.types';
import { AddEditCompetitionSheetComponent } from './add-edit-competition-sheet/add-edit-competition-sheet.component';
import { ViewCompetitionSheetComponent } from './view-competition-sheet/view-competition-sheet.component';
import { UnannouncedCompetitionBannersComponent } from './unannounced-competition-banners/unannounced-competition-banners.component';
import { WcaLinkCompetitionSheetComponent } from './wca-link-competition-sheet/wca-link-competition-sheet.component';
import { MultiCityCreateSheetComponent } from './multi-city-create-sheet/multi-city-create-sheet.component';
import { CompetitionRefreshControlComponent } from './competition-refresh-control/competition-refresh-control.component';
import { CompetitionCalendarComponent } from './competition-calendar/competition-calendar.component';
import { WcaAnnouncementDeadlineBannersComponent } from './wca-announcement-deadline-banners/wca-announcement-deadline-banners.component';
import { UnofficialEventIconComponent } from '../../../shared/unofficial-event-icon/unofficial-event-icon.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';
import {
  getRegistrationStatus,
  getRegistrationStatusColor,
  getRegistrationStatusLabel,
} from 'src/app/shared/registrationStatus.util';
import { orderEventIdsByWcaOrder } from 'src/app/shared/event.util';

// Display label for each derived Competition Planner status.
type PlannerTableRow = PlannerCompetition & {
  plannerRowType?: 'holiday' | 'open-weekend';
};

// Identifies rows generated for planner calendar dates rather than competitions.
function isPlannerGeneratedRow(row: PlannerTableRow): boolean {
  return row.plannerRowType !== undefined;
}

// Identifies a holiday row so it can use holiday-specific sorting and styling.
function isPlannerHolidayRow(row: PlannerTableRow): boolean {
  return row.plannerRowType === 'holiday';
}

// Converts a date-only value to its weekend's Saturday, or null on weekdays.
// Adapts a generated calendar date into the planner's table shape only.
function toPlannerGeneratedRow(
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

// Display label for each derived Competition Planner status.
const STATUS_LABELS: Record<PlannerCompetitionStatus, string> = {
  potential: 'Potential',
  planning: 'Planning',
  announced: 'Announced',
};

// The # registrations/competitor limit column's own display text.
function registrationsText(row: PlannerCompetition): string {
  if (row.competitor_limit == null) return '--';
  return `${row.accepted_registrations ?? 0} / ${row.competitor_limit}`;
}

// Shows a nonzero waiting-list count once a finite competitor limit is reached.
function showWaitingList(row: PlannerCompetition): boolean {
  const waitingListCount = row.waiting_list_count;
  if (waitingListCount == null || waitingListCount <= 0) return false;
  if (row.competitor_limit == null) return true;
  return (row.accepted_registrations ?? 0) + waitingListCount >= row.competitor_limit;
}

// Formats the waiting-list count's last successful admin-fetch date.
function waitingListTooltip(row: PlannerCompetition): string {
  const updatedAt = row.waiting_list_count_updated_at;
  return `Waiting List updated at:\n${updatedAt ? formatLongDateTime(updatedAt) : 'Unknown'}`;
}

// Treats missing or invalid timestamps as stale, as well as values older than 24 hours.
function isWaitingListStale(row: PlannerCompetition): boolean {
  const updatedAt = row.waiting_list_count_updated_at;
  if (!updatedAt) return true;
  const updatedAtMs = Date.parse(updatedAt);
  return !Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > 24 * 60 * 60 * 1000; // 24 hours
}

// Name of the org's own WCA account, synced onto nearly every competition as
// an organizer - noise in the Organizers column, so it's filtered out of
// what's shown there.
const SOUTHEAST_CUBING_ORGANIZER_NAME = 'Southeast Cubing';
const SOUTHEAST_STATE_CODES = new Set([...Object.keys(States), ...Object.values(States)]);

function visibleOrganizers(row: PlannerCompetition) {
  return row.organizers.filter((o) => o.name !== SOUTHEAST_CUBING_ORGANIZER_NAME);
}

function visibleEquipmentHolders(row: PlannerCompetition) {
  return sortEquipmentHolders(
    row.equipmentHolders.map((holder) => ({
      ...holder,
      name: holder.peopleId === null ? 'Other' : holder.name,
    })),
  );
}

function isNonSoutheastMajor(row: PlannerCompetition): boolean {
  return row.is_major && !SOUTHEAST_STATE_CODES.has(row.state ?? '');
}

// The Registration Period column's own color - blue before it opens, green
// while open, red once closed.
function registrationPeriodColor(row: PlannerCompetition): Colors {
  const status = getRegistrationStatus(
    row.registration_open,
    row.registration_close,
    row.accepted_registrations,
    row.competitor_limit,
  );
  return status ? getRegistrationStatusColor(status) : Colors.grey;
}

// Potential competitions have no registration dates yet.
function hasRegistrationPeriod(row: PlannerCompetition): boolean {
  return (
    getRegistrationStatus(
      row.registration_open,
      row.registration_close,
      row.accepted_registrations,
      row.competitor_limit,
    ) !== null
  );
}

function registrationStatusText(row: PlannerCompetition): string {
  const status = getRegistrationStatus(
    row.registration_open,
    row.registration_close,
    row.accepted_registrations,
    row.competitor_limit,
  );
  return status ? getRegistrationStatusLabel(status) : '--';
}

function registrationStatusColor(row: PlannerCompetition): Colors {
  const status = getRegistrationStatus(
    row.registration_open,
    row.registration_close,
    row.accepted_registrations,
    row.competitor_limit,
  );
  return status ? getRegistrationStatusColor(status) : Colors.grey;
}

// Competition Planner for Delegates to see and plan upcoming competitions
// with each other.
@Component({
  selector: 'se-competition-planner',
  templateUrl: './competition-planner.component.html',
  styleUrls: ['./competition-planner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    ManageCompetitionsPromptComponent,
    AvatarComponent,
    LoadingSpinnerComponent,
    DataTableComponent,
    StripYearPipe,
    NgClass,
    MatTooltipModule,
    MatSlideToggleModule,
    AddEditCompetitionSheetComponent,
    ViewCompetitionSheetComponent,
    UnannouncedCompetitionBannersComponent,
    WcaLinkCompetitionSheetComponent,
    MultiCityCreateSheetComponent,
    CompetitionRefreshControlComponent,
    CompetitionCalendarComponent,
    WcaAnnouncementDeadlineBannersComponent,
    UnofficialEventIconComponent,
  ],
})
export class CompetitionPlannerComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);
  private competitionPlannerApi = inject(CompetitionPlannerApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isMobile = this.screenSizeService.isMobile;
  environment = environment;
  formatLongDateRange = formatLongDateRange;
  formatWeekdayDateRange = formatWeekdayDateRange;
  StateColors = StateColors;
  EventNames = EventNames;

  loading = signal(true);
  view = signal<PlannerCompetitionView>('upcoming');
  rows = signal<PlannerCompetition[]>([]);
  wcaAnnouncementDeadlineWarnings = computed(() => {
    if (this.view() !== 'upcoming') return [];

    const deadlineDate = new Date();
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + (28 - 1));
    return getVisibleWcaAnnouncementDeadlineCompetitions(
      this.rows(),
      this.authService.currentUser(),
      deadlineDate.toISOString().slice(0, 10),
    );
  });
  private upcomingCompetitions: PlannerCompetition[] | null = null;
  private pastCompetitions: PlannerCompetition[] | null = null;
  showMajorHolidays = signal(true);
  showOpenWeekends = signal(true);
  plannerConsumerState = computed(() => ({
    showMajorHolidays: this.showMajorHolidays(),
    showOpenWeekends: this.showOpenWeekends(),
  }));
  tableRows = computed<PlannerTableRow[]>(() => {
    const competitionRows = this.rows();

    // return rows unchanged.
    if (
      this.view() !== 'upcoming' ||
      (!this.showMajorHolidays() && !this.showOpenWeekends()) ||
      competitionRows.length === 0
    ) {
      return competitionRows;
    }

    // Construct date helpers for Generated Rows
    const lastCompetitionYear = competitionRows.reduce(
      (latestYear, row) => Math.max(latestYear, Number(row.end_date.slice(0, 4))),
      0,
    );
    if (lastCompetitionYear === 0) return competitionRows;
    const startDate = getYesterdayDateString();
    const endDate = `${lastCompetitionYear}-12-31`;

    // Get holidays
    const holidays = this.showMajorHolidays()
      ? getPlannerMajorHolidaysBetween(startDate, endDate)
      : [];
    const holidayRows = holidays.map((holiday) =>
      toPlannerGeneratedRow(holiday.name, holiday.date, 'holiday'),
    );

    // Get Open Weekends
    const openWeekendRows = this.showOpenWeekends()
      ? getOpenWeekendDates(competitionRows, startDate, endDate, holidays).map((date) =>
          toPlannerGeneratedRow('', date, 'open-weekend'),
        )
      : [];

    return [...competitionRows, ...holidayRows, ...openWeekendRows];
  });
  lastBulkRefreshAt = signal<string | null>(null);
  refreshingCompetitionIds = signal<Set<string>>(new Set());
  creatingDriveFolderIds = signal<Set<string>>(new Set());
  potentialRows = computed(() =>
    this.rows()
      .filter((row) => row.status === 'potential')
      .sort((left, right) => left.start_date.localeCompare(right.start_date)),
  );
  statusLabel = (row: PlannerCompetition) => STATUS_LABELS[row.status];
  registrationsText = registrationsText;
  showWaitingList = showWaitingList;
  waitingListTooltip = waitingListTooltip;
  isWaitingListStale = isWaitingListStale;
  visibleOrganizers = visibleOrganizers;
  visibleEquipmentHolders = visibleEquipmentHolders;
  locationColor = (row: PlannerCompetition) =>
    isNonSoutheastMajor(row) ? Colors.black : StateColors[row.state ?? '??'];
  registrationPeriodColor = registrationPeriodColor;
  hasRegistrationPeriod = hasRegistrationPeriod;
  registrationStatusText = registrationStatusText;
  registrationStatusColor = registrationStatusColor;
  isNonSoutheastMajor = isNonSoutheastMajor;

  private dateCell = viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('dateCell');
  private nameCell = viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('nameCell');
  private driveCell = viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('driveCell');
  private locationCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('locationCell');
  private majorCell = viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('majorCell');
  private delegatesCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('delegatesCell');
  private organizersCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('organizersCell');
  private equipmentHoldersCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('equipmentHoldersCell');
  private eventsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('eventsCell');
  private unofficialEventsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('unofficialEventsCell');
  private registrationsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationsCell');
  private statusCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('statusCell');
  private registrationPeriodCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationPeriodCell');
  private registrationStatusCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerTableRow }>>('registrationStatusCell');

  columns = computed<DataTableColumn<PlannerTableRow>[]>(() => [
    {
      key: 'name',
      label: 'Name',
      width: '250px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.name,
      searchValue: (row) => row.name,
      cellTemplate: this.nameCell(),
    },
    {
      key: 'date',
      label: 'Date(s)',
      width: '135px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => `${row.start_date}-${isPlannerHolidayRow(row) ? '0' : '1'}`,
      searchValue: (row) => formatLongDateRange(row.start_date, row.end_date),
      cellTemplate: this.dateCell(),
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
      cellTemplate: this.locationCell(),
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
      cellTemplate: this.majorCell(),
    },
    {
      key: 'delegates',
      label: 'Delegates',
      width: '160px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => row.delegates.map((d) => d.name),
      visibleByDefault: true,
      searchValue: (row) => row.delegates.map((d) => d.name).join(', '),
      cellTemplate: this.delegatesCell(),
    },
    {
      key: 'organizers',
      label: 'Organizers',
      width: '125px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => visibleOrganizers(row).map((o) => o.name),
      visibleByDefault: true,
      searchValue: (row) =>
        visibleOrganizers(row)
          .map((o) => o.name)
          .join(', '),
      cellTemplate: this.organizersCell(),
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
      cellTemplate: this.equipmentHoldersCell(),
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
      searchValue: (row) => this.statusLabel(row),
      cellTemplate: this.statusCell(),
    },
    {
      key: 'wcaDrive',
      label: 'WCA Drive',
      width: '132px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.wca_drive_link ?? '',
      searchValue: (row) => row.wca_drive_link ?? '',
      cellTemplate: this.driveCell(),
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
      cellTemplate: this.eventsCell(),
    },
    {
      key: 'unofficialEvents',
      label: 'Unofficial',
      width: '95px',
      filterable: false,
      visibleByDefault: false,
      searchValue: (row) =>
        (row.unofficial_events ?? []).map((event) => event.event_name).join(', '),
      cellTemplate: this.unofficialEventsCell(),
    },
    {
      key: 'registrations',
      label: '# Reg.',
      width: '100px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.accepted_registrations ?? 0,
      searchValue: (row) => registrationsText(row),
      cellTemplate: this.registrationsCell(),
    },
    {
      key: 'registrationStatus',
      label: 'Reg. Status',
      width: '130px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => [registrationStatusText(row)],
      visibleByDefault: true,
      sortValue: (row) => registrationStatusText(row),
      searchValue: (row) => registrationStatusText(row),
      cellTemplate: this.registrationStatusCell(),
    },
    {
      key: 'registrationPeriod',
      label: 'Registration Period',
      width: '140px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.registration_open,
      searchValue: (row) => formatLongDateRange(row.registration_open, row.registration_close),
      cellTemplate: this.registrationPeriodCell(),
    },
  ]);

  defaultSort = computed<DataTableSort>(() => ({
    columnKey: 'date',
    direction: this.view() === 'past' ? 'desc' : 'asc',
  }));

  trackById = (row: PlannerTableRow) => row.id;

  // Turns off holiday rows when the user sorts by a non-date column.
  // Turns off generated calendar rows when the user sorts by a non-date column.
  onPlannerTableSort(sort: DataTableSort): void {
    if (sort.columnKey !== 'date' && this.view() === 'upcoming') {
      this.showMajorHolidays.set(false);
      this.showOpenWeekends.set(false);
    }
  }

  onMajorHolidayToggleChange(enabled: boolean): void {
    this.showMajorHolidays.set(enabled);
  }

  onOpenWeekendsToggleChange(enabled: boolean): void {
    this.showOpenWeekends.set(enabled);
  }

  // Restores only recognized boolean preferences from the table's saved state.
  restorePlannerConsumerState(state: Record<string, unknown>): void {
    if (typeof state['showMajorHolidays'] === 'boolean') {
      this.showMajorHolidays.set(state['showMajorHolidays']);
    }
    if (typeof state['showOpenWeekends'] === 'boolean') {
      this.showOpenWeekends.set(state['showOpenWeekends']);
    }
  }

  onPlannerTableReset(): void {
    this.showMajorHolidays.set(true);
    this.showOpenWeekends.set(true);
  }

  // Finds incomplete manual data on a multi-city location before it is announced.
  hasMissingMultiCityData = (row: PlannerCompetition): boolean => {
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
  };

  // The sheet being shown, if any - consumed by the View/Add-Edit Competition
  // sheets. null means no sheet is open.
  viewingCompetition = signal<PlannerCompetition | null>(null);
  editingCompetition = signal<PlannerCompetition | null>(null);
  linkingWcaCompetition = signal<PlannerCompetition | null>(null);
  multiCityWcaCompetition = signal<PlannerWcaCompetitionOption | null>(null);
  activeSheet = signal<'add-edit' | 'view' | 'wca-link' | 'multi-city-create' | null>(null);
  isSheetClosing = signal(false);
  private unannouncedCompetitionBanners = viewChild(UnannouncedCompetitionBannersComponent);

  // True for Admin/Board/Regional Delegate, or a Delegate already assigned to
  // this specific competition.
  canEdit = (row: PlannerTableRow): boolean => {
    if (isPlannerGeneratedRow(row)) return false;
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.roles.isAdmin || user.roles.isBoard || user.roles.isRegionalDelegate) return true;
    return row.delegates.some((delegate) => delegate.peopleId === user.peopleId);
  };

  canCreateMajor = computed(() => {
    const user = this.authService.currentUser();
    return !!user && (user.roles.isAdmin || user.roles.isBoard || user.roles.isRegionalDelegate);
  });

  // Refresh is public-data-only for announced rows; planning rows need Admin or assignment.
  canRefreshCompetition = (row: PlannerTableRow): boolean => {
    if (!row.wca_competition_id) return false;
    if (row.is_announced) return true;
    const user = this.authService.currentUser();
    return (
      !!user &&
      (user.roles.isAdmin || row.delegates.some((delegate) => delegate.peopleId === user.peopleId))
    );
  };

  rowActions = computed<DataTableActions<PlannerTableRow>>(() => ({
    overflow: [
      {
        icon: 'fa-circle-exclamation',
        label: 'Location info Needed',
        onClick: (row) => this.openEditCompetition(row),
        visible: (row) => this.canEdit(row) && this.hasMissingMultiCityData(row),
      },
      {
        icon: 'fa-eye',
        label: 'View',
        onClick: (row) => this.openViewCompetition(row),
        visible: (row) => !isPlannerGeneratedRow(row),
      },
      {
        icon: 'fa-pen',
        label: 'Edit',
        onClick: (row) => this.openEditCompetition(row),
        visible: (row) => this.canEdit(row),
      },
      {
        icon: 'fa-arrows-rotate',
        label: 'Refresh WCA data',
        onClick: (row) => this.refreshCompetition(row),
        visible: (row) =>
          this.canRefreshCompetition(row) && !this.refreshingCompetitionIds().has(row.id),
      },
      {
        icon: 'fa-link',
        label: 'Link to WCA',
        onClick: (row) => this.openWcaLinkSheet(row),
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
        onClick: (row) => this.createWcaDriveFolder(row),
        visible: (row) => this.canEdit(row) && !row.is_major && !row.wca_drive_link,
      },
      {
        icon: 'fa-link',
        label: 'Link Drive',
        onClick: (row) => this.openEditCompetition(row),
        visible: (row) => this.canEdit(row) && !row.is_major && !row.wca_drive_link,
      },
      {
        icon: 'fa-trash',
        label: 'Delete',
        onClick: (row) => this.deleteCompetition(row),
        visible: (row) => this.canEdit(row) && row.status !== 'announced',
      },
    ],
  }));

  openAddCompetition(): void {
    this.editingCompetition.set(null);
    this.activeSheet.set('add-edit');
  }

  openViewCompetition(row: PlannerCompetition): void {
    this.viewingCompetition.set(row);
    this.activeSheet.set('view');
  }

  openEditCompetition(row: PlannerCompetition): void {
    this.editingCompetition.set(row);
    this.activeSheet.set('add-edit');
  }

  // Opens a linked WCA Drive folder in a separate tab without exposing this page.
  openWcaDriveFolder(row: PlannerCompetition): void {
    if (!row.wca_drive_link) return;
    window.open(row.wca_drive_link, '_blank', 'noopener,noreferrer');
  }

  // Creates a folder for an editable Planner row and reloads its saved link.
  createWcaDriveFolder(row: PlannerCompetition): void {
    if (
      !this.canEdit(row) ||
      row.is_major ||
      row.wca_drive_link ||
      this.creatingDriveFolderIds().has(row.id)
    ) {
      return;
    }

    this.setDriveFolderCreationPending(row.id, true);
    const pendingToast = this.toastService.pending('Creating WCA Drive folder…');
    this.competitionPlannerApi.createWcaDriveFolder(row.id).subscribe({
      next: () => {
        pendingToast.dismiss();
        this.setDriveFolderCreationPending(row.id, false);
        this.toastService.success('WCA Drive folder created.');
        this.loadCompetitions();
      },
      error: (error) => {
        pendingToast.dismiss();
        this.setDriveFolderCreationPending(row.id, false);
        this.errorBannerService.show(error?.error?.message ?? 'Failed to create WCA Drive folder.');
      },
    });
  }

  // Tracks in-flight folder creation so a row cannot submit the same action twice.
  private setDriveFolderCreationPending(competitionId: string, pending: boolean): void {
    this.creatingDriveFolderIds.update((current) => {
      const next = new Set(current);
      if (pending) next.add(competitionId);
      else next.delete(competitionId);
      return next;
    });
  }

  // Opens the standalone WCA-link sheet for an unlinked Planner row.
  openWcaLinkSheet(row: PlannerCompetition): void {
    this.linkingWcaCompetition.set(row);
    this.activeSheet.set('wca-link');
  }

  // Opens the dedicated batch sheet for a managed multi-city WCA competition.
  openMultiCityCreateSheet(competition: PlannerWcaCompetitionOption): void {
    this.multiCityWcaCompetition.set(competition);
    this.activeSheet.set('multi-city-create');
  }

  closeSheet(): void {
    this.isSheetClosing.set(true);
    setTimeout(() => {
      this.activeSheet.set(null);
      this.isSheetClosing.set(false);
    }, 200);
  }

  requestCloseSheet(sheet: { isDirty(): boolean }): void {
    if (sheet.isDirty() && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    this.closeSheet();
  }

  closeSheetIfBackdrop(event: MouseEvent, sheet: { isDirty(): boolean }): void {
    if (event.target === event.currentTarget) {
      this.requestCloseSheet(sheet);
    }
  }

  closeViewSheetIfBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeSheet();
    }
  }

  onSheetSaved(): void {
    this.closeSheet();
    this.loadCompetitions();
  }

  // Closes the link sheet and reloads WCA-sourced Planner fields.
  onWcaLinkSaved(): void {
    this.closeSheet();
    this.loadCompetitions();
    this.unannouncedCompetitionBanners()?.refresh();
  }

  // Reloads Planner rows and banner eligibility after batch creation.
  onMultiCityCreated(): void {
    this.closeSheet();
    this.loadCompetitions();
    this.unannouncedCompetitionBanners()?.refresh();
  }

  deleteCompetition(row: PlannerCompetition): void {
    if (!confirm(`Permanently delete "${row.name}"? This can't be undone.`)) {
      return;
    }
    const pendingToast = this.toastService.pending('Deleting competition…');
    this.competitionPlannerApi.deleteCompetition(row.id).subscribe({
      next: () => {
        pendingToast.dismiss();
        this.toastService.success('Competition deleted.');
        this.loadCompetitions();
      },
      error: (err) => {
        pendingToast.dismiss();
        this.toastService.error(err?.error?.message ?? 'Failed to delete competition.');
      },
    });
  }

  // Refreshes a single competition.
  private refreshCompetition(row: PlannerCompetition): void {
    if (!this.canRefreshCompetition(row) || this.refreshingCompetitionIds().has(row.id)) return;
    this.refreshingCompetitionIds.update((ids) => new Set(ids).add(row.id));

    const pendingToast = this.toastService.pending('Refreshing WCA data…');
    this.competitionPlannerApi.refreshCompetition(row.id).subscribe({
      next: () => {
        pendingToast.dismiss();
        this.refreshingCompetitionIds.update((ids) => {
          const updated = new Set(ids);
          updated.delete(row.id);
          return updated;
        });
        this.toastService.success('Competition refreshed.');
        this.loadCompetitions();
      },
      error: (err) => {
        pendingToast.dismiss();
        this.refreshingCompetitionIds.update((ids) => {
          const updated = new Set(ids);
          updated.delete(row.id);
          return updated;
        });
        this.toastService.error(err?.error?.message ?? 'Failed to refresh competition.');
      },
    });
  }

  ngOnInit() {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/competition-planner');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);

    this.handleStepUpRedirectParams();
    this.loadCompetitions();
  }

  private loadCompetitions(openEditCompetitionId?: string): void {
    const scope = this.view() === 'upcoming' ? 'upcoming' : 'past'; // Sets calendar to past.
    this.competitionPlannerApi.getCompetitions(scope).subscribe({
      next: (response) => {
        const competitions = response.competitions.map((competition) => ({
          ...competition,
          event_ids: orderEventIdsByWcaOrder(competition.event_ids),
        }));
        if (scope === 'past') {
          this.pastCompetitions = competitions;
        } else {
          this.upcomingCompetitions = competitions;
        }
        this.lastBulkRefreshAt.set(response.meta.lastBulkRefreshAt);
        this.rows.set(this.cachedCompetitionsForView(this.view()) ?? competitions);
        this.loading.set(false);
        const createdCompetition = competitions.find(
          (competition) => competition.id === openEditCompetitionId,
        );
        if (createdCompetition) this.openEditCompetition(createdCompetition);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private cachedCompetitionsForView(view: PlannerCompetitionView): PlannerCompetition[] | null {
    if (view === 'upcoming') return this.upcomingCompetitions;
    if (view === 'past') return this.pastCompetitions;
    if (this.upcomingCompetitions === null || this.pastCompetitions === null) return null;

    const competitionsById = new Map<string, PlannerCompetition>();
    for (const competition of [...this.upcomingCompetitions, ...this.pastCompetitions]) {
      competitionsById.set(competition.id, competition);
    }
    return [...competitionsById.values()].sort((left, right) =>
      left.start_date.localeCompare(right.start_date),
    );
  }

  // Loads the selected date scope without showing rows from the previous scope.
  setPlannerView(view: PlannerCompetitionView): void {
    if (view === this.view()) return;
    this.view.set(view);
    this.rows.set([]);
    const cachedCompetitions = this.cachedCompetitionsForView(view);
    if (cachedCompetitions !== null) {
      this.rows.set(cachedCompetitions);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadCompetitions();
  }

  onBulkRefreshCompleted(): void {
    this.loadCompetitions();
  }

  // Reloads the canonical Planner rows after the child completes a WCA link.
  onPlannerCompetitionLinked(event: { createdCompetitionId?: string } = {}): void {
    this.loadCompetitions(event.createdCompetitionId);
  }

  // The manage_competitions step-up callback lands back here with
  // ?manageCompetitionsGranted=1 or ?authError=denied|failed - surface a
  // toast either way, then strip the param so a page refresh doesn't re-show
  // it, and refresh currentUser so the prompt stops showing once granted.
  private handleStepUpRedirectParams() {
    const params = this.route.snapshot.queryParamMap;
    const granted = params.get('manageCompetitionsGranted');
    const authError = params.get('authError');
    if (!granted && !authError) return;

    if (granted) {
      this.toastService.success('Access granted.');
      this.authService.refreshCurrentUser();
    } else if (authError === 'denied') {
      this.errorBannerService.show('Access request was declined.');
    } else {
      this.errorBannerService.show('Something went wrong granting access.');
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { manageCompetitionsGranted: null, authError: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
