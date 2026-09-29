import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ManageDelegatesApiService } from 'src/app/services/southeastcubing-api/manage-delegates-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { formatDate } from 'src/app/shared/date.util';
import { RANK_LABELS } from 'src/app/models/Delegate';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { AddEditDelegateHistorySheetComponent } from './add-edit-delegate-history-sheet/add-edit-delegate-history-sheet.component';
import { SyncResultsSheetComponent } from './sync-results-sheet/sync-results-sheet.component';
import {
  DelegateSyncSummary,
  ManageDelegateHistoryEntry,
  ManageDelegatesResponse,
} from 'src/app/models/ManageDelegate';

type ViewMode = 'current' | 'history';
type ActiveSheet = 'delegateHistory' | 'syncResults' | null;

// Whether a sync summary has anything at all worth showing - an all-clear
// sync (nothing changed, no errors) just gets a plain success toast
// instead of opening the results sheet.
function hasSyncResults(summary: DelegateSyncSummary): boolean {
  return (
    summary.promoted.length > 0 ||
    summary.demoted.length > 0 ||
    summary.rankChanged.length > 0 ||
    summary.regionalOrSeniorChanged.length > 0 ||
    summary.stateChanged.length > 0 ||
    summary.errors.length > 0
  );
}

// Anything the Sheet component exposes the same shape of, for
// requestClose() to check regardless of which sheet is currently open.
interface DirtyCheckable {
  isDirty(): boolean;
}

const CLOSE_ANIMATION_MS = 200;

// One Delegate's own history rows, grouped for history mode's "Group by
// Delegate" view.
interface HistoryGroup {
  peopleId: string;
  name: string;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  competitionsDelegatedCount: number | null;
  rows: ManageDelegateHistoryEntry[];
}

// End Date sorts null (currently-open) first, then newest-ended.
function endDateSortValue(endDate: string | null): string {
  return endDate ?? '9999-12-31';
}

// Sorts history rows by End Date (open first, then newest-ended), then
// Start Date (newest first), then name - the ungrouped sort order, also
// used for rows within a group.
function sortHistoryRows(rows: ManageDelegateHistoryEntry[]): ManageDelegateHistoryEntry[] {
  return [...rows].sort(
    (a, b) =>
      endDateSortValue(b.endDate).localeCompare(endDateSortValue(a.endDate)) ||
      b.startDate.localeCompare(a.startDate) ||
      a.name.localeCompare(b.name),
  );
}

