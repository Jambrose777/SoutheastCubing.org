import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { NavComponent } from '../nav/nav.component';

@Component({
  selector: 'se-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NavComponent],
})
export class FooterComponent {
  isNavActive = signal(false);
  transition = signal(false);

  navItemText = computed(() => (this.isNavActive() || this.transition() ? 'Close' : 'Menu'));

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
