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
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, Events, RegistrationStatus, StateColors, States } from 'src/app/shared/types';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { CompetitionsPageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { resolvedEntry } from 'src/app/shared/contentful-links';
import { scrollIntoViewSafely } from 'src/app/shared/scroll-into-view-safely';
import { SelectItemService } from 'src/app/services/select-item.service';
import { toggleFilterSelection } from 'src/app/shared/toggle-filter-selection';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { isPlainLeftClick } from 'src/app/shared/is-plain-left-click';
import { environment } from 'src/environments/environment';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Location, NgClass } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { SouteastcubingApiService } from 'src/app/services/souteastcubing-api.service';
import { MapPoint, MarkerColorClass } from 'src/app/models/Map';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SeMapComponent } from '../../shared/se-map/se-map.component';
import { EventListComponent } from '../../shared/event-list/event-list.component';
import { SeFilterMapComponent } from '../../shared/se-filter-map/se-filter-map.component';
import { SelectedCompetitionComponent } from './selected-competition/selected-competition.component';
import { StripYearPipe } from 'src/app/pipes/stripYear.pipe';
import { BreakYearOntoNewLinePipe } from 'src/app/pipes/breakYearOntoNewLine.pipe';
import { SeSearchBarComponent } from '../../shared/se-search-bar/se-search-bar.component';
import { matchesSearchTerm } from 'src/app/shared/matches-search-term';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'se-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SeMapComponent,
    EventListComponent,
    SeFilterMapComponent,
    SelectedCompetitionComponent,
    NgClass,
    StripYearPipe,
    BreakYearOntoNewLinePipe,
    SeSearchBarComponent,
    RouterLink,
    MatTooltipModule,
  ],
})
export class CompetitionsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private injector = inject(Injector);
  private southeastcubingApiService = inject(SouteastcubingApiService);
  private themeService = inject(ThemeService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  StateColors = StateColors;
  environment = environment;
  title = signal('Competitions');
  description = signal('');
  competitions = signal<Competition[]>([]);
  filteredCompetitions = signal<Competition[]>([]);
  loadingContent = signal(true);
  loadingCompetitions = signal(true);
  competitionsError = signal(false);
  selectedCompetition = signal<Competition | undefined>(undefined);
  competitionId = input<string>();
  // Set only from click/mouseover events originating in this component's own
  // template (or a child's output binding in that template), which already
  // trigger OnPush change detection on their own, so these stay as plain
  // fields instead of signals.
  hoveredMapCompetition?: string;
  hoveredListCompetition?: string;
  subText = signal('');
  filters = signal<{ states: States[]; events: string[] }>({ states: [], events: [] });
  searchTerm = signal('');
  @ViewChild(SeSearchBarComponent) searchBar?: SeSearchBarComponent;
  filtersDescription = signal<string | undefined>(undefined);
  filtersOpen = signal(false);
  competitionMapPoints = signal<MapPoint[] | undefined>(undefined);
  subscriptions: Subscription = new Subscription();
  buildDetailUrl = buildDetailUrl;

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedCompetition,
    basePaneColor: Colors.grey,
    selectColor: (c: Competition) => StateColors[c.state ?? '??'],
  });

  ngOnInit(): void {
    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.grey);

    // collect filters from query params
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        const currentFilters = this.filters();
        const states = params['states']
          ? params['states']
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
              )
          : currentFilters.states;
        const events = params['events']
          ? params['events'].split(',').filter((event: string) => Events.includes(event))
          : currentFilters.events;
        this.filters.set({ states, events });
        this.searchTerm.set(params['search'] ?? this.searchTerm());
      }),
    );

    // retrieve and formats data from the CMS Competitions Page
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<CompetitionsPageSkeleton>(ContentfulEntryId.competitions)
        .subscribe({
          next: (res) => {
            this.title.set(res.fields.title);
            this.description.set(res.fields.description ?? '');
            this.subText.set(res.fields.subText1 ?? '');
            this.filtersDescription.set(
              resolvedEntry(res.fields.subTopics?.[0])?.fields.description,
            );
            this.loadingContent.set(false);
          },
          error: (err) => {
            console.error('Failed to load the competitions page content from Contentful:', err);
            this.loadingContent.set(false);
          },
        }),
    );

    // retrieve the competitions list from WCA
    this.subscriptions.add(
      this.southeastcubingApiService.getUpcomingCompetitions().subscribe({
        next: (res) => {
          this.competitions.set(res);
          this.filteredCompetitions.set(res);
          this.filterCompetitions();
          if (this.competitionId()) {
            const foundCompetition = res.find((comp) => comp.id === this.competitionId());
            if (foundCompetition) {
              this.selectCompetition(foundCompetition);
            } else {
              this.updateUrl();
            }
          }
          this.loadingCompetitions.set(false);
        },
        error: (err) => {
          console.error('Failed to load the upcoming competitions list:', err);
          this.competitionsError.set(true);
          this.loadingCompetitions.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a competition to drill in details on
  selectCompetition(competition: Competition) {
    // close Filters
    this.filtersOpen.set(false);

    this.selectItemService.select(competition, {
      selectedSignal: this.selectedCompetition,
      isSelected: (c) => this.selectedCompetition()?.name === c.name,
      elementId: (c) => c.id,
      basePaneColor: Colors.grey,
      selectColor: (c) => StateColors[c.state ?? '??'],
      updateUrl: () => this.updateUrl(),
    });
  }

  // A plain left click is intercepted here to keep the existing cheap in-place
  // selection instead of a full router navigation.
  onCompetitionRowClick(event: MouseEvent, competition: Competition): void {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    this.selectCompetition(competition);
  }

  // Adds a state to the filters
  handleStateSelection(state: States) {
    const currentFilters = this.filters();
    this.filters.set({
      ...currentFilters,
      states: toggleFilterSelection(currentFilters.states, state, Object.keys(States).length),
    });

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToCompetitions();
    this.filterCompetitions();
  }

  // Adds an event to the filters
  handleEventSelection(event: string) {
    const currentFilters = this.filters();
    this.filters.set({
      ...currentFilters,
      events: toggleFilterSelection(currentFilters.events, event, Events.length),
    });

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToCompetitions();
    this.filterCompetitions();
  }

  // Filters Competitions in list according to filters
  filterCompetitions() {
    const filters = this.filters();
    let filteredCompetitions = this.competitions();
    if (filters.states.length > 0) {
      filteredCompetitions = filteredCompetitions.filter((comp) =>
        filters.states.includes(comp.state as States),
      );
    }
    if (filters.events.length > 0) {
      filteredCompetitions = filteredCompetitions.filter((comp) =>
        filters.events.reduce((include, event) => include && comp.event_ids.includes(event), true),
      );
    }
    filteredCompetitions = filteredCompetitions.filter((comp) =>
      matchesSearchTerm(this.searchTerm(), [comp.name, comp.city, comp.state]),
    );
    this.filteredCompetitions.set(filteredCompetitions);

    this.createMapPoints();
  }

  // Updates URL to include filters
  updateUrl() {
    const filters = this.filters();
    const selectedCompetition = this.selectedCompetition();
    const queryParams = [];
    if (filters.states.length > 0) {
      queryParams.push('states=' + filters.states.join(','));
    }
    if (filters.events.length > 0) {
      queryParams.push('events=' + filters.events.join(','));
    }
    if (this.searchTerm().trim()) {
      queryParams.push('search=' + encodeURIComponent(this.searchTerm()));
    }
    this.location.replaceState(
      '/competitions' +
        (selectedCompetition ? '/' + selectedCompetition.id : '') +
        (queryParams.length > 0 ? '?' + queryParams.join('&') : ''),
    );
  }

  // Scrolls to the secondary pane on mobile
  scrollToCompetitions() {
    if (this.isMobile()) {
      scrollIntoViewSafely('competition-list-container', this.injector);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.competitionMapPoints.set(
      this.filteredCompetitions().map((competition) => ({
        id: competition.id,
        name: competition.name,
        lat: competition.latitude_degrees,
        long: competition.longitude_degrees,
        colorClass: this.getRegistrationColor(competition.registration_status),
      })),
    );
  }

  // gets map marker color based on registration status
  getRegistrationColor(status?: RegistrationStatus): MarkerColorClass {
    if (status === RegistrationStatus.closed) {
      return MarkerColorClass.red;
    } else if (status === RegistrationStatus.open || status === RegistrationStatus.openWithSpots) {
      return MarkerColorClass.green;
    } else if (status === RegistrationStatus.openWithWaitingList) {
      return MarkerColorClass.orange;
    } else {
      return MarkerColorClass.blue;
    }
  }

  // handles hover event on map
  mapHoverEvent(competitionId: string | undefined) {
    this.hoveredMapCompetition = competitionId;

    // scroll competition into view if not visible
    if (competitionId) {
      scrollIntoViewSafely(competitionId, this.injector, true);
    }
  }

  // handles click event on map to open competition
  mapClickEvent(competitionId: string) {
    const competition = this.filteredCompetitions().find(
      (competition) => competition.id === competitionId,
    );
    if (competition) {
      this.selectCompetition(competition);
    }

    // resets hovered event
    this.hoveredMapCompetition = '';
  }

  // hover event on competition list
  competitionHover(competition?: Competition) {
    this.hoveredListCompetition = competition?.id;
  }

  // Called (already debounced) by the search bar.
  handleSearchChange(term: string) {
    this.searchTerm.set(term);
    this.updateUrl();
    this.filterCompetitions();
  }

  // Clears every active filter (states, events, and the search term), plus
  // whatever competition is currently selected.
  clearFilters() {
    this.filters.set({ states: [], events: [] });
    this.searchTerm.set('');
    this.searchBar?.clear();
    this.updateUrl();
    this.filterCompetitions();

    if (this.selectedCompetition()) {
      this.selectedCompetition.set(undefined);
      this.themeService.setMainPaneColor(Colors.grey);
      this.updateUrl();
    }
  }

  // toggles whether the filters pane is open or not
  toggleFiltersOpen() {
    this.filtersOpen.update((open) => !open);

    if (this.filtersOpen()) {
      // scroll to top on mobile
      document.getElementById('header')?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected competition on filter changes
      if (this.selectedCompetition()) {
        this.selectedCompetition.set(undefined);
        this.themeService.setMainPaneColor(Colors.grey);
        this.updateUrl();
      }
    }
  }
}
