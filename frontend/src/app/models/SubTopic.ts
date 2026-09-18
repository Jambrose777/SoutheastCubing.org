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
  // Self-referencing so a subtopic can have its own nested subtopics
  // Rendering code caps this at one level deep regardless of how it's
  // populated in Contentful.
  subTopics?: SubTopic[];
}