// Manage Delegates dashboard. Lists every Delegate's current standing
// (current mode) plus every rank/state history row, current and past
// (history mode). Regional Delegate/Admin get full edit access; Board is
// view + manual sync only.
@Component({
  selector: 'se-manage-delegates',
  templateUrl: './manage-delegates.component.html',
  styleUrls: ['./manage-delegates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    LoadingSpinnerComponent,
    AvatarComponent,
    MatTooltipModule,
    MatSlideToggleModule,
    AddEditDelegateHistorySheetComponent,
    SyncResultsSheetComponent,
  ],
})
export class ManageDelegatesComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private manageDelegatesApi = inject(ManageDelegatesApiService);
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;

  loading = signal(true);
  data = signal<ManageDelegatesResponse>({ current: [], history: [] });

  // 'current' (default) is the read-only single-row-per-Delegate view;
  // 'history' shows every rank/state stint, current and past.
  viewMode = signal<ViewMode>('current');

  // History mode's own "Group by Delegate" toggle - defaults on.
  groupByDelegate = signal(true);

  // Manual "Refresh" sync button's own state, mirroring
  // update-competitions' own button pattern.
  syncing = signal(false);

  activeSheet = signal<ActiveSheet>(null);
  sheetRow = signal<ManageDelegateHistoryEntry | null>(null);
  syncSummary = signal<DelegateSyncSummary | null>(null);
  // True for the duration of the slide-out exit animation after a sheet is
  // dismissed, so the template keeps it mounted.
  isSheetClosing = signal(false);

  isAdmin = computed(() => this.authService.currentUser()?.roles?.isAdmin ?? false);
  isRegionalDelegateOrAdmin = computed(() => {
    const roles = this.authService.currentUser()?.roles;
    return Boolean(roles?.isRegionalDelegate || roles?.isAdmin);
  });
  isRegionalDelegateOrAdminOrBoard = computed(() => {
    const roles = this.authService.currentUser()?.roles;
    return Boolean(roles?.isRegionalDelegate || roles?.isAdmin || roles?.isBoard);
  });

  // Current mode is already sorted by the backend.
  currentRows = computed(() => this.data().current);

  // History mode, ungrouped.
  ungroupedHistoryRows = computed(() => sortHistoryRows(this.data().history));

  // History mode, grouped by Delegate - same rows as above, just
  // clustered under each Delegate's own picture/name/comps-delegated cell.
  // Groups are sorted by that Delegate's own latest End Date (null first, then
  // newest), then their latest Start Date (newest first), then name; rows
  // within a group keep the same ordering as the ungrouped case.
  historyGroups = computed(() => {
    const byPeopleId = new Map<string, HistoryGroup>();
    for (const row of this.data().history) {
      let group = byPeopleId.get(row.peopleId);
      if (!group) {
        group = {
          peopleId: row.peopleId,
          name: row.name,
          pictureUrl: row.pictureUrl,
          thumbnailCropX: row.thumbnailCropX,
          thumbnailCropY: row.thumbnailCropY,
          thumbnailCropW: row.thumbnailCropW,
          thumbnailCropH: row.thumbnailCropH,
          competitionsDelegatedCount: row.competitionsDelegatedCount,
          rows: [],
        };
        byPeopleId.set(row.peopleId, group);
      }
      group.rows.push(row);
    }

    const groups = [...byPeopleId.values()].map((group) => ({
      ...group,
      rows: sortHistoryRows(group.rows),
    }));

    groups.sort(
      (a, b) =>
        endDateSortValue(b.rows[0].endDate).localeCompare(endDateSortValue(a.rows[0].endDate)) ||
        b.rows[0].startDate.localeCompare(a.rows[0].startDate) ||
        a.name.localeCompare(b.name),
    );
    return groups;
  });

  // Display label for a rank value (e.g. 'regional' -> 'Regional Delegate').
  rankLabel(rank: string): string {
    return RANK_LABELS[rank] ?? rank;
  }

  // The colored-pill background for a state history row's own value.
  stateColor(state: string): Colors {
    return StateColors[state] ?? Colors.grey;
  }

  // Formats a date column as MM-DD-YYYY.
  formatDate = formatDate;

  ngOnInit(): void {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/manage-delegates');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);
    this.loadDelegates();

    // TEMP mock - shows what a filled-in sync results sheet looks like.
    // Remove after viewing.
    this.syncSummary.set({
      promoted: [{ wcaId: '2015VERO02', rank: 'delegate', startDate: '2026-09-01' }],
      demoted: [{ wcaId: '2012SMIT05', from: 'junior' }],
      rankChanged: [{ wcaId: '2010AMBR01', from: 'trainee', to: 'junior' }],
      regionalOrSeniorChanged: [{ wcaId: '2011DWYE02', rank: 'senior', opened: true }],
      stateChanged: [{ wcaId: '2013HULL03', from: 'Georgia', to: 'North Carolina' }],
      errors: [
        "Delegate sync failed reconciling wca_id 2015VERO02: Cannot read properties of undefined (reading 'rank')",
        'Delegate sync failed reconciling wca_id 2010AMBR01: WCA API request timed out after 10000ms',
      ],
    });
    this.activeSheet.set('syncResults');
  }

  // Clicking either half of the toggle flips it.
  toggleViewMode() {
    this.viewMode.set(this.viewMode() === 'current' ? 'history' : 'current');
  }

  toggleGroupByDelegate(checked: boolean) {
    this.groupByDelegate.set(checked);
  }

  private loadDelegates() {
    this.loading.set(true);
    this.manageDelegatesApi.getDelegates().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openAddHistoryRow() {
    this.sheetRow.set(null);
    this.activeSheet.set('delegateHistory');
  }

  openEditHistoryRow(row: ManageDelegateHistoryEntry) {
    this.sheetRow.set(row);
    this.activeSheet.set('delegateHistory');
  }

  // Admin-only, irreversible - a simple one-click action with its own
  // confirmation prompt.
  deleteHistoryRow(row: ManageDelegateHistoryEntry) {
    if (
      !confirm(`Permanently delete ${row.name}'s ${row.type} history row? This can't be undone.`)
    ) {
      return;
    }
    const request =
      row.type === 'rank'
        ? this.manageDelegatesApi.hardDeleteRankRow(row.id)
        : this.manageDelegatesApi.hardDeleteStateRow(row.id);
    request.subscribe({
      next: () => {
        this.toastService.success('History row deleted.');
        this.loadDelegates();
      },
      error: (err) => {
        this.errorBannerService.show(err?.error?.message ?? 'Failed to delete history row.');
      },
    });
  }

  closeSheet() {
    this.isSheetClosing.set(true);
    setTimeout(() => {
      this.activeSheet.set(null);
      this.isSheetClosing.set(false);
    }, CLOSE_ANIMATION_MS);
  }

  // Only requests a close when the backdrop itself (not a click bubbling
  // up from the sheet panel inside it) was the actual click target.
  closeSheetIfBackdrop(event: MouseEvent, sheet: DirtyCheckable) {
    if (event.target === event.currentTarget) {
      this.requestClose(sheet);
    }
  }

  // Any way of dismissing a sheet routes through here.
  requestClose(sheet: DirtyCheckable) {
    if (sheet.isDirty() && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    this.closeSheet();
  }

  onSheetSaved() {
    this.closeSheet();
    this.loadDelegates();
  }

  // Manually triggers the same nightly WCA Delegate roster sync, on
  // demand. A summary with anything at all in it (changes or errors) opens
  // the results sheet; a genuine no-op sync just toasts.
  refresh() {
    this.syncing.set(true);
    this.manageDelegatesApi.syncDelegates().subscribe({
      next: (summary) => {
        this.syncing.set(false);
        if (hasSyncResults(summary)) {
          this.syncSummary.set(summary);
          this.activeSheet.set('syncResults');
        } else {
          this.toastService.success('Delegate roster synced with WCA. No changes.');
        }
        this.loadDelegates();
      },
      error: (err) => {
        this.syncing.set(false);
        this.errorBannerService.show(err?.error?.message ?? 'Failed to sync with WCA.');
      },
    });
  }
}
