import { Colors } from '../shared/types';

export interface SubTopic {
  title: string;
  description?: string;
  photo?: string;
  photoWidth?: number;
  photoHeight?: number;
  color: Colors;
  buttonText?: string;
  buttonIcon?: string;
  buttonInternalLink?: string;
  buttonExternalLink?: string;
}
