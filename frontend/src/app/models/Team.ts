export interface Team {
  name: string;
  description?: string;
  teamMembers: TeamMember[];
  order: string;
}

export interface TeamMember {
  name: string;
  color?: string;
  title?: string;
  thumbnail?: string;
  thumbnailAlt?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}
