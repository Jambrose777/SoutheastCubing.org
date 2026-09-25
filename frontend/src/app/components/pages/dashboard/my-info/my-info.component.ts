import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { MyInfoService } from 'src/app/services/southeastcubing-api/my-info.service';
import { ToastService } from 'src/app/services/toast.service';
import { Colors } from 'src/app/shared/types';
import { formatDate } from 'src/app/shared/date.util';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { HeaderComponent } from '../../../core/header/header.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { MyInfo } from 'src/app/models/MyInfo';

// The "Who We Are" page's URL.
const WHO_WE_ARE_URL = buildDetailUrl('/about', 'Who We Are');

// My Info tab - every stored profile field for the signed-in user, the dob
// step-up flow, and their current/past roles-memberships.
@Component({
  selector: 'se-my-info',
  templateUrl: './my-info.component.html',
  styleUrls: ['./my-info.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    DashboardSidePaneComponent,
    LoadingSpinnerComponent,
    NgOptimizedImage,
    RouterLink,
    MatTooltipModule,
  ],
})
export class MyInfoComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  private myInfoApi = inject(MyInfoService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;
  whoWeAreUrl = WHO_WE_ARE_URL;

  loading = signal(true);
  myInfo = signal<MyInfo | null>(null);

  formatDate = formatDate;

  ngOnInit(): void {
    this.themeService.setMainPaneColor(Colors.grey);
    this.loadMyInfo();
    this.handleStepUpRedirectParams();
  }

  private loadMyInfo() {
    this.loading.set(true);
    this.myInfoApi.getMyInfo().subscribe({
      next: (myInfo) => {
        this.myInfo.set(myInfo);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  // The dob step-up callback lands back here with ?dobGranted=1 or
  // ?authError=denied|failed - surface a toast either way, then strip the
  // param so a page refresh doesn't re-show it.
  private handleStepUpRedirectParams() {
    const params = this.route.snapshot.queryParamMap;
    const dobGranted = params.get('dobGranted');
    const authError = params.get('authError');
    if (!dobGranted && !authError) return;

    if (dobGranted) {
      this.toastService.success('Date of birth added.');
    } else if (authError === 'denied') {
      this.toastService.error('Date of birth request was declined.');
    } else {
      this.toastService.error('Something went wrong granting date of birth access.');
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { dobGranted: null, authError: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // My Info's dob field click-to-grant action.
  beginDobStepUp() {
    this.authService.beginDobStepUp();
  }
}
