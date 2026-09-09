import { EmailType } from '../shared/types';

export interface EmailRequestBody {
  name: string;
  email: string;
  text: string;
  subject: string;
  emailType: EmailType;
}
