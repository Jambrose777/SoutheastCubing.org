import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DataTableFilterPill } from '../data-table.types';

// Renders one removable pill per currently-active column filter, above the
// table - a plain, stateless list.
@Component({
  selector: 'se-filter-pills',
  templateUrl: './filter-pills.component.html',
  styleUrls: ['./filter-pills.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterPillsComponent {
  pills = input.required<DataTableFilterPill[]>();
  // Emits the removed pill's own column key.
  remove = output<string>();
}
