// Shapes for the Manage Delegates dashboard

// One current-mode row - one per Delegate, their single highest
// concurrently-open rank. Shape returned by GET /dashboard/delegates's
// `current` array.
export interface ManageDelegateCurrent {
  peopleId: string;
  name: string;
  wcaId: string | null;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  competitionsDelegatedCount: number | null;
  rank: 'trainee' | 'junior' | 'delegate' | 'senior' | 'regional';
  state: string | null;
  startDate: string;
  // True if `startDate` was borrowed from the concurrently-open state row
  // (it's more recent than the rank row's own start date) rather than the
  // rank row itself.
  startDateFromState: boolean;
}

// One history-mode row - every rank/state stint, current and past,
// intertwined. Shape returned by GET /dashboard/delegates's `history` array.
export interface ManageDelegateHistoryEntry {
  id: string;
  type: 'rank' | 'state';
  peopleId: string;
  name: string;
  wcaId: string | null;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  competitionsDelegatedCount: number | null;
  // The rank label (for a `type: 'rank'` row) or state name (for a
  // `type: 'state'` row).
  value: string;
  startDate: string;
  endDate: string | null;
  // True if `startDate` exactly equals WCA's own placeholder start date
  // (2004-08-01) - likely a candidate for backfilling.
  isPlaceholderDate: boolean;
}

// Shape returned by GET /dashboard/delegates.
export interface ManageDelegatesResponse {
  current: ManageDelegateCurrent[];
  history: ManageDelegateHistoryEntry[];
}

// The Add/Edit sheet's own shared shape - `type` is only choosable on add
// (which table the new row is inserted into); an edit is always a plain
// update against whichever table that row already lives in.
export type ManageDelegateHistoryType = 'rank' | 'state';

// Structured summary returned by POST /dashboard/delegates/sync - what
// actually changed during that sync run.
export interface DelegateSyncSummary {
  promoted: { wcaId: string; rank: string; startDate: string }[];
  demoted: { wcaId: string; from: string }[];
  rankChanged: { wcaId: string; from: string; to: string }[];
  regionalOrSeniorChanged: { wcaId: string; rank: string; opened: boolean }[];
  stateChanged: { wcaId: string; from: string | null; to: string | null }[];
  errors: string[];
}
