import { EmailType } from "../shared/types";

export class EmailRequestBody {
  name: string;
  email: string;
  text: string;
  subject: string;
  emailType: EmailType;
  ip?: string;
}
