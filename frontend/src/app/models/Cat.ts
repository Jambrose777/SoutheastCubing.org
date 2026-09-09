import { Colors } from '../shared/types';

export interface Cat {
  description?: string;
  name: string;
  photo?: string;
  photoWidth?: number;
  photoHeight?: number;
  color: Colors;
  thumbnail?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}
