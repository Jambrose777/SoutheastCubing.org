import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  computed,
  effect,
  output,
  model,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from 'src/app/services/toast.service';
import {
  DataTableActions,
  DataTableColumn,
  DataTableColumnMeta,
  DataTableFilterOption,
  DataTableFilterPill,
  DataTableSort,
} from './data-table.types';
export type { DataTableSort, DataTableSortDirection } from './data-table.types';
import { ColumnVisibilityDropdownComponent } from './column-visibility-dropdown/column-visibility-dropdown.component';
import { ColumnFilterDropdownComponent } from './column-filter-dropdown/column-filter-dropdown.component';
import { FilterPillsComponent } from './filter-pills/filter-pills.component';
import { TruncationTooltipDirective } from './truncation-tooltip.directive';
import {
  getDefaultDataTableLayout,
  loadDataTableState,
  restoreDataTableState,
  saveDataTableState,
} from './data-table-state.util';

// Every row's fixed rendered height (px) - sized to fit up to 2 wrapped
// lines of cell content.
export const DATA_TABLE_ROW_HEIGHT_PX = 56;

// Fallback width (px) used for a column whose own `width` isn't a plain
// pixel value (e.g. '1fr') when computing a row's own `min-width` - keeps a
// flexible column from collapsing to an unreadably narrow width.
const DEFAULT_FLEX_COLUMN_MIN_WIDTH_PX = 160;

// Width (px) assigned to each Actions column button.
const ACTION_BUTTON_WIDTH_PX = 36;
// Gap (px) between adjacent action buttons.
const ACTION_BUTTON_GAP_PX = 4;
// Horizontal padding (px) around the actions cell's own row of buttons.
const ACTIONS_CELL_PADDING_PX = 24;

// Reserved column key for the Actions column's own entry in the
// column-visibility dropdown - never a real consumer-supplied column key.
const ACTIONS_COLUMN_KEY = '__actions__';

// Generic, reusable data table: virtualized rows plus configurable column
// visibility, sort, search, per-column filters & actions column.
// Hand-rolled as a CSS-grid table - this table's columns are fully dynamic at
// runtime (visibility toggles, consumer-supplied config).
@Component({
  selector: 'se-data-table',
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ScrollingModule,
    MatMenuModule,
    MatTooltipModule,
    ColumnVisibilityDropdownComponent,
    ColumnFilterDropdownComponent,
    FilterPillsComponent,
    TruncationTooltipDirective,
  ],
})
export class DataTableComponent<T> {
  private toastService = inject(ToastService);

  rows = input.required<T[]>();
  columns = input.required<DataTableColumn<T>[]>();
  // Returns a stable identity for a row - e.g. `(row) => row.peopleId`.
  trackBy = input.required<(row: T) => unknown>();

  // Per-feature show/hide toggles - each defaults to shown, letting a
  // consumer that doesn't want a given feature hide it outright.
  showColumnsButton = input<boolean>(true);
  showFilterPills = input<boolean>(true);

  // When active, this filters all rows and temporarily bypasses search and column filters.
  quickFilterOverride = input<{
    label: string;
    predicate: (row: T) => boolean;
  } | null>(null);
  quickFilterActive = model(false);

  // The Actions column config.
  actions = input<DataTableActions<T> | null>(null);

  // Optional column that stays at the left edge and cannot be hidden or reordered.
  stickyStartColumnKey = input<string | null>(null);

  // The sort applied before the user ever interacts with the table.
  defaultSort = input<DataTableSort | null>(null);

  // Persists/restores this table's own filters, sort, column visibility,
  // and column order to `localStorage` under this exact key, keyed per
  // table. No persistence at all when left `null`, and the Save button is hidden.
  storageKey = input<string | null>(null);

  // Consumer-owned state saved alongside this table's own preferences.
  consumerState = input<Record<string, unknown>>({});
  consumerStateRestored = output<Record<string, unknown>>();

  rowHeight = DATA_TABLE_ROW_HEIGHT_PX;

  // The header row's own horizontal offset (px) - mirrors the viewport's
  // native `scrollLeft`, since the viewport is the table's only real horizontal
  // scroll container and the header (outside it, so it can stay a plain
  // non-virtualized row) has none of its own.
  headerScrollLeft = signal(0);

  // The global search box's own current term.
  searchTerm = signal('');

  // The currently active sort, if any - `null` means "no sort applied".
  sort = signal<DataTableSort | null>(null);
  sortChange = output<DataTableSort>();
  tableReset = output<void>();

