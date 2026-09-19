import { Component, input, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RouterLink } from '@angular/router';
import { NgClass, NgOptimizedImage } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'se-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgClass, NgOptimizedImage, NavComponent, MatTooltipModule],
})
export class HeaderComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

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
}
