import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { environment } from 'src/environments/environment';
import { SubTopic } from 'src/app/models/SubTopic';
import { Router, RouterLink } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { NgOptimizedImage } from '@angular/common';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    RouterLink,
    NgOptimizedImage,
  ],
})
export class HomeComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;
  environment = environment;
  title = signal('Southeast Cubing');
  description = signal('');
  photos = signal<string[]>([]);
  loadingContent = signal(true);
  subTopics = signal<SubTopic[]>(undefined);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.blue);

    // retrieve and formats data from the CMS home Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.home).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description);
          this.subTopics.set(
            res.fields.subTopics?.map((subTopic) => ({
              ...subTopic.fields,
              color: Colors[subTopic.fields.color],
            })),
          );
          this.photos.set(res.fields.photos?.map((photo) => ({ path: photo.fields.file.url })));
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the home page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  announcementClick(subTopic: SubTopic) {
    if (subTopic.buttonInternalLink) {
      this.router.navigate([subTopic.buttonInternalLink]);
    } else if (subTopic.buttonExternalLink) {
      this.router.navigate([]).then(() => {
        window.open(subTopic.buttonExternalLink, '_blank');
      });
    }
  }
}
