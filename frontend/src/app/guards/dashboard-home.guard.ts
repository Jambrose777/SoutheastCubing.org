import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ScreenSizeService } from '../services/screen-size.service';

// On mobile there's no side pane, so /dashboard stays put as the
// tool-picker page. On Desktop redircts to /dashboard/my-info as
// a landing page. Runs after authGuard, so isMobile's initial
// value is already accurate by the time this checks it.
export const dashboardHomeGuard: CanActivateFn = () => {
  const screenSizeService = inject(ScreenSizeService);
  const router = inject(Router);

  if (screenSizeService.isMobile()) {
    return true;
  }
  return router.parseUrl('/dashboard/my-info');
};
