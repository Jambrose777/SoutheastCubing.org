import { enableProdMode, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';

import { environment } from './environments/environment';
import { IMAGE_LOADER } from '@angular/common';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app/app.routes';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideMarkdown } from 'ngx-markdown';
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
    importProvidersFrom(
      BrowserModule,
      ReactiveFormsModule,
      MatSelectModule,
      MatFormFieldModule,
      MatInputModule,
    ),
    provideMarkdown(),
    provideAnimationsAsync(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi(), withInterceptors([withCredentialsInterceptor])),
    provideZoneChangeDetection(),
    { provide: IMAGE_LOADER, useValue: contentfulImageLoader },
  ],
}).catch((err) => console.error(err));
