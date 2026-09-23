import { Component, ChangeDetectionStrategy, inject, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/auth.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../core/header/header.component';
import { DashboardSidePaneComponent } from './dashboard-side-pane/dashboard-side-pane.component';
import { DASHBOARD_TOOLS, hasAnyRole } from './dashboard-tools';

@Component({
  selector: 'se-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderComponent, RouterLink, DashboardSidePaneComponent],
})
export class DashboardComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;

  // Mobile has no side-pane, so it needs its own flat list of tool links.
  mobileTools = computed(() =>
    DASHBOARD_TOOLS.filter(
      (tool) =>
        !tool.requiresAnyRole || hasAnyRole(this.authService.currentUser(), tool.requiresAnyRole),
    ),
  );

  ngOnInit(): void {
    this.themeService.setMainPaneColor(Colors.grey);
  }

  // TEMPORARY: HeaderComponent's sign-out only renders in the side-pane
  // instance, which doesn't exist on mobile - this gives mobile users a way
  // to sign out at all until a permanent mobile placement is designed.
  // Dashboard always requires auth, so this always redirects home.
  signOut() {
    this.authService.signOut(true);
  }
}
