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
import { Colors, EventNames, StateColors } from 'src/app/shared/types';
import { formatLongDateRange, formatLongDateTime } from 'src/app/shared/date.util';
import { PlannerCompetition, PlannerCompetitionStatus } from 'src/app/models/PlannerCompetition';
import { environment } from 'src/environments/environment';
import { NgClass } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { CompetitionRefreshControlComponent } from './competition-refresh-control/competition-refresh-control.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';
import {
  getRegistrationStatus,
  getRegistrationStatusColor,
  getRegistrationStatusLabel,
} from 'src/app/shared/registrationStatus.util';

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

function visibleOrganizers(row: PlannerCompetition) {
  return row.organizers.filter((o) => o.name !== SOUTHEAST_CUBING_ORGANIZER_NAME);
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
    AddEditCompetitionSheetComponent,
    ViewCompetitionSheetComponent,
    UnannouncedCompetitionBannersComponent,
    WcaLinkCompetitionSheetComponent,
    CompetitionRefreshControlComponent,
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
  StateColors = StateColors;
  EventNames = EventNames;

  loading = signal(true);
  rows = signal<PlannerCompetition[]>([]);
  lastBulkRefreshAt = signal<string | null>(null);
  refreshingCompetitionIds = signal<Set<string>>(new Set());
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
  registrationPeriodColor = registrationPeriodColor;
  hasRegistrationPeriod = hasRegistrationPeriod;
  registrationStatusText = registrationStatusText;
  registrationStatusColor = registrationStatusColor;

  private dateCell = viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('dateCell');
  private nameCell = viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('nameCell');
  private locationCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('locationCell');
  private delegatesCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('delegatesCell');
  private organizersCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('organizersCell');
  private eventsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('eventsCell');
  private registrationsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('registrationsCell');
  private statusCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('statusCell');
  private registrationPeriodCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('registrationPeriodCell');
  private registrationStatusCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('registrationStatusCell');

  columns = computed<DataTableColumn<PlannerCompetition>[]>(() => [
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
      width: '130px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.start_date,
      searchValue: (row) => row.full_date ?? formatLongDateRange(row.start_date, row.end_date),
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

  defaultSort: DataTableSort = { columnKey: 'date', direction: 'asc' };

  trackById = (row: PlannerCompetition) => row.id;

  // The sheet being shown, if any - consumed by the View/Add-Edit Competition
  // sheets. null means no sheet is open.
  viewingCompetition = signal<PlannerCompetition | null>(null);
  editingCompetition = signal<PlannerCompetition | null>(null);
  linkingWcaCompetition = signal<PlannerCompetition | null>(null);
  activeSheet = signal<'add-edit' | 'view' | 'wca-link' | null>(null);
  isSheetClosing = signal(false);
  private unannouncedCompetitionBanners = viewChild(UnannouncedCompetitionBannersComponent);

  // True for Admin/Board/Regional Delegate, or a Delegate already assigned to
  // this specific competition.
  canEdit = (row: PlannerCompetition): boolean => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.roles.isAdmin || user.roles.isBoard || user.roles.isRegionalDelegate) return true;
    return row.delegates.some((delegate) => delegate.peopleId === user.peopleId);
  };

  // Refresh is public-data-only for announced rows; planning rows need Admin or assignment.
  canRefreshCompetition = (row: PlannerCompetition): boolean => {
    if (!row.wca_competition_id) return false;
    if (row.is_announced) return true;
    const user = this.authService.currentUser();
    return (
      !!user &&
      (user.roles.isAdmin || row.delegates.some((delegate) => delegate.peopleId === user.peopleId))
    );
  };

  rowActions = computed<DataTableActions<PlannerCompetition>>(() => ({
    overflow: [
      {
        icon: 'fa-eye',
        label: 'View',
        onClick: (row) => this.openViewCompetition(row),
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

  // Opens the standalone WCA-link sheet for an unlinked Planner row.
  openWcaLinkSheet(row: PlannerCompetition): void {
    this.linkingWcaCompetition.set(row);
    this.activeSheet.set('wca-link');
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

  deleteCompetition(row: PlannerCompetition): void {
    if (!confirm(`Permanently delete "${row.name}"? This can't be undone.`)) {
      return;
    }
    this.competitionPlannerApi.deleteCompetition(row.id).subscribe({
      next: () => {
        this.toastService.success('Competition deleted.');
        this.loadCompetitions();
      },
    });
  }

  // Refreshes a single competition.
  private refreshCompetition(row: PlannerCompetition): void {
    if (!this.canRefreshCompetition(row) || this.refreshingCompetitionIds().has(row.id)) return;
    this.refreshingCompetitionIds.update((ids) => new Set(ids).add(row.id));

    this.competitionPlannerApi.refreshCompetition(row.id).subscribe({
      next: () => {
        this.refreshingCompetitionIds.update((ids) => {
          const updated = new Set(ids);
          updated.delete(row.id);
          return updated;
        });
        this.toastService.success('Competition refreshed.');
        this.loadCompetitions();
      },
      error: (err) => {
        this.refreshingCompetitionIds.update((ids) => {
          const updated = new Set(ids);
          updated.delete(row.id);
          return updated;
        });
        this.errorBannerService.show(err?.error?.message ?? 'Failed to refresh competition.');
      },
    });
  }

  ngOnInit() {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/competition-planner');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);

    this.handleStepUpRedirectParams();
    this.loadCompetitions();
  }

  private loadCompetitions(): void {
    this.loading.set(true);
    this.competitionPlannerApi.getCompetitions().subscribe({
      next: (response) => {
        this.rows.set(response.competitions);
        this.lastBulkRefreshAt.set(response.meta.lastBulkRefreshAt);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onBulkRefreshCompleted(): void {
    this.loadCompetitions();
  }

  // Reloads the canonical Planner rows after the child completes a WCA link.
  onPlannerCompetitionLinked(): void {
    this.loadCompetitions();
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
