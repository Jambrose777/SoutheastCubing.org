import { getVisibleWcaAnnouncementDeadlineCompetitions } from './competition-planner.util';
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  viewChild,
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
import { Colors, EventNames } from 'src/app/shared/types';
import { confirmDiscardIfDirty, type DirtyCheckable } from 'src/app/shared/dirty-check.util';
import { formatLongDateRange, formatWeekdayDateRange } from 'src/app/shared/date.util';
import {
  PlannerCompetition,
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
import { DataTableSort } from '../../../shared/data-table/data-table.component';
import { CompetitionPlannerTableComponent } from './competition-planner-table/competition-planner-table.component';
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
import { orderEventIdsByWcaOrder } from 'src/app/shared/event.util';
import {
  isNonSoutheastMajor,
  isSeciOrganizerConnected,
  isWaitingListStale,
  PLANNER_STATUS_LABELS,
  canRefreshPlannerCompetition,
  getCachedCompetitionsForView,
  getPotentialPlannerCompetitions,
  plannerLocationColor,
  canEditPlannerCompetition,
  hasMissingMultiCityData,
  registrationDisplay,
  registrationsText,
  seciOrganizerConnectedColor,
  showWaitingList,
  visibleEquipmentHolders,
  visibleOrganizers,
  waitingListTooltip,
} from './competition-planner-view-model.util';

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
    CompetitionPlannerTableComponent,
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
  EventNames = EventNames;

  loading = signal(true);
  view = signal<PlannerCompetitionView>('upcoming');
  sortResetVersion = signal(0);
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
  lastBulkRefreshAt = signal<string | null>(null);
  refreshingCompetitionIds = signal<Set<string>>(new Set());
  creatingDriveFolderIds = signal<Set<string>>(new Set());
  unlinkingCompetitionIds = signal<Set<string>>(new Set());
  deletingCompetitionIds = signal<Set<string>>(new Set());
  potentialRows = computed(() => getPotentialPlannerCompetitions(this.rows()));
  statusLabel = (row: PlannerCompetition) => PLANNER_STATUS_LABELS[row.status];
  registrationsText = registrationsText;
  showWaitingList = showWaitingList;
  waitingListTooltip = waitingListTooltip;
  isWaitingListStale = isWaitingListStale;
  visibleOrganizers = visibleOrganizers;
  isSeciOrganizerConnected = isSeciOrganizerConnected;
  seciOrganizerConnectedColor = seciOrganizerConnectedColor;
  visibleEquipmentHolders = visibleEquipmentHolders;
  locationColor = plannerLocationColor;
  registrationDisplay = registrationDisplay;
  isNonSoutheastMajor = isNonSoutheastMajor;

  // Hides generated date rows when the user sorts by a non-date column.
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

  hasMissingMultiCityData = hasMissingMultiCityData;

  // The sheet being shown, if any - consumed by the View/Add-Edit Competition
  // sheets. null means no sheet is open.
  viewingCompetition = signal<PlannerCompetition | null>(null);
  editingCompetition = signal<PlannerCompetition | null>(null);
  linkingWcaCompetition = signal<PlannerCompetition | null>(null);
  multiCityWcaCompetition = signal<PlannerWcaCompetitionOption | null>(null);
  activeSheet = signal<'add-edit' | 'view' | 'wca-link' | 'multi-city-create' | null>(null);
  isSheetClosing = signal(false);
  private unannouncedCompetitionBanners = viewChild(UnannouncedCompetitionBannersComponent);

  canEdit = (row: PlannerCompetition): boolean =>
    canEditPlannerCompetition(row, this.authService.currentUser());

  canRefreshCompetition = (row: PlannerCompetition): boolean =>
    canRefreshPlannerCompetition(row, this.authService.currentUser());

  canCreateMajor = computed(() => {
    const user = this.authService.currentUser();
    return !!user && (user.roles.isAdmin || user.roles.isBoard || user.roles.isRegionalDelegate);
  });

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

  // Unlinks an editable Planning row immediately, then reloads its Potential state.
  unlinkCompetitionFromWca(row: PlannerCompetition): void {
    if (
      !this.canEdit(row) ||
      row.status !== 'planning' ||
      this.unlinkingCompetitionIds().has(row.id)
    ) {
      return;
    }

    this.setCompetitionUnlinkPending(row.id, true);
    const pendingToast = this.toastService.pending('Unlinking competition from WCA…');
    this.competitionPlannerApi.unlinkWcaCompetition(row.id).subscribe({
      next: () => {
        pendingToast.dismiss();
        this.setCompetitionUnlinkPending(row.id, false);
        this.toastService.success('Competition unlinked from WCA.');
        this.loadCompetitions();
      },
      error: (error) => {
        pendingToast.dismiss();
        this.setCompetitionUnlinkPending(row.id, false);
        this.toastService.error(error?.error?.message ?? 'Failed to unlink competition from WCA.');
      },
    });
  }

  // Tracks pending unlink requests so repeated clicks cannot submit duplicates.
  private setCompetitionUnlinkPending(competitionId: string, pending: boolean): void {
    this.unlinkingCompetitionIds.update((current) => {
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

  requestCloseSheet(sheet: DirtyCheckable): void {
    if (!confirmDiscardIfDirty(sheet, 'You have unsaved changes. Discard them?')) {
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

  // Shares one in-flight guard across the row menu and deadline banner.
  deleteCompetition(row: PlannerCompetition): void {
    if (this.deletingCompetitionIds().has(row.id)) return;
    if (!confirm(`Permanently delete "${row.name}"? This can't be undone.`)) {
      return;
    }
    this.setCompetitionDeletePending(row.id, true);
    const pendingToast = this.toastService.pending('Deleting competition…');
    this.competitionPlannerApi.deleteCompetition(row.id).subscribe({
      next: () => {
        pendingToast.dismiss();
        this.setCompetitionDeletePending(row.id, false);
        this.toastService.success('Competition deleted.');
        this.loadCompetitions();
      },
      error: (err) => {
        pendingToast.dismiss();
        this.setCompetitionDeletePending(row.id, false);
        this.toastService.error(err?.error?.message ?? 'Failed to delete competition.');
      },
    });
  }

  private setCompetitionDeletePending(competitionId: string, pending: boolean): void {
    this.deletingCompetitionIds.update((ids) => {
      const updated = new Set(ids);
      if (pending) updated.add(competitionId);
      else updated.delete(competitionId);
      return updated;
    });
  }

  // Refreshes a single competition.
  refreshCompetition(row: PlannerCompetition): void {
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
        this.rows.set(
          getCachedCompetitionsForView(
            this.view(),
            this.upcomingCompetitions,
            this.pastCompetitions,
          ) ?? competitions,
        );
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

  // Loads the selected date scope without showing rows from the previous scope.
  setPlannerView(view: PlannerCompetitionView): void {
    if (view === this.view()) return;
    this.sortResetVersion.update((version) => version + 1);
    this.view.set(view);
    this.rows.set([]);
    const cachedCompetitions = getCachedCompetitionsForView(
      view,
      this.upcomingCompetitions,
      this.pastCompetitions,
    );
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
