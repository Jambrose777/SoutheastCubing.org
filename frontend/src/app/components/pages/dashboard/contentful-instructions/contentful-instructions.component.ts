import { Component, ChangeDetectionStrategy, inject, OnInit, signal } from '@angular/core';
import { MarkdownComponent, provideMarkdown } from 'ngx-markdown';
import { take } from 'rxjs';
import { SubTopicSkeleton } from 'src/app/models/ContentfulSkeletons';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner.component';
import { DashboardSidePaneComponent } from '../dashboard-side-pane/dashboard-side-pane.component';
import { DASHBOARD_TOOLS } from '../dashboard-tools';

@Component({
  selector: 'se-contentful-instructions',
  templateUrl: './contentful-instructions.component.html',
  styleUrls: ['./contentful-instructions.component.scss'],
  providers: provideMarkdown(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    DashboardSidePaneComponent,
    MarkdownComponent,
  ],
})
export class ContentfulInstructionsComponent implements OnInit {
  private contentful = inject(ContentfulService);
  private screenSizeService = inject(ScreenSizeService);
  private themeService = inject(ThemeService);

  isMobile = this.screenSizeService.isMobile;
  loading = signal(true);
  available = signal(false);
  title = signal('Contentful Instructions');
  description = signal('');

  // Loads the published guide entry and leaves the view unavailable if it cannot be used.
  ngOnInit(): void {
    const tool = DASHBOARD_TOOLS.find(
      (candidate) => candidate.routerLink === '/dashboard/contentful-instructions',
    );
    this.themeService.setMainPaneColor(tool?.color ?? Colors.grey);

    this.contentful
      .getContentfulEntry<SubTopicSkeleton>(ContentfulEntryId.contentfulInstructions)
      .pipe(take(1))
      .subscribe({
        next: (entry) => {
          const title = entry.fields.title?.trim();
          const description = entry.fields.description?.trim();
          this.loading.set(false);

          if (!title || !description) return;

          this.title.set(title);
          this.description.set(description);
          this.available.set(true);
        },
        error: (error) => {
          console.error('Failed to load Contentful Instructions from Contentful:', error);
          this.loading.set(false);
        },
      });
  }
}
