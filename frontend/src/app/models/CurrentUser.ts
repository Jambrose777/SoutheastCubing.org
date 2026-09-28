// One open item in the notification-badge mechanism.
// `toolRouterLink` matches a DashboardTool.routerLink
// `fieldId` is the DOM element id the badge's click should scroll to/focus
// once that tool's page has loaded.
export interface PendingItem {
  id: string;
  label: string;
  toolRouterLink: string;
  fieldId: string;
}

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
  pendingItems: PendingItem[];
}
