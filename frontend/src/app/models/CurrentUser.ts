// The signed-in user's public display info, as returned by GET /auth/me -
// name/pictureUrl mirror the shared `people`.
export interface CurrentUser {
  name: string;
  pictureUrl: string | null;
  thumbnailCropX: number | null;
  thumbnailCropY: number | null;
  thumbnailCropW: number | null;
  thumbnailCropH: number | null;
  wcaId: string | null;
  roles: {
    isAdmin: boolean;
    isBoard: boolean;
  };
  impersonatedRole?: string;
}
