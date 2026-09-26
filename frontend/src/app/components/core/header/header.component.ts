import {
  Component,
  input,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { RouterLink } from '@angular/router';
import { NgClass, NgOptimizedImage } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../nav/nav.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { cacheBustUrl } from 'src/app/shared/cache-bust-url.util';

@Component({
  selector: 'se-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgClass, NgOptimizedImage, NavComponent, MatTooltipModule, AvatarComponent],
})
export class HeaderComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);
  authService = inject(AuthService);

  isMobile = this.screenSizeService.isMobile;

  // Cache-busted so a managed photo replaced via My Info's Picture & Crop
  // sheet actually reloads here too.
  userPictureUrl = computed(() => {
    const url = this.authService.currentUser()?.pictureUrl;
    return url ? cacheBustUrl(url) : null;
  });

  title = input<string>('Southeast Cubing');
  activateNavOnDefault = input<boolean>(false);
  // Lets a page render this component twice on desktop - once for just the
  // title (in .main-pane) and once for just the logo/nav (in .side-pane) -
  // while mobile keeps both together in a single instance.
  showTitle = input<boolean>(true);
  showNavCluster = input<boolean>(true);
  disableHomeLink = input<boolean>(false);
  isNavActive = signal(false);
  transition = signal(false);

  ngOnInit(): void {
    if (this.activateNavOnDefault()) {
      this.isNavActive.set(true);
    }
  }

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.isNavActive.set(toggled);
    this.transition.set(true);
  }

  // finishes the transisition once done
  onTransitionEnd() {
    this.transition.set(false);
  }

  signIn() {
    this.authService.signIn();
  }
}
