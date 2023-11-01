import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  @Input() title: string = 'Southeast Cubing';
  @Input() useMediumBreakpoint: boolean = false;
  @Input() activateNavOnDefault: boolean = false;
  isNavActive = false;
  transition = false;
  subscriptions: Subscription = new Subscription();

  constructor(
    private screenSizeService: ScreenSizeService
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    if (this.activateNavOnDefault) {
      this.toggleNav(this.activateNavOnDefault);
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
