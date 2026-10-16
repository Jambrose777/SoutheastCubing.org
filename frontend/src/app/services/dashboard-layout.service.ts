import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  isSidePaneCollapsed = signal(false);
  sidePaneNavOpenRequest = signal(0);

  toggleSidePane(): void {
    this.isSidePaneCollapsed.update((collapsed) => !collapsed);
  }

  expandSidePaneAndOpenNav(): void {
    this.isSidePaneCollapsed.set(false);
    this.sidePaneNavOpenRequest.update((request) => request + 1);
  }
}
