import { TemplateRef } from '@angular/core';

export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSort {
  columnKey: string;
  direction: DataTableSortDirection;
}

// A column's per-column filter UI - 'multiselect' (options are every
// distinct value `filterValue` derives from the loaded rows) or
// 'custom-multiselect' (options are a fixed, consumer-supplied list)).
// Only meaningful when a column's own `filterable` is true.
export type DataTableFilterType = 'multiselect' | 'custom-multiselect';

// One selectable filter option
export interface DataTableFilterOption {
  value: string;
  label: string;
}

// Everything the column-visibility dropdown needs - split out from the full
// `DataTableColumn<T>` below so that dropdown never needs to know `T`.
export interface DataTableColumnMeta {
  key: string;
  label: string;
}

// One column's full configuration, supplied by the consumer page.
export interface DataTableColumn<T> extends DataTableColumnMeta {
  // CSS grid column sizing (e.g. '48px', '1fr') - shared by the header row
  // and every body row's own `grid-template-columns`.
  width: string;
  // Whether `label` renders in the table's own header cell - defaults to true.
  showLabelInHeader?: boolean;
  filterable: boolean;
  filterType?: DataTableFilterType;
  // Whether this column is shown out of the box.
  visibleByDefault: boolean;
  // Derives a sortable value from a row - required for a column to
  // participate in sort at all. Returning a `number` sorts numerically; a
  // `string` sorts alphabetically.
  sortValue?: (row: T) => string | number;
  // Derives this column's own searchable text from a row - required for a
  // column to participate in the global search box.
  searchValue?: (row: T) => string;
  // Derives this column's own filter value(s) from a row - a row can
  // contribute more than one value (e.g. a multi-team row contributing
  // every team it's on). A row matches the current filter if any of its
  // derived values is in the selected set. For 'multiselect', this also
  // doubles as the source of the filter dropdown's own option list (every
  // distinct value across all loaded rows); for 'custom-multiselect', the
  // option list instead comes from the fixed `filterOptions` below, since
  // there's no "distinct values in the data" to derive it from.
  filterValue?: (row: T) => string[];
  // 'custom-multiselect' only: the fixed set of selectable options - not
  // derived from the loaded rows.
  filterOptions?: DataTableFilterOption[];
  // Renders this column's own cell content for a given row - declared by
  // the consumer as a plain `<ng-template let-row>` and read via `viewChild`.
  cellTemplate: TemplateRef<{ $implicit: T }>;
}

// One action button for a row - rendered either inline (its own button) or
// inside the overflow "..." menu.
export interface DataTableAction<T> {
  icon?: string;
  iconImageSrc?: string;
  label: string;
  onClick: (row: T) => void;
  // Omit to always show this action; when provided, the action is hidden
  // for a given row (e.g. an Edit item only shown to someone with edit
  // access to that specific row) rather than just disabled.
  visible?: (row: T) => boolean;
}

// The table's own Actions column config.
export interface DataTableActions<T> {
  // Rendered as their own buttons, always visible.
  inline?: DataTableAction<T>[];
  // Collapsed behind a trailing "..." button's dropdown menu.
  overflow?: DataTableAction<T>[];
}

// One active column filter, ready to render as its own removable pill.
export interface DataTableFilterPill {
  columnKey: string;
  label: string;
  summary: string;
}
