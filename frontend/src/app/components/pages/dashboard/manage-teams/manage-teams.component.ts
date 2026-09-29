import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ManageTeamsApiService } from 'src/app/services/southeastcubing-api/manage-teams-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { AddEditTeamSheetComponent } from './add-edit-team-sheet/add-edit-team-sheet.component';
import { AddEditMemberSheetComponent } from './add-edit-member-sheet/add-edit-member-sheet.component';
import { EditLeadershipSheetComponent } from './edit-leadership-sheet/edit-leadership-sheet.component';
import {
  ManageTeam,
  TeamLeaderStint,
  TeamMembership,
  TeamMemberColor,
} from 'src/app/models/ManageTeam';
import { formatDate } from 'src/app/shared/date.util';

type ActiveSheet = 'team' | 'member' | 'leadershipStint' | null;
type ViewMode = 'current' | 'history';

// Anything the Sheet component all expose the same shape of, for
// requestClose() to check regardless of which sheet is currently open.
interface DirtyCheckable {
  isDirty(): boolean;
}

const CLOSE_ANIMATION_MS = 200;

// True if two date ranges overlap at all - a null end_date (either side)
// means "still ongoing," so it overlaps anything from its start date
// onward.
function datesOverlap(
  a: { start_date: string; end_date: string | null },
  b: { start_date: string; end_date: string | null },
): boolean {
  const aEnd = a.end_date ?? '9999-12-31';
  const bEnd = b.end_date ?? '9999-12-31';
  return a.start_date <= bEnd && b.start_date <= aEnd;
}

