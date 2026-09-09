export interface Delegate {
  contact?: string;
  delegateType?: DelegateType;
  description?: string;
  name: string;
  order: number;
  photo?: string;
  photoWidth?: number;
  photoHeight?: number;
  state?: string;
  thumbnail?: string;
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
