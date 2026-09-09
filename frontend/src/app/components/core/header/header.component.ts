import { Component, input, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RouterLink } from '@angular/router';
import { NgClass, NgOptimizedImage } from '@angular/common';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'se-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgClass, NgOptimizedImage, NavComponent],
})
export class HeaderComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  title = input<string>('Southeast Cubing');
  useMediumBreakpoint = input<boolean>(false);
  activateNavOnDefault = input<boolean>(false);
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
