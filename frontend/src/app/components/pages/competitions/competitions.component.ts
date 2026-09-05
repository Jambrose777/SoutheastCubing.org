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
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, Events, RegistrationStatus, StateColors, States } from 'src/app/shared/types';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { NavService } from 'src/app/services/nav.service';
import { environment } from 'src/environments/environment';
import { ActivatedRoute } from '@angular/router';
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
  ],
})
export class CompetitionsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private southeastcubingApiService = inject(SouteastcubingApiService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  StateColors = StateColors;
  environment = environment;
  title = signal('Competitions');
  description = signal('');
  competitions = signal<Competition[]>([]);
  filteredCompetitions = signal<Competition[]>([]);
  loadingContent = signal(true);
  loadingCompetitions = signal(true);
  selectedCompetition = signal<Competition>(undefined);
  competitionId = input<string>();
  // Set only from click/mouseover events originating in this component's own
  // template (or a child's output binding in that template), which already
  // trigger OnPush change detection on their own, so these stay as plain
  // fields instead of signals.
  hoveredMapCompetition: string;
  hoveredListCompetition: string;
  subText = signal('');
  filters = signal<{ states: States[]; events: string[] }>({ states: [], events: [] });
  filtersDescription = signal<string>(undefined);
  filtersOpen = signal(false);
  competitionMapPoints = signal<MapPoint[]>(undefined);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.darkGrey);

    // collect filters from query params
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        const currentFilters = this.filters();
        const states = params['states']
          ? params['states']
              .split(',')
              .filter((state) =>
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
          ? params['events'].split(',').filter((event) => Events.includes(event))
          : currentFilters.events;
        this.filters.set({ states, events });
      }),
    );

    // retireve and formats data from the CMS Competitions Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.competitions).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        this.subText.set(res.fields.subText1);
        this.filtersDescription.set(res.fields.subTopics[0]?.fields.description);
        this.loadingContent.set(false);
      }),
    );

    // retrieve the competitions list from WCA
    this.subscriptions.add(
      this.southeastcubingApiService.getUpcomingCompetitions().subscribe((res) => {
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
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a competition to drill in details on
  selectCompetition(competition: Competition) {
    // close Nav
    this.navService.closeNav();

    // close Filters
    this.filtersOpen.set(false);

    // Check if clicking an active competition, and delselect the competition if so.
    if (this.selectedCompetition()?.name === competition.name) {
      this.selectedCompetition.set(undefined);
      this.themeService.setMainPaneColor(Colors.darkGrey); //resets left pane
      this.updateUrl();
    } else {
      this.selectedCompetition.set(competition);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[competition.state]);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(competition.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.updateUrl();
    }
  }
  // Adds a state to the filters
  handleStateSelection(state: States) {
    const currentFilters = this.filters();
    // If the state is already filtered on, remove it from the filters
    let states = currentFilters.states.includes(state)
      ? currentFilters.states.filter((filteredState) => filteredState !== state)
      : [...currentFilters.states, state];

    // If filters are all full, remove them (same condition)
    if (states.length === 6) {
      states = [];
    }
    this.filters.set({ ...currentFilters, states });

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToCompetitions();
    this.filterCompetitions();
  }

  // Adds an event to the filters
  handleEventSelection(event: string) {
    const currentFilters = this.filters();
    // If the event is already filtered on, remove it from the filters
    let events = currentFilters.events.includes(event)
      ? currentFilters.events.filter((filteredEvent) => filteredEvent !== event)
      : [...currentFilters.events, event];

    // If filters are all full, remove them (same condition)
    if (events.length === 17) {
      events = [];
    }
    this.filters.set({ ...currentFilters, events });

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
    this.location.replaceState(
      '/competitions' +
        (selectedCompetition ? '/' + selectedCompetition.id : '') +
        (queryParams.length > 0 ? '?' + queryParams.join('&') : ''),
    );
  }

  // Scrolls to the secondary pane on mobile
  scrollToCompetitions() {
    if (this.isMobile()) {
      setTimeout(() => {
        document
          .getElementById('competition-list-container')
          ?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.competitionMapPoints.set(
      this.filteredCompetitions().map((competition) => ({
        id: competition.id,
        lat: competition.latitude_degrees,
        long: competition.longitude_degrees,
        colorClass: this.getRegistrationColor(competition.registration_status),
      })),
    );
  }

  // gets map marker color based on registration status
  getRegistrationColor(status: RegistrationStatus): MarkerColorClass {
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
  mapHoverEvent(competitionId: string) {
    this.hoveredMapCompetition = competitionId;

    // scroll competition into view if not visible
    setTimeout(() => {
      const target = document.getElementById(competitionId);
      if (
        target &&
        (target.getBoundingClientRect().bottom > window.innerHeight ||
          target.getBoundingClientRect().top < 0)
      ) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  }

  // handles click event on map to open competition
  mapClickEvent(competitionId: string) {
    const competition = this.filteredCompetitions().find(
      (competition) => competition.id === competitionId,
    );
    this.selectCompetition(competition);

    // resets hovered event
    this.hoveredMapCompetition = '';
  }

  // hover event on competition list
  competitionHover(competition?: Competition) {
    this.hoveredListCompetition = competition?.id;
  }

  // toggles whether the filters pane is open or not
  toggleFiltersOpen() {
    this.filtersOpen.update((open) => !open);

    if (this.filtersOpen()) {
      // scroll to top on mobile
      document.getElementById('header')?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected competition on filter changes
      if (this.selectedCompetition()) {
        this.selectCompetition(this.selectedCompetition());
      }
    }
  }
}
