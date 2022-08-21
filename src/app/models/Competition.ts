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
  full_date: string | undefined;
  registration_status: string | undefined;
}