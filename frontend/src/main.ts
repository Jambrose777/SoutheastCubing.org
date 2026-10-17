import { enableProdMode, provideZoneChangeDetection } from '@angular/core';

import { environment } from './environments/environment';
import { IMAGE_LOADER } from '@angular/common';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app/app.routes';
// Deprecated (20.2, "use animate.enter/animate.leave instead", intent to
// remove in v23) - but still required as long as Material components like
// MatSnackBar drive their own enter/exit animations via the legacy
// @angular/animations trigger API internally, which animate.enter/leave
// doesn't replace. Revisit when Material itself migrates off that API.
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { AppComponent } from './app/app.component';
import { contentfulImageLoader } from './app/shared/contentful-image-loader';
import { withCredentialsInterceptor } from './app/interceptors/with-credentials.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimationsAsync(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([withCredentialsInterceptor])),
    provideZoneChangeDetection(),
    { provide: IMAGE_LOADER, useValue: contentfulImageLoader },
  ],
}).catch((err) => console.error(err));
