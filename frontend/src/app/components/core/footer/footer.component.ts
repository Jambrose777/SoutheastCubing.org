import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FooterComponent implements OnInit {
  isNavActive = false;
  transition = false;

  constructor() {}

  ngOnInit(): void {}

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.isNavActive = toggled;
    this.transition = true;
    setTimeout(() => {
      this.transition = false;
    }, 500);
  }
}
