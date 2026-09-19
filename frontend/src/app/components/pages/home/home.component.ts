import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import type { Entry } from 'contentful';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { HomePageOverrideSkeleton, HomePageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { resolvedAsset, resolvedEntry } from 'src/app/shared/contentful-links';
import { colorFromField } from 'src/app/shared/color-from-field';
import { environment } from 'src/environments/environment';
import { SubTopic } from 'src/app/models/SubTopic';
import { Router, RouterLink } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { NgOptimizedImage } from '@angular/common';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { CarouselComponent, CarouselImage } from '../../shared/carousel/carousel.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SafeUrlPipe } from 'src/app/pipes/safeUrl.pipe';

@Component({
  selector: 'se-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    CarouselComponent,
    MarkdownComponent,
    RouterLink,
    NgOptimizedImage,
    SafeUrlPipe,
  ],
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;
  environment = environment;
  title = signal('Southeast Cubing');
  description = signal('');
  photos = signal<CarouselImage[]>([]);
  loadingContent = signal(true);
  subTopics = signal<SubTopic[] | undefined>(undefined);
  // Set from a separate, independently-queried content type (not referenced from the
  // home page entry itself)
  homePageOverride = signal<Entry<HomePageOverrideSkeleton, undefined>['fields'] | undefined>(
    undefined,
  );
  subscriptions: Subscription = new Subscription();

  // Each announcement's `.items-container` holds exactly two identical
  // copies of that announcement's text back to back.
  @ViewChildren('itemsContainer') itemsContainers?: QueryList<ElementRef<HTMLDivElement>>;

  private static readonly MARQUEE_PIXELS_PER_SECOND = 42;

  ngOnInit(): void {
    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.blue);

    // retrieve and formats data from the CMS home Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry<HomePageSkeleton>(ContentfulEntryId.home).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description ?? '');
          this.subTopics.set(
            (res.fields.subTopics ?? [])
              .map((subTopicLink) => resolvedEntry(subTopicLink))
              .filter((subTopic) => !!subTopic)
              .map((subTopic) => {
                const photo = resolvedAsset(subTopic.fields['photo']);
                return {
                  ...subTopic.fields,
                  title: subTopic.fields.title ?? '',
                  photo: photo?.fields.file?.url,
                  color: colorFromField(subTopic.fields.color),
                  // Home's subtopics don't use nesting - override the spread's raw
                  // (unresolved) subTopics link array rather than passing it through.
                  subTopics: undefined,
                };
              }),
          );
          this.photos.set(
            (res.fields.photos ?? [])
              .map((photo) => resolvedAsset(photo))
              .filter((asset): asset is NonNullable<typeof asset> => !!asset?.fields.file?.url)
              .map((asset) => ({
                url: asset.fields.file!.url,
                alt: asset.fields.description ?? '',
              })),
          );
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the home page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );

    // Fetch Overridden content for the Home Page
    this.subscriptions.add(
      this.contentful
        .getContentfulGroup<HomePageOverrideSkeleton>(ContentfulContentType.homePageOverride)
        .subscribe({
          next: (res) => {
            // Not an error if more than one is somehow published at once - just use
            // whichever the query happened to return first, no priority/order field.
            this.homePageOverride.set(res.items[0]?.fields);
          },
          error: (err) => {
            console.error('Failed to load home page overrides from Contentful:', err);
          },
        }),
    );
  }

  ngAfterViewInit(): void {
    // On change, re-update the marquee speed.
    if (this.itemsContainers) {
      this.subscriptions.add(
        this.itemsContainers.changes.subscribe(() => this.updateMarqueeSpeeds()),
      );
      this.updateMarqueeSpeeds();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Sets each announcement banner's marquee animation-duration so it always
  // scrolls at the same real-world pixel speed, regardless of how long that
  // announcement's rendered text turns out to be.
  private updateMarqueeSpeeds(): void {
    this.itemsContainers?.forEach(({ nativeElement }) => {
      // scrollWidth covers both identical copies, so halve it for the width
      // of the single copy the animation actually needs to travel across.
      const oneCopyWidth = nativeElement.scrollWidth / 2;
      const durationSeconds = oneCopyWidth / HomeComponent.MARQUEE_PIXELS_PER_SECOND;
      nativeElement.style.setProperty('--marquee-duration', `${durationSeconds}s`);
    });
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
