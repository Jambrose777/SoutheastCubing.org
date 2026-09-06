import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Location, NgClass, NgOptimizedImage } from '@angular/common';
import { Cat } from 'src/app/models/Cat';
import { Subscription } from 'rxjs';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { NavService } from 'src/app/services/nav.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Colors } from 'src/app/shared/types';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedCatComponent } from './selected-cat/selected-cat.component';

@Component({
  selector: 'se-cats',
  templateUrl: './cats.component.html',
  styleUrls: ['./cats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedCatComponent,
    NgClass,
    NgOptimizedImage,
  ],
})
export class CatsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  cats = signal<Cat[]>(undefined);
  catName = input<string>();
  title = signal('Southeast Cats');
  description = signal('');
  loadingContent = signal(true);
  loadingCats = signal(true);
  selectedCat = signal<Cat>(undefined);
  subscriptions: Subscription = new Subscription();
  availableColors: Colors[] = [
    Colors.blue,
    Colors.darkGrey,
    Colors.green,
    Colors.grey,
    Colors.yellow,
    Colors.purple,
    Colors.orange,
    Colors.red,
  ];

  ngOnInit(): void {
    // sets up main color for the cats page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve, sorts, and formats data from the CMS Cats Entries
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.cats).subscribe((res) => {
        const cats = res.items
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value)
          .map((cat) => {
            const photoSize = scaleToDisplaySize(
              cat.fields['photo']?.fields.file.details?.image?.width,
              cat.fields['photo']?.fields.file.details?.image?.height,
            );
            // Cat thumbnails render in a 60x60 box; scale the native Contentful
            // asset down (max ~120px, covering a 2x-density srcset) instead of
            // shipping the full-resolution upload for a tiny thumbnail.
            const thumbnailSize = scaleToDisplaySize(
              cat.fields['thumbnail']?.fields.file.details?.image?.width,
              cat.fields['thumbnail']?.fields.file.details?.image?.height,
              120,
            );
            return {
              ...cat.fields,
              photo: cat.fields['photo']?.fields.file.url,
              photoWidth: photoSize.width,
              photoHeight: photoSize.height,
              thumbnail: cat.fields['thumbnail']?.fields.file.url,
              thumbnailWidth: thumbnailSize.width,
              thumbnailHeight: thumbnailSize.height,
              color: this.availableColors[Math.floor(Math.random() * this.availableColors.length)],
            } as Cat;
          });
        this.cats.set(cats);
        if (this.catName()) {
          const foundCat = cats?.find((cat) => cat.name.replace(/ +/g, '-') === this.catName());
          if (foundCat) {
            this.selectCat(foundCat);
          } else {
            this.location.replaceState('/cats');
          }
        }
        this.loadingCats.set(false);
      }),
    );

    // retireve and formats data from the CMS Cats Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.cats).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        this.loadingContent.set(false);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a cat to drill in details on
  selectCat(cat: Cat) {
    // close Nav
    this.navService.closeNav();

    // Check if clicking an active cat, and delselect the cat if so.
    if (this.selectedCat()?.name === cat.name) {
      this.selectedCat.set(undefined);
      this.themeService.setMainPaneColor(Colors.green); //resets left pane
      this.location.replaceState('/cats');
    } else {
      this.selectedCat.set(cat);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(cat.color);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(cat.name)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/cats/' + cat.name.replace(/ +/g, '-'));
    }
  }
}
