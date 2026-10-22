import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ClockMajorChampionship } from 'src/app/models/ClockResult';
import { formatLongDate } from 'src/app/shared/date.util';
import { clockStatePillClass, formatClockAttempts, formatClockValue } from '../clock-results.util';
import { ClockResultActionComponent } from '../clock-result-action/clock-result-action.component';
import { ClockVideoTableDirective } from '../clock-video-table.directive';
import { ClockVideoExpandedRowComponent } from '../clock-video-expanded-row/clock-video-expanded-row.component';
import type { ClockResultsTableResult } from '../clock-results-table/clock-results-table.component';

type ClockMajorChampionshipView = ClockMajorChampionship & {
  displayDate: string;
  logoUrl?: string;
};

@Component({
  selector: 'se-clock-major-results-table',
  templateUrl: './clock-major-results-table.component.html',
  styleUrls: ['./clock-major-results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClockResultActionComponent,
    ClockVideoExpandedRowComponent,
    ClockVideoTableDirective,
    MatTooltipModule,
  ],
})
export class ClockMajorResultsTableComponent {
  competitions = input.required<ClockMajorChampionship[]>();
  logoUrlsByAssetId = input<Map<string, string>>(new Map());
  scrambleSelected = output<ClockResultsTableResult>();
  readonly statePillClass = clockStatePillClass;
  readonly formatAttempts = formatClockAttempts;
  readonly formatClockValue = formatClockValue;

  // Build the curated average metadata used by the major-results scramble control.
  scrambleResult(
    finalist: ClockMajorChampionship['finalists'][number],
    competitionName: string,
  ): ClockResultsTableResult | undefined {
    if (!finalist.resultId || !finalist.roundTypeId || !finalist.scrambles?.length)
      return undefined;

    return {
      resultId: finalist.resultId,
      competitionName,
      roundTypeId: finalist.roundTypeId,
      resultType: 'average',
      personName: finalist.personName,
      attempts: finalist.attempts,
      scrambles: finalist.scrambles,
    };
  }

  // Show only competitions with finalists, in chronological order.
  majorChampionshipResults = computed<ClockMajorChampionshipView[]>(() =>
    this.competitions()
      .filter((competition) => competition.finalists.length > 0)
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((competition) => ({
        ...competition,
        displayDate: formatLongDate(competition.date),
        logoUrl: competition.logoAssetId
          ? this.logoUrlsByAssetId().get(competition.logoAssetId)
          : undefined,
      })),
  );
}
