import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'se-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, NgClass, NavComponent],
})
export class HeaderComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  title = input<string>('Southeast Cubing');
  useMediumBreakpoint = input<boolean>(false);
  activateNavOnDefault = input<boolean>(false);
  isNavActive = false;
  transition = false;
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(
      this.screenSizeService
        .getIsMobileSubject()
        .subscribe((isMobile) => (this.isMobile = isMobile)),
    );

    if (this.activateNavOnDefault()) {
      this.toggleNav(this.activateNavOnDefault());
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.isNavActive = toggled;
    this.transition = true;
    setTimeout(() => {
      this.transition = false;
    }, 500);
  }
}