  // Each filterable column's own currently-selected value set, by column
  // key - absent entry means "untouched, nothing excluded yet".
  columnFilters = signal<Map<string, Set<string>>>(new Map());

  // Which column keys are currently shown.
  visibleColumnKeys = signal<Set<string>>(new Set());

  // Whether the Actions column itself is currently shown.
  actionsColumnVisible = signal(true);

  // Every column's current display order (by key).
  columnOrder = signal<string[]>([]);
  private hasRestoredConsumerState = false;

  constructor() {
    // Seeds default column visibility/order from `columns()`, then applies
    // any saved state on top of those defaults.
    effect(() => {
      const cols = this.columns();
      const stickyStartColumnKey = this.stickyStartColumnKey();
      const saved = loadDataTableState(this.storageKey());
      if (!saved) {
        const defaults = getDefaultDataTableLayout(cols, stickyStartColumnKey);
        this.visibleColumnKeys.set(defaults.visibleColumnKeys);
        this.columnOrder.set(defaults.columnOrder);
        this.hasRestoredConsumerState = true;
        return;
      }

      const restored = restoreDataTableState(saved, cols, stickyStartColumnKey);
      this.columnOrder.set(restored.columnOrder);
      this.visibleColumnKeys.set(restored.visibleColumnKeys);
      this.columnFilters.set(restored.columnFilters);
      this.actionsColumnVisible.set(restored.actionsColumnVisible);
      if (restored.sort) this.sort.set(restored.sort);
      if (!this.hasRestoredConsumerState) {
        this.hasRestoredConsumerState = true;
        if (restored.consumerState) this.consumerStateRestored.emit(restored.consumerState);
      }
    });

    // Applies `defaultSort` exactly once, the first time it's available.
    effect(() => {
      const def = this.defaultSort();
      if (def && this.sort() === null) {
        this.sort.set(def);
      }
    });
  }

  // Saves this table's current filters, sort, column visibility, and
  // column order to `localStorage` - deliberately not the search term.
  saveToLocalStorage() {
    const key = this.storageKey();
    if (!key) return;
    saveDataTableState(key, {
      sort: this.sort(),
      visibleColumnKeys: this.visibleColumnKeys(),
      columnOrder: this.columnOrder(),
      columnFilters: this.columnFilters(),
      actionsColumnVisible: this.actionsColumnVisible(),
      consumerState: this.consumerState(),
    });
    this.toastService.success('Table view saved.');
  }

  private columnsByKey = computed(
    () => new Map(this.columns().map((column) => [column.key, column])),
  );

  stickyStartColumn = computed(() => {
    const key = this.stickyStartColumnKey();
    return key ? (this.columnsByKey().get(key) ?? null) : null;
  });

  // Every column (visible or not), in its current display order.
  orderedColumns = computed(() => {
    const byKey = this.columnsByKey();
    return this.columnOrder()
      .map((key) => byKey.get(key))
      .filter((column): column is DataTableColumn<T> => !!column);
  });

  // The column-visibility dropdown keeps the sticky-start column outside the
  // reorderable list.
  reorderableColumns = computed(() =>
    this.orderedColumns().filter((column) => column.key !== this.stickyStartColumnKey()),
  );

  pinnedStartColumnMeta = computed<DataTableColumnMeta[]>(() => {
    const key = this.stickyStartColumnKey();
    const column = key ? this.columnsByKey().get(key) : undefined;
    return column ? [{ key: column.key, label: column.label }] : [];
  });

  // Which columns are currently shown, in their current order.
  visibleColumns = computed(() => {
    const keys = this.visibleColumnKeys();
    const stickyStartColumnKey = this.stickyStartColumnKey();
    return this.orderedColumns().filter(
      (column) => keys.has(column.key) || column.key === stickyStartColumnKey,
    );
  });

  // The Actions column's own pinned entry for the column-visibility
  // dropdown.
  actionsColumnMeta = computed<DataTableColumnMeta[]>(() =>
    this.actions() ? [{ key: ACTIONS_COLUMN_KEY, label: 'Actions' }] : [],
  );

  // The dropdown's own combined visible-keys set - regular column keys plus
  // the reserved Actions key, so one checklist covers both.
  dropdownVisibleKeys = computed(() => {
    const keys = new Set(this.visibleColumnKeys());
    const stickyStartColumnKey = this.stickyStartColumnKey();
    if (stickyStartColumnKey) keys.add(stickyStartColumnKey);
    if (this.actionsColumnVisible()) keys.add(ACTIONS_COLUMN_KEY);
    return keys;
  });

