import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'se-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FooterComponent {
  isNavActive = false;
  transition = false;

  constructor() {}

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.isNavActive = toggled;
    this.transition = true;
    setTimeout(() => {
      this.transition = false;
    }, 500);
  }
}
