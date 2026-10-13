// One open item in the notification-badge mechanism.
// `toolRouterLink` matches a DashboardTool.routerLink; navigation can either
// focus a page field or pass tool-specific query parameters.
export interface PendingItem {
  id: string;
  label: string;
  toolRouterLink: string;
  fieldId?: string;
  queryParams?: Record<string, string>;
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
  peopleId: string;
  roles: {
    isAdmin: boolean;
    isBoard: boolean;
    isRegionalDelegate: boolean;
    isDelegate: boolean;
  };
  impersonatedRole?: string;
  hasManageCompetitionsGrant: boolean;
  pendingItems: PendingItem[];
}
