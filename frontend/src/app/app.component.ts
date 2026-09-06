import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScreenSizeService } from './services/screen-size.service';
import { LinksService } from './services/links.service';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/core/footer/footer.component';

@Component({
  selector: 'se-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, FooterComponent],
})
export class AppComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);
  private linksService = inject(LinksService);

  title = 'southeast-cubing';

  isMobile = this.screenSizeService.isMobile;

  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    this.screenSizeService.setUpScreenSize();

    // call links service to setup link overrides
    this.linksService.pullLinksFromContentful();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
