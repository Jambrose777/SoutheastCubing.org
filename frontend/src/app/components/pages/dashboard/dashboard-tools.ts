import { Colors } from 'src/app/shared/types';
import { CurrentUser } from 'src/app/models/CurrentUser';

// Role keys a dashboard tool (or route guard) can require access from.
export type Role = 'admin' | 'board';

// Maps each Role to the CurrentUser.roles key it corresponds to.
const ROLE_TO_CURRENT_USER_FLAG: Record<Role, keyof CurrentUser['roles']> = {
  admin: 'isAdmin',
  board: 'isBoard',
};

export interface DashboardTool {
  label: string;
  routerLink: string;
  icon: string;
  color: Colors;
  // Omit for a tool every signed-in user should see. Otherwise a list of
  // roles, any one of which grants access - e.g. ['board', 'admin'].
  requiresAnyRole?: Role[];
}

// One entry per dashboard tool
export const DASHBOARD_TOOLS: DashboardTool[] = [
  {
    label: 'My Info',
    routerLink: '/dashboard/my-info',
    icon: 'fa-user',
    color: Colors.grey,
    // No requiresAnyRole - always present for every signed-in user.
  },
  {
    label: 'Manage Teams',
    routerLink: '/dashboard/manage-teams',
    icon: 'fa-people-group',
    color: Colors.yellow,
    requiresAnyRole: ['board', 'admin'],
  },
];

// True if `user` currently holds any of `roles`.
export function hasAnyRole(user: CurrentUser | undefined | null, roles: Role[]): boolean {
  if (!user) return false;
  return roles.some((role) => user.roles[ROLE_TO_CURRENT_USER_FLAG[role]]);
}
