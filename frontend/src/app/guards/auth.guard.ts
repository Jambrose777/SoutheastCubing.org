import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Protects a route behind a signed-in session. Checks the backend directly.
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);

  return authService.checkAuthenticated().pipe(
    map((isAuthenticated) => {
      if (isAuthenticated) {
        return true;
      }
      // Redirects into the real WCA OAuth handshake, landing back on this
      // same guarded route once auth completes.
      authService.signIn(state.url);
      return false;
    }),
  );
};