// Manage Teams dashboard. Lists every team grouped into the canonical
// Admin -> Board -> Officers -> Board Liaisons -> ordinary (alphabetical) ->
// archived (newest first) order the backend already sorts into; every
// mutation re-fetches the full list rather than patching state locally, to
// stay simple and always reflect the server's derived fields.
@Component({
  selector: 'se-manage-teams',
  templateUrl: './manage-teams.component.html',
  styleUrls: ['./manage-teams.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    LoadingSpinnerComponent,
    AvatarComponent,
    MatMenuModule,
    MatTooltipModule,
    AddEditTeamSheetComponent,
    AddEditMemberSheetComponent,
    EditLeadershipSheetComponent,
  ],
})
export class ManageTeamsComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private manageTeamsApi = inject(ManageTeamsApiService);
  private toastService = inject(ToastService);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;

  loading = signal(true);
  teams = signal<ManageTeam[]>([]);
  isAdmin = computed(() => this.authService.currentUser()?.roles?.isAdmin ?? false);

  activeSheet = signal<ActiveSheet>(null);
  sheetTeam = signal<ManageTeam | null>(null);
  sheetMembership = signal<TeamMembership | null>(null);
  sheetLeadershipStints = signal<TeamLeaderStint[]>([]);
  // True for the duration of the slide-out exit animation after a sheet is
  // dismissed, so the template keeps it mounted.
  isSheetClosing = signal(false);

  // 'current' hides ended memberships and every past leadership stint;
  // 'history' shows every membership (active first, then ended) plus each
  // member's full leadership-stint history.
  viewMode = signal<ViewMode>('current');

  ngOnInit(): void {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/manage-teams');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);
    this.loadTeams();
  }

  // Clicking either half of the toggle flips it.
  toggleViewMode() {
    this.viewMode.set(this.viewMode() === 'current' ? 'history' : 'current');
  }

  // 'current' mode just drops Archived teams; they only ever show in
  // 'history' mode.
  visibleTeams = computed(() =>
    this.viewMode() === 'current' ? this.teams().filter((team) => !team.archivedAt) : this.teams(),
  );

  // team.members is already sorted active-first/ended-last by the backend -
  // 'current' mode just drops the ended ones rather than re-sorting.
  visibleMembers(team: ManageTeam): TeamMembership[] {
    return this.viewMode() === 'current'
      ? team.members.filter((member) => !member.end_date)
      : team.members;
  }

  // Every leadership stint that belongs to this particular membership
  // stint - same person AND date ranges overlap.
  stintsForMember(team: ManageTeam, member: TeamMembership): TeamLeaderStint[] {
    return team.leadershipHistory
      .filter((stint) => stint.people_id === member.people_id && datesOverlap(stint, member))
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  // In 'current' mode, an active leader's row should show when they became
  // Leader (their current, still-open stint), not their membership's own
  // start/end - 'history' mode always shows the membership's own dates,
  // since every stint is already broken out underneath it.
  memberDateRange(team: ManageTeam, member: TeamMembership): { start: string; end: string | null } {
    if (this.viewMode() === 'current' && member.is_active_leader) {
      const activeStint = team.leadershipHistory.find(
        (stint) =>
          stint.people_id === member.people_id && !stint.end_date && datesOverlap(stint, member),
      );
      if (activeStint) {
        return { start: activeStint.start_date, end: null };
      }
    }
    return { start: member.start_date, end: member.end_date };
  }

  // Formats a date column as MM/DD/YYYY
  formatDate = formatDate;

  // The color to display for a member's Leader/special-role badge (or the
  // plain swatch, if neither is present) - a Board member's officer color
  // (tied to their office) wins over their own Board row's color.
  displayColor(member: TeamMembership): TeamMemberColor | null {
    return member.officerColor ?? member.color;
  }

  // Loads the list of teams from the API and updates the component state.
  private loadTeams() {
    this.loading.set(true);
    this.manageTeamsApi.getTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openAddTeam() {
    this.sheetTeam.set(null);
    this.activeSheet.set('team');
  }

  openEditTeam(team: ManageTeam) {
    this.sheetTeam.set(team);
    this.activeSheet.set('team');
  }

  openAddMember(team?: ManageTeam) {
    this.sheetTeam.set(team ?? null);
    this.sheetMembership.set(null);
    this.activeSheet.set('member');
  }

  openEditMember(team: ManageTeam, membership: TeamMembership) {
    this.sheetTeam.set(team);
    this.sheetMembership.set(membership);
    this.activeSheet.set('member');
  }

  openEditLeadership(team: ManageTeam, member: TeamMembership) {
    this.sheetLeadershipStints.set(this.stintsForMember(team, member));
    this.activeSheet.set('leadershipStint');
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

  // Any way of dismissing a sheet (backdrop click, Escape, or its own
  // close/back button) routes through here.
  requestClose(sheet: DirtyCheckable) {
    if (sheet.isDirty() && !confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    this.closeSheet();
  }

  onSheetSaved() {
    this.closeSheet();
    this.loadTeams();
  }

  onLeadershipDeleted() {
    this.closeSheet();
    this.loadTeams();
  }

  archiveTeam(team: ManageTeam) {
    this.manageTeamsApi.archiveTeam(team.id).subscribe({
      next: () => {
        this.toastService.success('Team archived.');
        this.loadTeams();
      },
    });
  }

  unarchiveTeam(team: ManageTeam) {
    this.manageTeamsApi.unarchiveTeam(team.id).subscribe({
      next: () => {
        this.toastService.success('Team unarchived.');
        this.loadTeams();
      },
    });
  }

  hardDeleteTeam(team: ManageTeam) {
    if (!confirm(`Permanently delete "${team.name}" and its full history? This can't be undone.`)) {
      return;
    }
    this.manageTeamsApi.hardDeleteTeam(team.id).subscribe({
      next: () => {
        this.toastService.success('Team deleted.');
        this.loadTeams();
      },
    });
  }

  removeMember(membership: TeamMembership) {
    this.manageTeamsApi.removeMember(membership.id).subscribe({
      next: () => {
        this.toastService.success('Member removed.');
        this.loadTeams();
      },
    });
  }

  hardDeleteMembership(membership: TeamMembership) {
    if (!confirm(`Permanently delete ${membership.name}'s membership row? This can't be undone.`)) {
      return;
    }
    this.manageTeamsApi.hardDeleteMembership(membership.id).subscribe({
      next: () => {
        this.toastService.success('Membership deleted.');
        this.loadTeams();
      },
    });
  }

  setLeader(team: ManageTeam, membership: TeamMembership) {
    this.manageTeamsApi.setLeader(team.id, membership.people_id).subscribe({
      next: () => {
        this.toastService.success(`${membership.name} is now the Leader.`);
        this.loadTeams();
      },
    });
  }

  removeLeader(team: ManageTeam) {
    this.manageTeamsApi.removeLeader(team.id).subscribe({
      next: () => {
        this.toastService.success('Leader removed.');
        this.loadTeams();
      },
    });
  }
}
