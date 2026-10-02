import { Component, ChangeDetectionStrategy, signal, input, output, computed } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableFilterOption } from '../data-table.types';

// Column-filter popover: a filter-icon trigger + searchable, multi-select
// checklist of one column's own distinct values.
@Component({
  selector: 'se-column-filter-dropdown',
  templateUrl: './column-filter-dropdown.component.html',
  styleUrls: ['./column-filter-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, MatTooltipModule],
})
export class ColumnFilterDropdownComponent {
  label = input.required<string>();
  // This column's full distinct-value list - computed from every loaded row.
  options = input.required<DataTableFilterOption[]>();
  // This column's currently selected value set.
  selected = input.required<Set<string>>();
  // Whether to show the in-dropdown search box.
  showSearch = input<boolean>(true);
  selectionChange = output<Set<string>>();

  isOpen = false;
  searchQuery = signal('');

  // Opens below the trigger by default, flipping above it if there's
  // nowhere else nearby.
  positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  // The in-dropdown search only narrows which *options* are shown
  // - it never changes the selection.
  visibleOptions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.options();
    return this.options().filter((option) => option.label.toLowerCase().includes(query));
  });

  // Whether the column is currently filtered.
  isFiltered = computed(() => this.selected().size < this.options().length);

  allVisibleSelected = computed(() => {
    const visible = this.visibleOptions();
    return visible.length > 0 && visible.every((option) => this.selected().has(option.value));
  });

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  onSearchInput(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  toggleOption(value: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    this.selectionChange.emit(next);
  }

  // Selects/deselects every currently-*visible* option.
  toggleSelectAllVisible() {
    const allSelected = this.allVisibleSelected();
    const next = new Set(this.selected());
    for (const option of this.visibleOptions()) {
      if (allSelected) {
        next.delete(option.value);
      } else {
        next.add(option.value);
      }
    }
    this.selectionChange.emit(next);
  }

  // Resets this column back to every value selected (no filtering).
  reset() {
    this.selectionChange.emit(new Set(this.options().map((option) => option.value)));
  }
}
