import { Component, input, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'se-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgClass, NavComponent],
})
export class HeaderComponent implements OnInit {
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  title = input<string>('Southeast Cubing');
  useMediumBreakpoint = input<boolean>(false);
  activateNavOnDefault = input<boolean>(false);
  isNavActive = signal(false);
  transition = signal(false);

  ngOnInit(): void {
    if (this.activateNavOnDefault()) {
      this.toggleNav(this.activateNavOnDefault());
    }
  }

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.isNavActive.set(toggled);
    this.transition.set(true);
    setTimeout(() => {
      this.transition.set(false);
    }, 500);
  }
}
