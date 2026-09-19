import {
  Component,
  input,
  Injector,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Championship } from 'src/app/models/Championship';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import {
  ChampionshipSkeleton,
  ChampionshipsPageSkeleton,
  ChampionSkeleton,
} from 'src/app/models/ContentfulSkeletons';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { resolvedAsset, resolvedEntry } from 'src/app/shared/contentful-links';
import { stateAbbreviationFromCity } from 'src/app/shared/state-abbreviation-from-city';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { scrollIntoViewSafely } from 'src/app/shared/scroll-into-view-safely';
import { SelectItemService } from 'src/app/services/select-item.service';
import { environment } from 'src/environments/environment';
import { Location, NgClass, NgOptimizedImage } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedChampionshipComponent } from './selected-championship/selected-championship.component';

@Component({
  selector: 'se-championships',
  templateUrl: './championships.component.html',
  styleUrls: ['./championships.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedChampionshipComponent,
    NgClass,
    NgOptimizedImage,
  ],
})
export class ChampionshipsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);
  private injector = inject(Injector);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  StateColors = StateColors;
  environment = environment;
  title = signal('Championships');
  description = signal('');
  loadingContent = signal(true);
  loadingChampionships = signal(true);
  championships = signal<Championship[] | undefined>(undefined);
  selectedChampionship = signal<Championship | undefined>(undefined);
  championshipId = input<string>();
  subText1 = signal('');
  subscriptions: Subscription = new Subscription();

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedChampionship,
    basePaneColor: Colors.blue,
    selectColor: (c: Championship) => StateColors[c.state],
  });

  ngOnInit(): void {
    // sets up main color for the championships page
    this.themeService.setMainPaneColor(Colors.blue);

    // retrieve formats data from the CMS Championships Page
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<ChampionshipsPageSkeleton>(ContentfulEntryId.championships)
        .subscribe({
          next: (res) => {
            this.title.set(res.fields.title);
            this.description.set(res.fields.description ?? '');
            this.subText1.set(res.fields.subText1 ?? '');
            this.loadingContent.set(false);
          },
          error: (err) => {
            console.error('Failed to load the championships page content from Contentful:', err);
            this.loadingContent.set(false);
          },
        }),
    );

    // retrieve, sorts, and formats the championships list from the CMS Championships
    this.subscriptions.add(
      this.contentful
        .getContentfulGroup<ChampionshipSkeleton>(ContentfulContentType.championships)
        .subscribe({
          next: (res) => {
            const unsortedChampionships = res.items.map((championship) => {
              // Note: the list thumbnail crops this into a square box via CSS
              // `object-fit: cover, which is only correct because every logo
              // asset uploaded to Contentful is a square. If
              // NgOptimizedImage's NG02952 aspect-ratio-mismatch warning
              // reappears for a logo here, that's not a code bug to fix - it
              // means a genuinely non-square logo was uploaded and needs to be
              // re-cropped/padded to a square in Contentful.
              const logo = resolvedAsset(championship.fields.logo);
              const logoSize = scaleToDisplaySize(
                logo?.fields.file?.details?.image?.width,
                logo?.fields.file?.details?.image?.height,
                160,
              );
              return {
                ...championship.fields,
                championshipType: championship.fields.championshipType || 'Southeast',
                logo: logo?.fields.file?.url,
                logoAlt: logo?.fields.description ?? '',
                logoWidth: logoSize.width,
                logoHeight: logoSize.height,
                images: (championship.fields.images ?? [])
                  .map((image) => resolvedAsset(image))
                  .filter((asset): asset is NonNullable<typeof asset> => !!asset?.fields.file?.url)
                  .map((asset) => ({
                    path: asset.fields.file!.url,
                    alt: asset.fields.description ?? '',
                  })),
                state: stateAbbreviationFromCity(championship.fields.cityState),
                champions: (championship.fields.champions ?? [])
                  .map((champion) => resolvedEntry<ChampionSkeleton>(champion)?.fields)
                  .filter((fields): fields is NonNullable<typeof fields> => !!fields),
              };
            });
            const championships = this.groupAndSortChampionships(unsortedChampionships);
            this.championships.set(championships);
            if (this.championshipId()) {
              const foundChampionship = championships.find(
                (championship) => championship.id === this.championshipId(),
              );
              if (foundChampionship) {
                this.selectChampionship(foundChampionship);
              } else {
                this.location.replaceState('/championships');
              }
            }
            this.loadingChampionships.set(false);
          },
          error: (err) => {
            console.error('Failed to load the championships list from Contentful:', err);
            this.loadingChampionships.set(false);
          },
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Groups championships by championshipType (Southeast first, then each
  // state alphabetically), sorting by year descending within each group
  groupAndSortChampionships(championships: Championship[]): Championship[] {
    const typeOrder = [
      'Southeast',
      ...Array.from(new Set(championships.map((championship) => championship.championshipType)))
        .filter((type) => type !== 'Southeast')
        .sort((a, b) => a.localeCompare(b)),
    ];
    return [...championships].sort((a, b) => {
      const groupDiff =
        typeOrder.indexOf(a.championshipType) - typeOrder.indexOf(b.championshipType);
      return groupDiff !== 0 ? groupDiff : b.year - a.year;
    });
  }

  // sets a championship as the selected Championship to drill details
  selectChampionship(championship: Championship) {
    this.selectItemService.select(championship, {
      selectedSignal: this.selectedChampionship,
      isSelected: (c) => this.selectedChampionship()?.name === c.name,
      elementId: (c) => c.id,
      basePaneColor: Colors.blue,
      selectColor: (c) => StateColors[c.state],
      updateUrl: () =>
        this.location.replaceState(
          buildDetailUrl('/championships', this.selectedChampionship()?.id),
        ),
    });

    if (!this.isMobile() && this.selectedChampionship()?.id === championship.id) {
      scrollIntoViewSafely(championship.id, this.injector);
    }
  }
}
