import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ClockMajorChampionship } from 'src/app/models/ClockResult';
import { formatLongDate } from 'src/app/shared/date.util';
import { clockStatePillClass, formatClockValue } from '../clock-results.util';
import { ClockVideoTableDirective } from '../clock-video-table.directive';

type ClockMajorChampionshipView = ClockMajorChampionship & {
  displayDate: string;
  logoUrl?: string;
};

@Component({
  selector: 'se-clock-major-results-table',
  templateUrl: './clock-major-results-table.component.html',
  styleUrls: ['./clock-major-results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockVideoTableDirective],
})
export class ClockMajorResultsTableComponent {
  competitions = input.required<ClockMajorChampionship[]>();
  logoUrlsByAssetId = input<Map<string, string>>(new Map());
  readonly statePillClass = clockStatePillClass;
  readonly formatClockValue = formatClockValue;

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
