export interface Delegate {
  contact?: string;
  delegateType?: DelegateType;
  description?: string;
  name: string;
  order: number;
  photo?: string;
  photoAlt?: string;
  photoWidth?: number;
  photoHeight?: number;
  state?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  wcaid?: string;
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
