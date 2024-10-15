import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenSizeService } from './services/screen-size.service';
import { LinksService } from './services/links.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'southeast-cubing';
  isMobile: boolean;
  subscriptions: Subscription = new Subscription();

  constructor(
    private screenSizeService: ScreenSizeService,
    private linksService: LinksService,
  ) { }

  ngOnInit(): void {
    this.screenSizeService.setUpScreenSize();

    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // call links service to setup link overrides
    this.linksService.pullLinksFromContentful();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}
