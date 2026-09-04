export class Team {
  name: string;
  description: string;
  teamMembers: TeamMember[];
  order: string;
}

export class TeamMember {
  name: string;
  color?: string;
  title?: string;
  thumbnail?: string;
}
