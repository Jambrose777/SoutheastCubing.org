// The signed-in user's public display info, as returned by GET /auth/me -
// name/pictureUrl mirror the shared `people`.
export interface CurrentUser {
  name: string;
  pictureUrl: string | null;
  wcaId: string | null;
}
