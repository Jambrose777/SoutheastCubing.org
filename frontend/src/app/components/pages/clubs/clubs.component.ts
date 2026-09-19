import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  Injector,
  signal,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ClubSkeleton, ClubsPageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { resolvedAsset, resolvedEntry } from 'src/app/shared/contentful-links';
import { scrollIntoViewSafely } from 'src/app/shared/scroll-into-view-safely';
import { stateAbbreviationFromCity } from 'src/app/shared/state-abbreviation-from-city';
import { SelectItemService } from 'src/app/services/select-item.service';
import { toggleFilterSelection } from 'src/app/shared/toggle-filter-selection';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { isPlainLeftClick } from 'src/app/shared/is-plain-left-click';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location, NgClass } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { MapPoint } from 'src/app/models/Map';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SeMapComponent } from '../../shared/se-map/se-map.component';
import { SeFilterMapComponent } from '../../shared/se-filter-map/se-filter-map.component';
import { SelectedClubComponent } from './selected-club/selected-club.component';
import { SeSearchBarComponent } from '../../shared/se-search-bar/se-search-bar.component';
import { matchesSearchTerm } from 'src/app/shared/matches-search-term';
import { BreakStateOntoNewLinePipe } from 'src/app/pipes/breakStateOntoNewLine.pipe';

