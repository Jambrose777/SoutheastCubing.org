import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CurrentUser } from '../models/CurrentUser';
import { SouteastcubingApiService } from './souteastcubing-api.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private api = inject(SouteastcubingApiService);
  private toastService = inject(ToastService);

  private currentUserSignal = signal<CurrentUser | null>(null);
  currentUser = this.currentUserSignal.asReadonly();

  // Asks the backend whether the session cookie (if any) still resolves to a
  // signed-in user, updates currentUser accordingly, and resolves to whether
  // it did.
  checkAuthenticated(): Observable<boolean> {
    return this.api.getCurrentUser().pipe(
      tap((user) => this.currentUserSignal.set(user)),
      map(() => true),
      catchError(() => {
        this.currentUserSignal.set(null);
        return of(false);
      }),
    );
  }

  // Called once on app init (see AppComponent) - a 401 here just means
  // "signed out", not an error worth surfacing.
  refreshCurrentUser() {
    this.checkAuthenticated().subscribe();
  }

  // Sends the browser into the real WCA OAuth handshake - this is a full page
  // navigation (not an Angular route), since the backend needs to redirect
  // the browser itself to WCA's consent screen. `returnTo` defaults to the
  // current page, so the user lands back on whatever they were doing (an
  // auth-gated action or a directly-navigated guarded route) rather than the
  // homepage.
  signIn(returnTo: string = `${location.pathname}${location.search}`) {
    const url = new URL(`${environment.links.southeastCubingApi}/auth/wca/login`);
    url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  }

  // Signs out, then redirects to the homepage only if the current page
  // requires auth - a page that doesn't require auth leaves the user in
  // place, per the sign-out redirect rule.
  signOut(currentPageRequiresAuth: boolean) {
    this.api.signOut().subscribe({
      next: () => {
        this.currentUserSignal.set(null);
        if (currentPageRequiresAuth) {
          // Carry the "just signed out" signal across the reload.
          window.location.href = '/home?signedOut=1';
        } else {
          this.toastService.success('Signed out successfully.');
        }
      },
    });
  }
}
