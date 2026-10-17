import type { DataTableSort } from './data-table.types';

export interface DataTableStateColumn {
  key: string;
  visibleByDefault: boolean;
}

export interface DataTableSavedState {
  sort: DataTableSort | null;
  visibleColumnKeys: string[];
  columnOrder: string[];
  columnFilters: Record<string, string[]>;
  actionsColumnVisible: boolean;
  consumerState?: Record<string, unknown>;
}

export interface DataTableStateSnapshot {
  sort: DataTableSort | null;
  visibleColumnKeys: Set<string>;
  columnOrder: string[];
  columnFilters: Map<string, Set<string>>;
  actionsColumnVisible: boolean;
  consumerState: Record<string, unknown>;
}

export interface DataTableRestoredState {
  sort: DataTableSort | null;
  visibleColumnKeys: Set<string>;
  columnOrder: string[];
  columnFilters: Map<string, Set<string>>;
  actionsColumnVisible: boolean;
  consumerState?: Record<string, unknown>;
}

// Reads this table's stored state, ignoring unavailable storage and malformed JSON.
export function loadDataTableState(storageKey: string | null): DataTableSavedState | null {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as DataTableSavedState) : null;
  } catch {
    return null;
  }
}

// Serializes collection-backed state and persists it under this table's key.
export function saveDataTableState(storageKey: string, state: DataTableStateSnapshot): void {
  const savedState: DataTableSavedState = {
    sort: state.sort,
    visibleColumnKeys: [...state.visibleColumnKeys],
    columnOrder: state.columnOrder,
    columnFilters: Object.fromEntries(
      [...state.columnFilters].map(([columnKey, values]) => [columnKey, [...values]]),
    ),
    actionsColumnVisible: state.actionsColumnVisible,
    consumerState: state.consumerState,
  };
  localStorage.setItem(storageKey, JSON.stringify(savedState));
}

// Builds default column visibility and order, keeping the sticky column first.
export function getDefaultDataTableLayout(
  columns: DataTableStateColumn[],
  stickyStartColumnKey: string | null,
) {
  const columnOrder = columns.map((column) => column.key);
  if (stickyStartColumnKey && columnOrder.includes(stickyStartColumnKey)) {
    columnOrder.splice(columnOrder.indexOf(stickyStartColumnKey), 1);
    columnOrder.unshift(stickyStartColumnKey);
  }

  const visibleColumnKeys = new Set(
    columns.filter((column) => column.visibleByDefault).map((column) => column.key),
  );
  if (stickyStartColumnKey && columnOrder.includes(stickyStartColumnKey)) {
    visibleColumnKeys.add(stickyStartColumnKey);
  }

  return { columnOrder, visibleColumnKeys };
}

// Reconciles persisted preferences with the current columns and filter options.
export function restoreDataTableState(
  saved: DataTableSavedState,
  columns: DataTableStateColumn[],
  stickyStartColumnKey: string | null,
): DataTableRestoredState {
  const defaultOrder = getDefaultDataTableLayout(columns, stickyStartColumnKey).columnOrder;
  const validKeys = new Set(defaultOrder);
  const savedOrder = saved.columnOrder.filter(
    (key) => validKeys.has(key) && key !== stickyStartColumnKey,
  );
  const missingFromSaved = defaultOrder.filter(
    (key) => !savedOrder.includes(key) && key !== stickyStartColumnKey,
  );
  const columnOrder = [
    ...(stickyStartColumnKey && validKeys.has(stickyStartColumnKey) ? [stickyStartColumnKey] : []),
    ...savedOrder,
    ...missingFromSaved,
  ];
  const visibleColumnKeys = new Set(saved.visibleColumnKeys.filter((key) => validKeys.has(key)));
  if (stickyStartColumnKey && validKeys.has(stickyStartColumnKey)) {
    visibleColumnKeys.add(stickyStartColumnKey);
  }

  const columnFilters = new Map<string, Set<string>>();
  for (const [key, values] of Object.entries(saved.columnFilters)) {
    if (validKeys.has(key)) columnFilters.set(key, new Set(values));
  }

  return {
    sort: saved.sort,
    visibleColumnKeys,
    columnOrder,
    columnFilters,
    actionsColumnVisible: saved.actionsColumnVisible,
    consumerState: saved.consumerState,
  };
}
