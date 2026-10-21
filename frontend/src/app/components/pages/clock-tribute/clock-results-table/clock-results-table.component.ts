import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { clockStatePillClass } from '../clock-results.util';
import { ClockVideoTableDirective } from '../clock-video-table.directive';

export interface ClockResultsTableColumn {
  key: string;
  label: string;
  width?: string;
}

export interface ClockResultsTableLink {
  text: string;
  href?: string;
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
  cells: Record<string, ClockResultsTableCell>;
}

@Component({
  selector: 'se-clock-results-table',
  templateUrl: './clock-results-table.component.html',
  styleUrls: ['./clock-results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClockVideoTableDirective],
})
export class ClockResultsTableComponent {
  caption = input.required<string>();
  columns = input.required<ClockResultsTableColumn[]>();
  rows = input.required<ClockResultsTableRow[]>();
  verticalScroll = input(false);
  fixedLayout = input(false);
  readonly statePillClass = clockStatePillClass;
}
