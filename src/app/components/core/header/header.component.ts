import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  isMobile = isMobile();
  @Input() title: string = 'Southeast Cubing';
  @Input() useMediumBreakpoint: boolean = false;
  isNavActive = false;
  transition = false;

  constructor() { }

  ngOnInit(): void {
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
