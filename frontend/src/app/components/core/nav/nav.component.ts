import {
  Component,
  input,
  ChangeDetectionStrategy,
  inject,
  effect,
  output,
  untracked,
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

  isNavActive = input(false);
  transition = input(false);
  toggleNavEmitter = output<boolean>();

  constructor() {
    // Reacts only to NavService.closeNav() calls, not to isNavActive changing
    // on its own — isNavActive is read via untracked() purely as a guard
    // value, otherwise the nav being opened would itself re-run this effect
    // and immediately close it again.
    effect(() => {
      this.navService.closeNavSignal();
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
