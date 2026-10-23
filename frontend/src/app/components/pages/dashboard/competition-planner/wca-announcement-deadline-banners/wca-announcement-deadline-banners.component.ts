import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PlannerCompetition } from 'src/app/models/PlannerCompetition';
import { formatLongDate } from 'src/app/shared/date.util';

// Renders WCA announcement deadline warnings for eligible Planner competitions.
@Component({
  selector: 'se-wca-announcement-deadline-banners',
  templateUrl: './wca-announcement-deadline-banners.component.html',
  styleUrls: ['./wca-announcement-deadline-banners.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WcaAnnouncementDeadlineBannersComponent {
  competitions = input.required<PlannerCompetition[]>();
  deletingCompetitionIds = input<ReadonlySet<string>>(new Set());
  deleteRequested = output<PlannerCompetition>();

  private dismissedCompetitionIds = signal<Set<string>>(new Set());
  visibleCompetitions = computed(() =>
    this.competitions().filter(
      (competition) => !this.dismissedCompetitionIds().has(competition.id),
    ),
  );
  formatLongDate = formatLongDate;

  // Hides this warning for the current Planner page visit only.
  dismiss(competition: PlannerCompetition): void {
    this.dismissedCompetitionIds.update((ids) => new Set(ids).add(competition.id));
  }
}
