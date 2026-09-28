import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { HeaderComponent } from '../../../core/header/header.component';
import { DASHBOARD_TOOLS, hasAnyRole } from '../dashboard-tools';

// Shared desktop side-pane for every dashboard tool page (the main
// dashboard and each tool's own page) - lists every tool the current user
// has access to, plus sign-out.
@Component({
  selector: 'se-dashboard-side-pane',
  templateUrl: './dashboard-side-pane.component.html',
  styleUrls: ['./dashboard-side-pane.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HeaderComponent, MatTooltipModule],
})
export class DashboardSidePaneComponent {
  private authService = inject(AuthService);

  tools = computed(() =>
    DASHBOARD_TOOLS.filter(
      (tool) =>
        !tool.requiresAnyRole || hasAnyRole(this.authService.currentUser(), tool.requiresAnyRole),
    ),
  );

  // The single open pending item (if any) targeting each visible tool, by
  // its routerLink - drives that row's "!" badge and, on click, which field
  // the destination page should scroll to/focus.
  pendingItemFor = computed(() => {
    const pendingItems = this.authService.currentUser()?.pendingItems ?? [];
    return (routerLink: string) => pendingItems.find((item) => item.toolRouterLink === routerLink);
  });

  // Dashboard always requires auth, so this always redirects home.
  signOut() {
    this.authService.signOut(true);
  }
}