  // The Actions column's own width (px) - 0 when `actions` isn't configured
  // or the Actions column has been hidden via the dropdown.
  actionsColumnWidth = computed(() => {
    const actions = this.actions();
    if (!actions || !this.actionsColumnVisible()) return 0;
    const buttonCount = (actions.inline?.length ?? 0) + (actions.overflow?.length ? 1 : 0);
    if (buttonCount === 0) return 0;
    return (
      buttonCount * ACTION_BUTTON_WIDTH_PX +
      (buttonCount - 1) * ACTION_BUTTON_GAP_PX +
      ACTIONS_CELL_PADDING_PX
    );
  });

  // Widths of each column in a single string.
  gridTemplateColumns = computed(() => {
    const widths = this.visibleColumns().map((column) => column.width);
    const actionsWidth = this.actionsColumnWidth();
    if (actionsWidth > 0) widths.push(`${actionsWidth}px`);
    return widths.join(' ');
  });

  // The header row's own grid - deliberately excludes the Actions column.
  scrollableGridTemplateColumns = computed(() =>
    this.visibleColumns()
      .map((column) => column.width)
      .join(' '),
  );

  // The row's own natural min-width (px) - used by body rows (includes the
  // Actions column's own width).
  rowMinWidth = computed(() => this.sumVisibleColumnWidths() + this.actionsColumnWidth());

  // The header row's own min-width - excludes the Actions column..
  scrollableRowMinWidth = computed(() => this.sumVisibleColumnWidths());

  // Sums each visible column's own `width`, parsed as a plain pixel value
  // (or DEFAULT_FLEX_COLUMN_MIN_WIDTH_PX for a flexible one like '1fr').
  private sumVisibleColumnWidths(): number {
    return this.visibleColumns()
      .map((column) => {
        const pxMatch = /^(\d+)px$/.exec(column.width.trim());
        return pxMatch ? Number(pxMatch[1]) : DEFAULT_FLEX_COLUMN_MIN_WIDTH_PX;
      })
      .reduce((total, width) => total + width, 0);
  }

  // Every filterable column's own distinct option list, keyed by column key
  // - 'multiselect' derives its options from every loaded row's own
  // `filterValue`; 'custom-multiselect' just uses its own fixed `filterOptions`.
  columnFilterOptions = computed(() => {
    const map = new Map<string, DataTableFilterOption[]>();
    for (const column of this.columns()) {
      if (!column.filterable) continue;
      if (column.filterType === 'custom-multiselect') {
        map.set(column.key, column.filterOptions ?? []);
      } else if (column.filterValue) {
        const values = new Set<string>();
        for (const row of this.rows()) {
          for (const value of column.filterValue(row)) values.add(value);
        }
        map.set(
          column.key,
          [...values].sort().map((value) => ({ value, label: value })),
        );
      }
    }
    return map;
  });

  // This column's currently-selected filter values - every one of its own
  // options when it hasn't been touched yet.
  selectedFilterValues(columnKey: string): Set<string> {
    const existing = this.columnFilters().get(columnKey);
    if (existing) return existing;
    const options = this.columnFilterOptions().get(columnKey) ?? [];
    return new Set(options.map((option) => option.value));
  }

  onColumnFilterChange(columnKey: string, selected: Set<string>) {
    const next = new Map(this.columnFilters());
    next.set(columnKey, selected);
    this.columnFilters.set(next);
  }

  // One pill per column that's actually restricting rows right now.
  activeFilterPills = computed<DataTableFilterPill[]>(() => {
    const filters = this.columnFilters();
    const optionsByKey = this.columnFilterOptions();
    const pills: DataTableFilterPill[] = [];
    for (const column of this.columns()) {
      if (!column.filterable) continue;
      const selected = filters.get(column.key);
      const options = optionsByKey.get(column.key) ?? [];
      if (!selected || selected.size >= options.length) continue;

      const selectedLabels = options
        .filter((option) => selected.has(option.value))
        .map((o) => o.label);
      const summary =
        selectedLabels.length <= 2
          ? selectedLabels.join(', ')
          : `${selectedLabels.length} selected`;
      pills.push({ columnKey: column.key, label: column.label, summary });
    }
    return pills;
  });

  // Removes a single column's filter.
  removeColumnFilter(columnKey: string) {
    const next = new Map(this.columnFilters());
    next.delete(columnKey);
    this.columnFilters.set(next);
  }

