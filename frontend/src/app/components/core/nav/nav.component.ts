import {
  Component,
  input,
  ChangeDetectionStrategy,
  inject,
  effect,
  output,
  untracked,
  HostListener,
} from '@angular/core';
import { NavService } from 'src/app/services/nav.service';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'se-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, RouterLink],
})
export class NavComponent {
  private navService = inject(NavService);

  // Counts CSS transitions currently in flight across the nav's descendants
  // (incremented on `transitionrun`, decremented on `transitionend`/
  // `transitioncancel`). The open/close animation involves many separately
  // timed transitions, so the whole thing is only "done" once this count
  // returns to zero.
  private runningTransitionCount = 0;

  isNavActive = input(false);
  transition = input(false);
  disableHomeLink = input(false);
  toggleNavEmitter = output<boolean>();
  transitionEndEmitter = output<void>();

  @HostListener('transitionrun')
  onDescendantTransitionRun(): void {
    this.runningTransitionCount++;
  }

  @HostListener('transitionend')
  @HostListener('transitioncancel')
  onDescendantTransitionSettled(): void {
    this.runningTransitionCount = Math.max(0, this.runningTransitionCount - 1);
    if (this.runningTransitionCount === 0) {
      this.transitionEndEmitter.emit();
    }
  }

  constructor() {
    // Reacts only to NavService.closeNav() calls, not to isNavActive changing
    // on its own — isNavActive is read via untracked() purely as a guard
    // value, otherwise the nav being opened would itself re-run this effect
    // and immediately close it again. The first run isn't a real
    // "someone called closeNav()" event, so it's skipped. Otherwise a nav
    // that starts pre-opened (activateNavOnDefault on the header) would get
    // immediately closed again by this effect's own initial run.
    let isFirstRun = true;
    effect(() => {
      this.navService.closeNavSignal();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      if (untracked(this.isNavActive)) {
        this.toggleNav();
      }
    });
  }

  // Opens / Closes the nav controls
  toggleNav() {
    this.toggleNavEmitter.emit(!this.isNavActive());
  }
}
