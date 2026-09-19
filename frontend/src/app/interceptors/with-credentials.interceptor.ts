import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from 'src/environments/environment';

// Attaches the session cookie to every request to our own backend, so a
// signed-in session survives across the frontend/backend's cross-subdomain
// (but same-site) split.
export const withCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.links.southeastCubingApi)) {
    return next(req);
  }
  return next(req.clone({ withCredentials: true }));
};