  // Restores every filter, sort, column visibility, column order, and the
  // search term back to this table's own configured defaults.
  resetAll() {
    this.searchTerm.set('');
    this.quickFilterActive.set(false);
    this.columnFilters.set(new Map());
    this.sort.set(this.defaultSort());
    const defaults = getDefaultDataTableLayout(this.columns(), this.stickyStartColumnKey());
    this.visibleColumnKeys.set(defaults.visibleColumnKeys);
    this.columnOrder.set(defaults.columnOrder);
    this.actionsColumnVisible.set(true);
    this.tableReset.emit();
  }

  // `rows()` narrowed by every filterable column's own currently-selected
  // values - a row passes a given column's filter if any value its own
  // `filterValue` derives is in that column's selected set. A column with
  // no entry in `columnFilters` yet (untouched) imposes no restriction.
  columnFilteredRows = computed(() => {
    const filters = this.columnFilters();
    if (filters.size === 0) return this.rows();

    const activeFilters = this.columns()
      .filter((column) => column.filterable && column.filterValue && filters.has(column.key))
      .map((column) => ({ filterValue: column.filterValue!, selected: filters.get(column.key)! }));
    if (activeFilters.length === 0) return this.rows();

    return this.rows().filter((row) =>
      activeFilters.every(({ filterValue, selected }) =>
        filterValue(row).some((value) => selected.has(value)),
      ),
    );
  });

  // `columnFilteredRows()` narrowed to the current search term - matches if
  // *any* column's own `searchValue` contains the term, case-insensitively,
  // regardless of whether that column is currently shown. A column with no
  // `searchValue` simply can't be searched.
  filteredRows = computed(() => {
    const quickFilterOverride = this.quickFilterOverride();
    if (this.quickFilterActive() && quickFilterOverride) {
      return this.rows().filter(quickFilterOverride.predicate);
    }

    const term = this.searchTerm().trim().toLowerCase();
    const base = this.columnFilteredRows();
    if (!term) return base;

    const searchers = this.columns()
      .map((column) => column.searchValue)
      .filter((searchValue): searchValue is (row: T) => string => !!searchValue);
    return base.filter((row) =>
      searchers.some((searchValue) => searchValue(row).toLowerCase().includes(term)),
    );
  });

  // `filteredRows()`, additionally ordered by the current `sort`.
  sortedRows = computed(() => {
    const sort = this.sort();
    const rows = this.filteredRows();
    if (!sort) return rows;

    const column = this.columnsByKey().get(sort.columnKey);
    if (!column?.sortValue) return rows;
    const sortValue = column.sortValue;

    const sorted = [...rows].sort((a, b) => {
      const aValue = sortValue(a);
      const bValue = sortValue(b);
      const comparison =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  });

  trackByRow = (_index: number, row: T) => this.trackBy()(row);

  // Hides the overflow trigger when no action applies to the current row.
  hasVisibleOverflowActions(actions: DataTableActions<T>, row: T): boolean {
    return (actions.overflow ?? []).some((action) => !action.visible || action.visible(row));
  }

  onSearchInput(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  // Clicking a sortable column's icon: switching to a different column
  // always starts it at asc; clicking the already-active column toggles
  // asc <-> desc (never back to "no sort")
  toggleSort(columnKey: string) {
    const current = this.sort();
    let nextSort: DataTableSort;
    if (!current || current.columnKey !== columnKey) {
      nextSort = { columnKey, direction: 'asc' };
    } else {
      nextSort = { columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    }
    this.sort.set(nextSort);
    this.sortChange.emit(nextSort);
  }

  onViewportScroll(event: Event) {
    this.headerScrollLeft.set((event.target as HTMLElement).scrollLeft);
  }

  onColumnVisibilityChange(event: { key: string; shown: boolean }) {
    if (event.key === this.stickyStartColumnKey()) return;
    if (event.key === ACTIONS_COLUMN_KEY) {
      this.actionsColumnVisible.set(event.shown);
      return;
    }
    const next = new Set(this.visibleColumnKeys());
    if (event.shown) {
      next.add(event.key);
    } else {
      next.delete(event.key);
    }
    this.visibleColumnKeys.set(next);
  }

  onColumnOrderChange(order: string[]) {
    const stickyStartColumnKey = this.stickyStartColumnKey();
    this.columnOrder.set([
      ...(stickyStartColumnKey ? [stickyStartColumnKey] : []),
      ...order.filter((key) => key !== stickyStartColumnKey),
    ]);
  }

  isStickyStartColumn(key: string): boolean {
    return key === this.stickyStartColumnKey();
  }
}
