export class Delegate {
  contact: string;
  delegateType: DelegateType;
  description: string;
  name: string;
  order: number;
  photo: string;
  state: string;
  thumbnail: string;
  wcaid: string;
}

export enum DelegateType {
  delegate = 'Delegate',
  junior = 'Junior Delegate',
  regional = 'Regional Delegate',
  senior = 'Senior Delegate',
  temporary = 'Temporary Delegate',
  trainee = 'Trainee Delegate',
}
