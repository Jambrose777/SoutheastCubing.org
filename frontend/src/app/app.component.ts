import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenSizeService } from './services/screen-size.service';
import { LinksService } from './services/links.service';
import { AuthService } from './services/southeastcubing-api/auth.service';
import { DevImpersonationService } from './services/southeastcubing-api/dev-impersonation.service';
import { ErrorBannerService } from './services/error-banner.service';
import { ToastService } from './services/toast.service';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/core/footer/footer.component';
import { ErrorBannerComponent } from './components/shared/error-banner/error-banner.component';

@Component({
  selector: 'se-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FooterComponent, ErrorBannerComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);
  private linksService = inject(LinksService);
  private authService = inject(AuthService);
  private devImpersonationService = inject(DevImpersonationService);
  private errorBannerService = inject(ErrorBannerService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  title = 'southeast-cubing';

  isMobile = this.screenSizeService.isMobile;

  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    this.screenSizeService.setUpScreenSize();

    // call links service to setup link overrides
    this.linksService.pullLinksFromContentful();

    // resolves whether the session cookie (if any) is still signed in.
    this.authService.refreshCurrentUser();

    // resolves whether dev-only role picker should render -
    // always false outside local dev.
    this.devImpersonationService.checkEnabled();

    // A WCA sign-in deny/failure redirects back here with ?authError=..., a
    // successful one with ?signedIn=1, and a redirect-triggering sign-out
    // with ?signedOut=1 - show the appropriate banner/toast, then strip
    // whichever param it was so a refresh/back doesn't re-show it.
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        if (params['authError']) {
          this.errorBannerService.show(
            'Sign-in was unsuccessful. Continuing requires signing in via your WCA account.',
          );
          this.router.navigate([], {
            queryParams: { authError: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        } else if (params['signedIn']) {
          this.toastService.success('Signed in successfully.');
          this.router.navigate([], {
            queryParams: { signedIn: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        } else if (params['signedOut']) {
          this.toastService.success('Signed out successfully.');
          this.router.navigate([], {
            queryParams: { signedOut: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
