import { Colors } from "../shared/types";

export class SubTopic {
  title: string;
  description: string;
  photo: string;
  color: Colors;
  buttonText?: string;
  buttonIcon?: string;
  buttonInternalLink?: string;
  buttonExternalLink?: string;
}
