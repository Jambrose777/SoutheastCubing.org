import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/southeastcubing-api/auth.service';
import { hasAnyRole, Role } from '../components/pages/dashboard/dashboard-tools';

// Factory for gating a route behind holding any of `roles` (e.g.
// roleGuard('board', 'admin') for the Manage Teams dashboard) - a single
// generalized guard rather than one named guard per role combination, so a
// later story's tool (e.g. Delegate/Regional Delegate-gated routes) just
// passes its own role list rather than adding a new guard file. Always runs
// after authGuard, so a signed-out visit is already redirected into WCA
// auth before this ever needs to check roles.
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.checkAuthenticated().pipe(
      map(() => {
        if (hasAnyRole(authService.currentUser(), roles)) {
          return true;
        }
        return router.parseUrl('/dashboard');
      }),
    );
  };
}
