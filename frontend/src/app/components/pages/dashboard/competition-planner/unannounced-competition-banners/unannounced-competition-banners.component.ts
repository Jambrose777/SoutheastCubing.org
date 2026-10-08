import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import {
  PlannerCompetition,
  PlannerWcaCompetitionOption,
  PlannerWcaLinkRequest,
} from 'src/app/models/PlannerCompetition';
import { formatLongDate } from 'src/app/shared/date.util';

// Renders and manages the Competition Planner's WCA detection banners.
@Component({
  selector: 'se-unannounced-competition-banners',
  templateUrl: './unannounced-competition-banners.component.html',
  styleUrls: ['./unannounced-competition-banners.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSelectModule],
})
export class UnannouncedCompetitionBannersComponent implements OnInit {
  potentialRows = input.required<PlannerCompetition[]>();
  competitionLinked = output<{ createdCompetitionId?: string }>();
  multiCityCreateRequested = output<PlannerWcaCompetitionOption>();

  private authService = inject(AuthService);
  private errorBannerService = inject(ErrorBannerService);
  private toastService = inject(ToastService);
  private competitionPlannerApi = inject(CompetitionPlannerApiService);

  formatLongDate = formatLongDate;
  competitions = signal<PlannerWcaCompetitionOption[]>([]);
  linkLaterWcaIds = signal<Set<string>>(new Set());
  linkingWcaIds = signal<Set<string>>(new Set());
  closingWcaIds = signal<Set<string>>(new Set());
  private closeOutcomes = signal<Record<string, 'link-later' | 'remove'>>({});
  pendingActions = signal<Set<string>>(new Set());
  visibleCompetitions = computed(() =>
    this.competitions().filter(
      (competition) => !this.linkLaterWcaIds().has(competition.wca_competition_id),
    ),
  );

  ngOnInit(): void {
    this.loadCompetitions();
  }

  // Refreshes banner eligibility after a Planner row is linked to WCA.
  refresh(): void {
    this.loadCompetitions();
  }

  // Loads WCA competitions eligible for automatic Planner banners.
  private loadCompetitions(): void {
    this.competitionPlannerApi.getUnannouncedCompetitionBanners().subscribe({
      next: (competitions) => this.competitions.set(competitions),
      error: (error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.error?.code === 'MANAGE_COMPETITIONS_REAUTH_REQUIRED'
        ) {
          this.authService.refreshCurrentUser();
          return;
        }
        this.errorBannerService.show('Failed to check for unannounced competitions.');
      },
    });
  }

  // Opens an empty selection state so a Potential row is always chosen explicitly.
  beginPlannerCompetitionLink(competition: PlannerWcaCompetitionOption): void {
    this.linkingWcaIds.update((current) => new Set(current).add(competition.wca_competition_id));
  }

  isSelectingPlannerCompetition(competition: PlannerWcaCompetitionOption): boolean {
    return this.linkingWcaIds().has(competition.wca_competition_id);
  }

  // Closes the Potential-row selector without changing the banner.
  cancelPlannerCompetitionLink(competition: PlannerWcaCompetitionOption): void {
    this.linkingWcaIds.update((current) => {
      const next = new Set(current);
      next.delete(competition.wca_competition_id);
      return next;
    });
  }

  // Creates the linked Planner row without creating or linking a Drive folder.
  createPlannerCompetition(competition: PlannerWcaCompetitionOption): void {
    if (competition.is_multiple_cities_competition) {
      this.multiCityCreateRequested.emit(competition);
      return;
    }
    const request: PlannerWcaLinkRequest = {
      wcaCompetitionId: competition.wca_competition_id,
      createWcaDriveFolder: false,
    };
    this.submitLinkRequest(competition, request, true);
  }

  // Starts linking as soon as a Potential row is explicitly selected.
  selectPlannerCompetition(
    competition: PlannerWcaCompetitionOption,
    plannerCompetitionId: string,
  ): void {
    if (plannerCompetitionId) this.linkCompetition(competition, plannerCompetitionId);
  }

  // Hides the banner only for the current page visit.
  linkLater(competition: PlannerWcaCompetitionOption): void {
    this.closeBanner(competition.wca_competition_id, 'link-later');
  }

  // Persists the Delegate's permanent dismissal choice.
  neverLink(competition: PlannerWcaCompetitionOption): void {
    const wcaCompetitionId = competition.wca_competition_id;
    this.setPending(wcaCompetitionId, true);
    this.competitionPlannerApi.dismissUnannouncedCompetition(wcaCompetitionId).subscribe({
      next: () => {
        this.closeBanner(wcaCompetitionId, 'remove');
        this.toastService.success('Competition will no longer appear as a banner.');
      },
      error: () => {
        this.setPending(wcaCompetitionId, false);
        this.errorBannerService.show('Failed to dismiss the competition banner.');
      },
    });
  }

  // Links to the selected Potential row, or creates a new linked Planner row.
  linkCompetition(competition: PlannerWcaCompetitionOption, plannerCompetitionId?: string): void {
    const request: PlannerWcaLinkRequest = {
      wcaCompetitionId: competition.wca_competition_id,
      ...(plannerCompetitionId ? { plannerCompetitionId } : {}),
    };
    this.submitLinkRequest(competition, request);
  }

  private submitLinkRequest(
    competition: PlannerWcaCompetitionOption,
    request: PlannerWcaLinkRequest,
    openCreatedCompetition = false,
  ): void {
    const wcaCompetitionId = competition.wca_competition_id;
    this.setPending(wcaCompetitionId, true);

    this.competitionPlannerApi.linkWcaCompetition(request).subscribe({
      next: (createdCompetition) => {
        this.competitionLinked.emit(
          openCreatedCompetition ? { createdCompetitionId: createdCompetition.id } : {},
        );
        this.closeBanner(wcaCompetitionId, 'remove');
        this.toastService.success('Competition linked in Planner.');
      },
      error: () => {
        this.setPending(wcaCompetitionId, false);
        this.errorBannerService.show('Failed to link the competition.');
      },
    });
  }

  // Plays the exit animation before applying the selected dismissal outcome.
  private closeBanner(wcaCompetitionId: string, outcome: 'link-later' | 'remove'): void {
    this.closeOutcomes.update((current) => ({ ...current, [wcaCompetitionId]: outcome }));
    this.closingWcaIds.update((current) => new Set(current).add(wcaCompetitionId));
    this.setPending(wcaCompetitionId, true);
  }

  // Applies the dismissal after the banner's exit animation completes.
  onBannerAnimationEnd(event: AnimationEvent, competition: PlannerWcaCompetitionOption): void {
    if (event.target !== event.currentTarget || event.animationName !== 'banner-exit') return;

    const wcaCompetitionId = competition.wca_competition_id;
    const outcome = this.closeOutcomes()[wcaCompetitionId];
    if (!outcome) return;

    if (outcome === 'link-later') {
      this.linkLaterWcaIds.update((current) => new Set(current).add(wcaCompetitionId));
    } else {
      this.competitions.update((competitions) =>
        competitions.filter((item) => item.wca_competition_id !== wcaCompetitionId),
      );
    }

    this.linkingWcaIds.update((current) => {
      const next = new Set(current);
      next.delete(wcaCompetitionId);
      return next;
    });
    this.closingWcaIds.update((current) => {
      const next = new Set(current);
      next.delete(wcaCompetitionId);
      return next;
    });
    this.closeOutcomes.update((current) => {
      const next = { ...current };
      delete next[wcaCompetitionId];
      return next;
    });
    this.setPending(wcaCompetitionId, false);
  }

  // Tracks requests per banner so one action cannot be submitted repeatedly.
  private setPending(wcaCompetitionId: string, pending: boolean): void {
    this.pendingActions.update((current) => {
      const next = new Set(current);
      if (pending) next.add(wcaCompetitionId);
      else next.delete(wcaCompetitionId);
      return next;
    });
  }
}
