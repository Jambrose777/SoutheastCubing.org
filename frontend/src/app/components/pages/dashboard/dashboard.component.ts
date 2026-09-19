import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { AuthService } from 'src/app/services/auth.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../core/header/header.component';

@Component({
  selector: 'se-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderComponent],
})
export class DashboardComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;

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