@Component({
  selector: 'se-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SeMapComponent,
    SeFilterMapComponent,
    SelectedClubComponent,
    NgClass,
    SeSearchBarComponent,
    BreakStateOntoNewLinePipe,
    RouterLink,
  ],
})
export class ClubsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private injector = inject(Injector);
  private themeService = inject(ThemeService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  StateColors = StateColors;
  environment = environment;
  title = signal('Southeast Clubs');
  description = signal('');
  loadingContent = signal(true);
  loadingClubs = signal(true);
  clubs = signal<Club[] | undefined>(undefined);
  filteredClubs = signal<Club[] | undefined>(undefined);
  selectedClub = signal<Club | undefined>(undefined);
  clubId = input<string>();
  subText1 = signal('');
  subText1ButtonText = signal('');
  subText1ButtonLink = signal('');
  subText2 = signal('');
  subText2ButtonText = signal('');
  subText2ButtonLink = signal('');
  filters = signal<{ states: States[] }>({ states: [] });
  searchTerm = signal('');
  @ViewChild(SeSearchBarComponent) searchBar?: SeSearchBarComponent;
  // Set only from click/mouseover events originating in this component's own
  // template (or a child's output binding in that template), which already
  // trigger OnPush change detection on their own, so these stay as plain
  // fields instead of signals.
  hoveredMapClub?: string;
  hoveredListClub?: string;
  clubMapPoints = signal<MapPoint[] | undefined>(undefined);
  filtersDescription = signal<string | undefined>(undefined);
  filtersOpen = signal(false);
  subscriptions: Subscription = new Subscription();
  buildDetailUrl = buildDetailUrl;

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedClub,
    basePaneColor: Colors.purple,
    selectColor: (c: Club) => StateColors[c.state ?? '??'],
  });

  ngOnInit(): void {
    // sets up main color for the clubs page
    this.themeService.setMainPaneColor(Colors.purple);

    // collect filters from query params
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        if (params['states']) {
          const states = params['states']
            .split(',')
            .filter((state: string) =>
              [
                'Alabama',
                'Florida',
                'Georgia',
                'North Carolina',
                'South Carolina',
                'Tennessee',
              ].includes(state),
            );
          this.filters.set({ states });
        }
        if (params['search']) {
          this.searchTerm.set(params['search']);
        }
      }),
    );

    // retrieve formats data from the CMS Clubs Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry<ClubsPageSkeleton>(ContentfulEntryId.clubs).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description ?? '');
          this.subText1.set(res.fields.subText1 ?? '');
          this.subText1ButtonText.set(res.fields.subText1ButtonText ?? '');
          this.subText1ButtonLink.set(res.fields.subText1ButtonLink ?? '');
          this.subText2.set(res.fields.subText2 ?? '');
          this.subText2ButtonText.set(res.fields.subText2ButtonText ?? '');
          this.subText2ButtonLink.set(res.fields.subText2ButtonLink ?? '');
          this.filtersDescription.set(resolvedEntry(res.fields.subTopics?.[0])?.fields.description);
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the clubs page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );

    // retrieve, sorts, and formats the clubs list from the CMS Clubs
    this.subscriptions.add(
      this.contentful.getContentfulGroup<ClubSkeleton>(ContentfulContentType.clubs).subscribe({
        next: (res) => {
          const clubs = res.items
            .map((club) => {
              const image = resolvedAsset(club.fields.image);
              const imageSize = scaleToDisplaySize(
                image?.fields.file?.details?.image?.width,
                image?.fields.file?.details?.image?.height,
              );
              return {
                ...club.fields,
                image: image?.fields.file?.url,
                imageAlt: image?.fields.description ?? '',
                imageWidth: imageSize.width,
                imageHeight: imageSize.height,
                state: club.fields?.city ? stateAbbreviationFromCity(club.fields.city) : undefined,
              };
            })
            .sort((a: Club, b: Club) =>
              a.city == b.city ? (a.name > b.name ? 1 : -1) : a.city > b.city ? 1 : -1,
            );
          this.clubs.set(clubs);
          this.filterClubs();
          if (this.clubId()) {
            const foundClub = clubs.find((comp) => comp.id === this.clubId());
            if (foundClub) {
              this.selectClub(foundClub);
            } else {
              this.updateUrl();
            }
          }
          this.loadingClubs.set(false);
        },
        error: (err) => {
          console.error('Failed to load the clubs list from Contentful:', err);
          this.loadingClubs.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // close Filters
    this.filtersOpen.set(false);

    this.selectItemService.select(club, {
      selectedSignal: this.selectedClub,
      isSelected: (c) => this.selectedClub()?.id === c.id,
      elementId: (c) => c.id,
      basePaneColor: Colors.purple,
      selectColor: (c) => StateColors[c.state ?? '??'],
      updateUrl: () => this.updateUrl(),
    });
  }

  // A plain left click is intercepted here to keep the existing cheap in-place
  // selection instead of a full router navigation.
  onClubRowClick(event: MouseEvent, club: Club): void {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    this.selectClub(club);
  }

  // Adds a state to the filters
  handleStateSelection(state: States) {
    this.filters.set({
      states: toggleFilterSelection(this.filters().states, state, Object.keys(States).length),
    });

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToClubs();
    this.filterClubs();
  }

  // Filters Clubs in list according to filters
  filterClubs() {
    let filteredClubs = this.clubs();
    const filterStates = this.filters().states;
    if (filterStates.length > 0) {
      filteredClubs = filteredClubs?.filter(
        (club) =>
          club.state && filterStates.includes((States as Record<string, States>)[club.state]),
      );
    }
    filteredClubs = filteredClubs?.filter((club) =>
      matchesSearchTerm(this.searchTerm(), [club.name, club.city, club.state]),
    );
    this.filteredClubs.set(filteredClubs);

    this.createMapPoints();
  }

  // Updates URL to include filters
  updateUrl() {
    const selectedClub = this.selectedClub();
    const filterStates = this.filters().states;
    const queryParams = [];
    if (filterStates.length > 0) {
      queryParams.push('states=' + filterStates.join(','));
    }
    if (this.searchTerm().trim()) {
      queryParams.push('search=' + encodeURIComponent(this.searchTerm()));
    }
    this.location.replaceState(
      '/clubs' +
        (selectedClub ? '/' + selectedClub.id : '') +
        (queryParams.length > 0 ? '?' + queryParams.join('&') : ''),
    );
  }

  // Scrolls to the secondary pane on mobile
  scrollToClubs() {
    if (this.isMobile()) {
      scrollIntoViewSafely('club-list-container', this.injector);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.clubMapPoints.set(
      this.filteredClubs()
        ?.map((club) => ({
          id: club.id,
          name: club.name,
          lat: club.latitude,
          long: club.longitude,
        }))
        .filter(
          (club): club is { id: string; name: string; lat: number; long: number } =>
            !!club.lat && !!club.long,
        ),
    );
  }

  // handles hover event on map
  mapHoverEvent(clubId: string | undefined) {
    this.hoveredMapClub = clubId;

    // scroll club into view if not visible
    if (clubId) {
      scrollIntoViewSafely(clubId, this.injector, true);
    }
  }

  // handles click event on map to open club
  mapClickEvent(clubId: string) {
    const club = this.filteredClubs()?.find((club) => club.id === clubId);
    if (club) {
      this.selectClub(club);
    }
    // resets hovered event
    this.hoveredMapClub = '';
  }

  // hover event on club list
  clubHover(club?: Club) {
    this.hoveredListClub = club?.id;
  }

  // Called (already debounced) by the search bar.
  handleSearchChange(term: string) {
    this.searchTerm.set(term);
    this.updateUrl();
    this.filterClubs();
  }

  // Clears every active filter (states and the search term) in one action,
  // plus whatever club is currently selected.
  clearFilters() {
    this.filters.set({ states: [] });
    this.searchTerm.set('');
    this.searchBar?.clear();
    this.updateUrl();
    this.filterClubs();

    if (this.selectedClub()) {
      this.selectedClub.set(undefined);
      this.themeService.setMainPaneColor(Colors.purple);
      this.updateUrl();
    }
  }

  // toggles whether the filters pane is open or not
  toggleFiltersOpen() {
    this.filtersOpen.update((open) => !open);

    if (this.filtersOpen()) {
      // scroll to top on mobile
      document.getElementById('header')?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected club on filter changes
      if (this.selectedClub()) {
        this.selectedClub.set(undefined);
        this.themeService.setMainPaneColor(Colors.purple);
        this.updateUrl();
      }
    }
  }
}
