import { Colors } from '../shared/types';

export interface DocumentLink {
  name: string;
  order: string;
  link: string;
  color?: Colors;
}
