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
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Colors } from 'src/app/shared/types';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { SelectItemService } from 'src/app/services/select-item.service';
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
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);

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

    // retrieve, sorts, and formats data from the CMS Cats Entries
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.cats).subscribe({
        next: (res) => {
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
                color:
                  this.availableColors[Math.floor(Math.random() * this.availableColors.length)],
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
        },
        error: (err) => {
          console.error('Failed to load the cats list from Contentful:', err);
          this.loadingCats.set(false);
        },
      }),
    );

    // retrieve and formats data from the CMS Cats Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.cats).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description);
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the cats page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a cat to drill in details on
  selectCat(cat: Cat) {
    this.selectItemService.select(cat, {
      selectedSignal: this.selectedCat,
      isSelected: (c) => this.selectedCat()?.name === c.name,
      elementId: (c) => c.name,
      basePaneColor: Colors.green,
      selectColor: (c) => c.color,
      updateUrl: () =>
        this.location.replaceState(buildDetailUrl('/cats', this.selectedCat()?.name)),
    });
  }
}
