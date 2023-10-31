import { Component, Input, OnInit } from '@angular/core';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  isMobile: boolean;
  @Input() title: string = 'Southeast Cubing';
  @Input() useMediumBreakpoint: boolean = false;
  isNavActive = false;
  transition = false;

  constructor(
    private screenSizeService: ScreenSizeService
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);
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
