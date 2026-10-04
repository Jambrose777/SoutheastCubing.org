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
import { Colors, StateColors } from 'src/app/shared/types';
import { formatDate, dateRangeText } from 'src/app/shared/date.util';
import { PlannerCompetition, PlannerCompetitionStatus } from 'src/app/models/PlannerCompetition';
import { environment } from 'src/environments/environment';
import * as moment from 'moment';
import { StripYearPipe } from 'src/app/pipes/stripYear.pipe';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { ManageCompetitionsPromptComponent } from '../../../shared/manage-competitions-prompt/manage-competitions-prompt.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { DataTableComponent, DataTableSort } from '../../../shared/data-table/data-table.component';
import { DataTableColumn } from '../../../shared/data-table/data-table.types';
import { DASHBOARD_TOOLS } from '../dashboard-tools';

// Display label for each derived Competition Planner status.
const STATUS_LABELS: Record<PlannerCompetitionStatus, string> = {
  potential: 'Potential',
  planning: 'Planning',
  announced: 'Announced',
};

// The # registrations/competitor limit column's own display text.
function registrationsText(row: PlannerCompetition): string {
  return `${row.accepted_registrations ?? 0} / ${row.competitor_limit}`;
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
  if (moment.utc(row.registration_open).isAfter(moment.now())) return Colors.blue;
  if (moment.utc(row.registration_close).isBefore(moment.now())) return Colors.red;
  return Colors.green;
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
  formatDate = formatDate;
  dateRangeText = dateRangeText;
  StateColors = StateColors;

  loading = signal(true);
  rows = signal<PlannerCompetition[]>([]);
  statusLabel = (row: PlannerCompetition) => STATUS_LABELS[row.status];
  registrationsText = registrationsText;
  visibleOrganizers = visibleOrganizers;
  registrationPeriodColor = registrationPeriodColor;

  private dateCell = viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('dateCell');
  private nameCell = viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('nameCell');
  private locationCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('locationCell');
  private delegatesCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('delegatesCell');
  private organizersCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('organizersCell');
  private registrationsCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('registrationsCell');
  private statusCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('statusCell');
  private registrationPeriodCell =
    viewChild.required<TemplateRef<{ $implicit: PlannerCompetition }>>('registrationPeriodCell');

  columns = computed<DataTableColumn<PlannerCompetition>[]>(() => [
    {
      key: 'date',
      label: 'Date(s)',
      width: '130px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.start_date,
      searchValue: (row) => dateRangeText(row.start_date, row.end_date),
      cellTemplate: this.dateCell(),
    },
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
      key: 'registrationPeriod',
      label: 'Registration Period',
      width: '132px',
      filterable: false,
      visibleByDefault: true,
      sortValue: (row) => row.registration_open,
      searchValue: (row) =>
        `${formatDate(row.registration_open)} -\n${formatDate(row.registration_close)}`,
      cellTemplate: this.registrationPeriodCell(),
    },
  ]);

  defaultSort: DataTableSort = { columnKey: 'date', direction: 'asc' };

  trackById = (row: PlannerCompetition) => row.id;

  ngOnInit() {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/competition-planner');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);

    this.handleStepUpRedirectParams();
    this.loadCompetitions();
  }

  private loadCompetitions(): void {
    this.loading.set(true);
    this.competitionPlannerApi.getCompetitions().subscribe({
      next: (competitions) => {
        this.rows.set(competitions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
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
