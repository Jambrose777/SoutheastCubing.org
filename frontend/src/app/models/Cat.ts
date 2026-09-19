import { Colors } from '../shared/types';

export interface Cat {
  description?: string;
  name: string;
  photo?: string;
  photoAlt?: string;
  photoWidth?: number;
  photoHeight?: number;
  color: Colors;
  thumbnail?: string;
  thumbnailAlt?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}
