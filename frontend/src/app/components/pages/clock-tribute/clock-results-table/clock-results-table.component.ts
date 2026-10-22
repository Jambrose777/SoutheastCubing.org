import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { clockStatePillClass, formatClockAttempts } from '../clock-results.util';
import { ClockResultActionComponent } from '../clock-result-action/clock-result-action.component';
import { ClockVideoTableDirective } from '../clock-video-table.directive';
import { ClockVideoExpandedRowComponent } from '../clock-video-expanded-row/clock-video-expanded-row.component';

export interface ClockResultsTableColumn {
  key: string;
  label: string;
  width?: string;
}

export interface ClockResultsTableLink {
  text: string;
  href?: string;
}

export interface ClockResultsTableResult {
  resultId: string;
  competitionName: string;
  roundTypeId: string;
  resultType: 'single' | 'average';
  personName: string;
  attempts: number[];
  scrambles?: string[];
}

export interface ClockResultsTableCell {
  text: string;
  href?: string;
  videoUrl?: string;
  links?: ClockResultsTableLink[];
  imageUrl?: string;
  meta?: string;
  pill?: boolean;
  pillState?: string | null;
  textColor?: 'blue' | 'red' | 'gold' | 'silver' | 'bronze';
}

export interface ClockResultsTableRow {
  id: string;
  result?: Record<string, ClockResultsTableResult>;
  date?: ClockResultsTableCell;
  name?: ClockResultsTableCell;
  rank?: ClockResultsTableCell;
  podiumRank?: ClockResultsTableCell;
  record?: ClockResultsTableCell;
  place?: ClockResultsTableCell;
  sum?: ClockResultsTableCell;
  first?: ClockResultsTableCell;
  firstResult?: ClockResultsTableCell;
  second?: ClockResultsTableCell;
  secondResult?: ClockResultsTableCell;
  third?: ClockResultsTableCell;
  thirdResult?: ClockResultsTableCell;
  finalists?: ClockResultsTableCell;
  champion?: ClockResultsTableCell;
  winner?: ClockResultsTableCell;
  single?: ClockResultsTableCell;
  average?: ClockResultsTableCell;
  state?: ClockResultsTableCell;
  competition?: ClockResultsTableCell;
  video?: ClockResultsTableCell;
}

@Component({
  selector: 'se-clock-results-table',
  templateUrl: './clock-results-table.component.html',
  styleUrls: ['./clock-results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClockResultActionComponent,
    ClockVideoExpandedRowComponent,
    ClockVideoTableDirective,
    MatTooltipModule,
  ],
})
export class ClockResultsTableComponent {
  caption = input.required<string>();
  columns = input.required<ClockResultsTableColumn[]>();
  rows = input.required<ClockResultsTableRow[]>();
  verticalScroll = input(false);
  fixedLayout = input(false);
  scrambleSelected = output<ClockResultsTableResult>();
  readonly statePillClass = clockStatePillClass;
  readonly formatAttempts = formatClockAttempts;

  // Resolve metadata associated with a displayed result column.
  resultForCell(row: ClockResultsTableRow, key: string): ClockResultsTableResult | undefined {
    return row.result?.[key];
  }

  // Choose the first-place result for podium rows and the sole result elsewhere.
  scrambleResult(row: ClockResultsTableRow): ClockResultsTableResult | undefined {
    const result = row.result?.['firstResult'] ?? Object.values(row.result ?? {})[0];
    return result?.scrambles?.length ? result : undefined;
  }

  // Resolve a display cell from the row's direct column fields.
  cellFor(row: ClockResultsTableRow, key: string): ClockResultsTableCell {
    const value = row[key as keyof ClockResultsTableRow];
    if (value && typeof value === 'object' && 'text' in value) {
      return value as ClockResultsTableCell;
    }
    return { text: '' };
  }
}
