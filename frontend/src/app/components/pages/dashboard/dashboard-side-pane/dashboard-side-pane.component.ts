import { Component, ChangeDetectionStrategy, inject, computed, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { HeaderComponent } from '../../../core/header/header.component';
import { DASHBOARD_TOOLS, hasAnyRole } from '../dashboard-tools';
import { DashboardLayoutService } from 'src/app/services/dashboard-layout.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

// Shared desktop side-pane for every dashboard tool page (the main
// dashboard and each tool's own page) - lists every tool the current user
// has access to, plus sign-out.
@Component({
  selector: 'se-dashboard-side-pane',
  templateUrl: './dashboard-side-pane.component.html',
  styleUrls: ['./dashboard-side-pane.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, HeaderComponent, MatTooltipModule],
})
export class DashboardSidePaneComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private screenSizeService = inject(ScreenSizeService);
  dashboardLayout = inject(DashboardLayoutService);

  tools = computed(() =>
    DASHBOARD_TOOLS.filter(
      (tool) =>
        !tool.requiresAnyRole || hasAnyRole(this.authService.currentUser(), tool.requiresAnyRole),
    ),
  );

  ngOnInit(): void {
    const currentPath = this.router.url.split(/[?#]/, 1)[0].replace(/\/$/, '');
    if (DASHBOARD_TOOLS.some((tool) => tool.routerLink === currentPath)) {
      this.onToolSelected(currentPath);
    }
  }

  // The single open pending item (if any) targeting each visible tool, by
  // its routerLink - drives that row's "!" badge and navigation destination.
  pendingItemFor = computed(() => {
    const pendingItems = this.authService.currentUser()?.pendingItems ?? [];
    return (routerLink: string) => pendingItems.find((item) => item.toolRouterLink === routerLink);
  });

  // Uses tool-specific query parameters when present; otherwise, pending
  // items continue to use the shared focus-field navigation convention.
  queryParamsForTool(routerLink: string): Record<string, string> | null {
    const pendingItem = this.pendingItemFor()(routerLink);
    if (!pendingItem) return null;
    if (pendingItem.queryParams) return pendingItem.queryParams;
    return pendingItem.fieldId ? { focusField: pendingItem.fieldId } : null;
  }

  // Apply the same pane state whether a tool was clicked or loaded directly.
  onToolSelected(routerLink: string): void {
    const isCompetitionPlanner = routerLink === '/dashboard/competition-planner';
    const isMyInfo = routerLink === '/dashboard/my-info';
    const isCompactDesktop =
      !this.screenSizeService.isMobile() &&
      window.innerWidth < this.screenSizeService.mediumScreenSize;

    this.dashboardLayout.isSidePaneCollapsed.set(
      isCompetitionPlanner || (isCompactDesktop && !isMyInfo),
    );
  }

  // Dashboard always requires auth, so this always redirects home.
  signOut() {
    this.authService.signOut(true);
  }
}
