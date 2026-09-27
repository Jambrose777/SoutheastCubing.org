// Shape returned by GET /teams - the public "Who We Are" page's data.
export interface Team {
  id: string;
  name: string;
  description: string | null;
  members: TeamMember[];
}

export interface TeamMember {
  peopleId: string;
  name: string;
  tag: string | null;
  color: string | null;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
}
