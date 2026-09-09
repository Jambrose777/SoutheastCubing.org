import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { PageNotFoundSkeleton } from 'src/app/models/ContentfulSkeletons';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: ['./page-not-found.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderComponent, LoadingSpinnerComponent, MarkdownComponent],
})
export class PageNotFoundComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  title = signal('Page Not Found');
  description = signal('');
  loadingContent = signal(true);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.darkGrey);

    // retrieve and formats data from the CMS home Page
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<PageNotFoundSkeleton>(ContentfulEntryId.pageNotFound)
        .subscribe({
          next: (res) => {
            this.title.set(res.fields.title);
            this.description.set(res.fields.description ?? '');
            this.loadingContent.set(false);
          },
          error: (err) => {
            console.error('Failed to load the page-not-found content from Contentful:', err);
            this.loadingContent.set(false);
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
