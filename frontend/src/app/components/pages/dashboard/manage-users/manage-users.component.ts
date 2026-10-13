import {
  Component,
  ChangeDetectionStrategy,
  inject,
  DestroyRef,
  OnInit,
  viewChild,
  TemplateRef,
  computed,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { ManageUsersApiService } from 'src/app/services/southeastcubing-api/manage-users-api.service';
import { Colors } from 'src/app/shared/types';
import { formatLongDate, formatLongDateTime } from 'src/app/shared/date.util';
import { ManageUser } from 'src/app/models/ManageUser';
import { RANK_LABELS } from 'src/app/models/Delegate';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { DataTableComponent, DataTableSort } from '../../../shared/data-table/data-table.component';
import { DataTableActions, DataTableColumn } from '../../../shared/data-table/data-table.types';
import { EditUserSheetComponent } from './edit-user-sheet/edit-user-sheet.component';

const CLOSE_ANIMATION_MS = 200;

// A row's own Delegate filter bucket - current (has an open rank), past
// (has delegate history but no open rank - "Former Delegate"), or none
// (never tracked as a Delegate at all).
type DelegateFilterBucket = 'current' | 'past' | 'none';

function delegateFilterBucket(row: ManageUser): DelegateFilterBucket {
  if (!row.hasDelegateHistory) return 'none';
  return row.delegateRank ? 'current' : 'past';
}

// The Delegate column's own display text - the single highest rank's label
// plus state (e.g. "Regional Delegate - Southeast"), "Former Delegate" for
// someone with Delegate history but no currently-open rank, or '--' for
// someone who's never been a Delegate at all.
function delegateCellText(row: ManageUser): string {
  if (!row.hasDelegateHistory) return '--';
  if (!row.delegateRank) return 'Former Delegate';
  const rankLabel = RANK_LABELS[row.delegateRank] ?? row.delegateRank;
  return row.delegateState ? `${rankLabel}\n${row.delegateState}` : rankLabel;
}

// The Team column's own display text - the first team's name, plus a
// "+ x more" suffix once a person belongs to more than one.
function teamCellText(row: ManageUser): string {
  if (row.teams.length === 0) return '--';
  const [first, ...rest] = row.teams;
  return rest.length > 0 ? `${first.teamName} + ${rest.length} more...` : first.teamName;
}

// Manage Users dashboard.
@Component({
  selector: 'se-manage-users',
  templateUrl: './manage-users.component.html',
  styleUrls: ['./manage-users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    AvatarComponent,
    LoadingSpinnerComponent,
    DataTableComponent,
    MatTooltipModule,
    EditUserSheetComponent,
  ],
})
export class ManageUsersComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private manageUsersApi = inject(ManageUsersApiService);
  private location = inject(Location);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isMobile = this.screenSizeService.isMobile;

  loading = signal(true);
  rows = signal<ManageUser[]>([]);
  formatLongDate = formatLongDate;
  formatLongDateTime = formatLongDateTime;
  delegateCellText = delegateCellText;
  teamCellText = teamCellText;
  missingDiscordIdsOverrideActive = signal(false);
  missingDiscordIdQuickFilter = {
    label: 'Delegates missing Discord IDs',
    predicate: (row: ManageUser) => row.needsDiscordUserId,
  };

  private pictureCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('pictureCell');
  private nameCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('nameCell');
  private wcaIdCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('wcaIdCell');
  private discordUserIdCell =
    viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('discordUserIdCell');
  private delegateCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('delegateCell');
  private teamCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('teamCell');
  private updatedAtCell =
    viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('updatedAtCell');
  private seciIdCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('seciIdCell');
  private emailCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('emailCell');
  private dobCell = viewChild.required<TemplateRef<{ $implicit: ManageUser }>>('dobCell');

  columns = computed<DataTableColumn<ManageUser>[]>(() => [
    {
      key: 'picture',
      label: 'Picture',
      showLabelInHeader: false,
      width: '48px',
      filterable: false,
      visibleByDefault: true,
      cellTemplate: this.pictureCell(),
    },
    {
      key: 'name',
      label: 'Name',
      width: '1fr',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.name,
      searchValue: (row) => row.name,
      cellTemplate: this.nameCell(),
    },
    {
      key: 'wcaId',
      label: 'WCA ID',
      width: '135px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.wcaId ?? row.wcaUserId ?? '',
      searchValue: (row) => row.wcaId ?? row.wcaUserId ?? '',
      cellTemplate: this.wcaIdCell(),
    },
    {
      key: 'seciId',
      label: 'SECI ID',
      width: '210px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.seciId,
      searchValue: (row) => row.seciId,
      cellTemplate: this.seciIdCell(),
    },
    {
      key: 'discordUserId',
      label: 'Discord User ID',
      width: '210px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.discordUserId ?? '',
      searchValue: (row) => row.discordUserId ?? '',
      cellTemplate: this.discordUserIdCell(),
    },
    {
      key: 'email',
      label: 'Email',
      width: '220px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.email ?? '',
      searchValue: (row) => row.email ?? '',
      cellTemplate: this.emailCell(),
    },
    {
      key: 'dob',
      label: 'DOB',
      width: '120px',
      filterable: false,
      visibleByDefault: false,
      sortValue: (row) => row.dob ?? '',
      searchValue: (row) => (row.dob ? formatLongDate(row.dob) : ''),
      cellTemplate: this.dobCell(),
    },
    {
      key: 'delegate',
      label: 'Delegate',
      width: '175px',
      filterable: true,
      filterType: 'custom-multiselect',
      filterOptions: [
        { value: 'current', label: 'Current' },
        { value: 'past', label: 'Past' },
        { value: 'none', label: 'Not a Delegate' },
      ],
      filterValue: (row) => [delegateFilterBucket(row)],
      visibleByDefault: true,
      sortValue: (row) => delegateCellText(row),
      searchValue: (row) => delegateCellText(row),
      cellTemplate: this.delegateCell(),
    },
    {
      key: 'team',
      label: 'Team',
      width: '240px',
      filterable: true,
      filterType: 'multiselect',
      filterValue: (row) => row.teams.map((team) => team.teamName),
      visibleByDefault: true,
      sortValue: (row) => teamCellText(row),
      searchValue: (row) => teamCellText(row),
      cellTemplate: this.teamCell(),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      width: '200px',
      filterable: false,
      visibleByDefault: true,
      // Sorts by the raw timestamp while searches match the displayed UTC date/time.
      sortValue: (row) => row.updatedAt ?? '',
      searchValue: (row) => (row.updatedAt ? formatLongDateTime(row.updatedAt) : ''),
      cellTemplate: this.updatedAtCell(),
    },
  ]);

  defaultSort: DataTableSort = { columnKey: 'updatedAt', direction: 'desc' };

  actions: DataTableActions<ManageUser> = {
    inline: [{ icon: 'fa-pen', label: 'Edit', onClick: (row) => this.openEditSheet(row) }],
  };

  trackByPeopleId = (row: ManageUser) => row.peopleId;

  editSheetOpen = signal(false);
  selectedUser = signal<ManageUser | null>(null);
  // True for the duration of the slide-out exit animation, so the template
  // keeps the sheet mounted long enough for it to actually play.
  isSheetClosing = signal(false);

  ngOnInit(): void {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/manage-users');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.handleNotificationRouteParam();
    });
    this.loadUsers();
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.manageUsersApi.getUsers().subscribe({
      next: (users) => {
        this.rows.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // Activates the missing-ID override as soon as its navigation parameter arrives.
  private handleNotificationRouteParam(): void {
    if (this.route.snapshot.queryParamMap.get('showMissingDiscordIds') !== 'true') {
      return;
    }

    this.missingDiscordIdsOverrideActive.set(true);
    this.clearNotificationRouteParam();
  }

  // Removes the one-time parameter only after the router finishes applying it.
  private clearNotificationRouteParam(): void {
    if (this.route.snapshot.queryParamMap.get('showMissingDiscordIds') !== 'true') {
      return;
    }

    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { showMissingDiscordIds: null },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(url));
  }

  // Opens the edit sheet for this row.
  openEditSheet(row: ManageUser) {
    this.selectedUser.set(row);
    this.editSheetOpen.set(true);
  }

  private closeSheet() {
    this.isSheetClosing.set(true);
    setTimeout(() => {
      this.editSheetOpen.set(false);
      this.isSheetClosing.set(false);
      this.selectedUser.set(null);
    }, CLOSE_ANIMATION_MS);
  }

  // Only requests a close when the backdrop itself (not a click bubbling up
  // from the sheet panel inside it) was the actual click target.
  closeSheetIfBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.requestCloseSheet();
    }
  }

  // No confirmation needed - the edit sheet can always be closed immediately.
  requestCloseSheet() {
    this.closeSheet();
  }

  // A mutation inside the sheet resolved - refetch so both the table row behind
  // it and the sheet's own displayed fields reflect the new server state, without
  // closing the sheet itself.
  onUserSaved() {
    this.manageUsersApi.getUsers().subscribe({
      next: (users) => {
        this.rows.set(users);
        const updated = users.find((u) => u.peopleId === this.selectedUser()?.peopleId);
        if (updated) this.selectedUser.set(updated);
      },
    });
  }
}
