import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DelegateSyncSummary } from 'src/app/models/ManageDelegate';
import { RANK_LABELS } from 'src/app/models/Delegate';
import { formatDate } from 'src/app/shared/date.util';

// Read-only slide-in sheet showing what a WCA sync run actually changed.
@Component({
  selector: 'se-sync-results-sheet',
  templateUrl: './sync-results-sheet.component.html',
  styleUrls: ['./sync-results-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncResultsSheetComponent {
  summary = input.required<DelegateSyncSummary>();
  closed = output<void>();

  formatDate = formatDate;

  // Display label for a rank value (e.g. 'regional' -> 'Regional Delegate').
  rankLabel(rank: string): string {
    return RANK_LABELS[rank] ?? rank;
  }

  // Nothing here is editable, so there's never anything to lose by closing.
  isDirty(): boolean {
    return false;
  }

  close() {
    this.closed.emit();
  }
}
