import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { clockScrambleLabel } from '../clock-results.util';
import type { ClockResultsTableResult } from '../clock-results-table/clock-results-table.component';

type ClockResultActionMode = 'video' | 'scramble';

@Component({
  selector: 'se-clock-result-action',
  templateUrl: './clock-result-action.component.html',
  styleUrl: './clock-result-action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltipModule],
})
export class ClockResultActionComponent {
  mode = input.required<ClockResultActionMode>();
  rowId = input.required<string>();
  videoUrl = input<string | null>(null);
  videoExpanded = input(false);
  scrambleResult = input<ClockResultsTableResult | null>(null);
  videoToggled = output<{ rowId: string; videoUrl: string }>();
  scrambleSelected = output<ClockResultsTableResult>();
  readonly scrambleLabel = clockScrambleLabel;
}
