// Shape returned by GET /delegates - the public Delegate roster.
export interface Delegate {
  peopleId: string;
  name: string;
  wcaId: string | null;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  bio: string | null;
  competitionsDelegatedCount: number | null;
  // Their single highest concurrently-open rank
  rank: string;
  // WCA's full state name (e.g. "Georgia"), or "Southeast" for a Regional Delegate.
  state: string | null;
}

export enum DelegateType {
  delegate = 'Delegate',
  junior = 'Junior Delegate',
  regional = 'Regional Delegate',
  senior = 'Senior Delegate',
  temporary = 'Temporary Delegate',
  trainee = 'Trainee Delegate',
}

// Maps a delegate_rank_history rank value (the backend's own rank enum -
// trainee/junior/delegate/senior/regional/temporary) to its display label.
export const RANK_LABELS: Record<string, DelegateType> = {
  trainee: DelegateType.trainee,
  junior: DelegateType.junior,
  delegate: DelegateType.delegate,
  senior: DelegateType.senior,
  regional: DelegateType.regional,
  temporary: DelegateType.temporary,
};
