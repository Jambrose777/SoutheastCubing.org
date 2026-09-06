import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Championship } from 'src/app/models/Championship';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
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
  private navService = inject(NavService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  StateColors = StateColors;
  enviroment = environment;
  title = signal('Southeast Championship');
  description = signal('');
  loadingContent = signal(true);
  loadingChampionships = signal(true);
  championships = signal<Championship[]>(undefined);
  selectedChampionship = signal<Championship>(undefined);
  championshipId = input<string>();
  subText1 = signal('');
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the championships page
    this.themeService.setMainPaneColor(Colors.blue);

    // retireve formats data from the CMS Championships Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.championships).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        this.subText1.set(res.fields.subText1);
        this.loadingContent.set(false);
      }),
    );

    // retrieve, sorts, and formats the championships list from the CMS Championships
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.championships).subscribe((res) => {
        const championships = res.items
          .map((championship) => {
            // Note: the list thumbnail crops this into a square box via CSS
            // `object-fit: cover, which is only correct because every logo
            // asset uploaded to Contentful is a square. If
            // NgOptimizedImage's NG02952 aspect-ratio-mismatch warning
            // reappears for a logo here, that's not a code bug to fix - it
            // means a genuinely non-square logo was uploaded and needs to be
            // re-cropped/padded to a square in Contentful.
            const logoSize = scaleToDisplaySize(
              championship.fields.logo?.fields.file.details?.image?.width,
              championship.fields.logo?.fields.file.details?.image?.height,
              160,
            );
            return {
              ...championship.fields,
              logo: championship.fields.logo?.fields.file.url,
              logoWidth: logoSize.width,
              logoHeight: logoSize.height,
              images: championship.fields.images?.map((image) => ({
                path: image.fields.file.url,
              })),
              state: championship.fields?.city.substring(championship.fields?.city.length - 2),
              champions: championship.fields.champions?.map((champion) => ({
                ...champion.fields,
              })),
            };
          })
          .sort((a: Championship, b: Championship) => (a.year < b.year ? 1 : -1));
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
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a championship as the selected Championship to drill details
  selectChampionship(championship: Championship) {
    // close Nav
    this.navService.closeNav();

    // deselect a championship if it is already selected
    if (this.selectedChampionship()?.name === championship.name) {
      this.selectedChampionship.set(undefined);
      this.themeService.setMainPaneColor(Colors.blue);
      this.location.replaceState('/championships');
    } else {
      this.selectedChampionship.set(championship);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[championship.state]);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(championship.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/championships/' + championship.id);
    }
  }
}
