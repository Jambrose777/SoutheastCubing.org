export interface Club {
  id: string;
  name: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  city: string;
  venue?: string;
  address?: string;
  meetingInformation?: string;
  contactName?: string;
  contactInfo?: string;
  contactEmail?: string;
  website?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}
