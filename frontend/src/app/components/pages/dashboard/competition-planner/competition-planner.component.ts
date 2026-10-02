import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { ManageCompetitionsPromptComponent } from '../../../shared/manage-competitions-prompt/manage-competitions-prompt.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';

// Competition Planner for Delegates to see and plan upcoming competitions
// with each other.
@Component({
  selector: 'se-competition-planner',
  templateUrl: './competition-planner.component.html',
  styleUrls: ['./competition-planner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderComponent, DashboardSidePaneComponent, ManageCompetitionsPromptComponent],
})
export class CompetitionPlannerComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isMobile = this.screenSizeService.isMobile;

  ngOnInit() {
    const tool = DASHBOARD_TOOLS.find((t) => t.routerLink === '/dashboard/competition-planner');
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);

    this.handleStepUpRedirectParams();
  }

  // The manage_competitions step-up callback lands back here with
  // ?manageCompetitionsGranted=1 or ?authError=denied|failed - surface a
  // toast either way, then strip the param so a page refresh doesn't re-show
  // it, and refresh currentUser so the prompt stops showing once granted.
  private handleStepUpRedirectParams() {
    const params = this.route.snapshot.queryParamMap;
    const granted = params.get('manageCompetitionsGranted');
    const authError = params.get('authError');
    if (!granted && !authError) return;

    if (granted) {
      this.toastService.success('Access granted.');
      this.authService.refreshCurrentUser();
    } else if (authError === 'denied') {
      this.errorBannerService.show('Access request was declined.');
    } else {
      this.errorBannerService.show('Something went wrong granting access.');
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { manageCompetitionsGranted: null, authError: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
