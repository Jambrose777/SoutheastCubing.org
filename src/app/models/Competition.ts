import { RegistrationStatus } from "../shared/types";

export class Competition {
  url: string;
  id: string;
  name: string;
  website: string;
  city: string;
  venue_address: string;
  venue_details: string;
  latitude_degrees: number;
  longitude_degrees: number;
  country_iso2: string;
  start_date: string;
  registration_open: string;
  registration_close: string;
  end_date: string;
  competitor_limit: number;
  event_ids: string[];
  venue: string;
  venueUrl?: string;
  full_date?: string;
  registration_status?: RegistrationStatus;
  readable_registration_open?: string;
  state?: string;
  accepted_registrations?: number;
  is_in_staff_application: boolean;
  is_manual_competition: boolean;
}
