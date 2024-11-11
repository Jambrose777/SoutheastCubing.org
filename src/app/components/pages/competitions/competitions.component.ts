import { Component, OnDestroy, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, Events, RegistrationStatus, StateColors, States } from 'src/app/shared/types';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { NavService } from 'src/app/services/nav.service';
import { environment } from 'src/environments/environment';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { SouteastcubingApiService } from 'src/app/services/souteastcubing-api.service';
import { MapPoint, MarkerColorClass } from 'src/app/models/Map';

@Component({
  selector: 'se-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss']
})
export class CompetitionsComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  StateColors = StateColors;
  environment = environment;
  title: string = 'Competitions';
  description: string = '';
  competitions: Competition[] = [];
  filteredCompetitions: Competition[] = [];
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;
  selectedCompetition: Competition;
  selectedCompetitionIdFromRoute: string;
  hoveredMapCompetition: string;
  hoveredListCompetition: string;
  subText: string = '';
  filters = {
    states: [],
    events: [],
  };
  filtersDescription: string;
  filtersOpen: boolean = false;
  competitionMapPoints: MapPoint[];
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
    private southeastcubingApiService: SouteastcubingApiService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location,
    private screenSizeService: ScreenSizeService,
    public linksService: LinksService,
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.darkGrey);

    // collect competitionId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedCompetitionIdFromRoute = params['competitionId'];
    }));

    // collect filters from query params
    this.subscriptions.add(this.route.queryParams.subscribe(params => {
      if (params['states']) {
        this.filters.states = params['states']
          .split(",")
          .filter(state => ["Alabama", "Florida", "Georgia", "North Carolina", "South Carolina", "Tennessee"].includes(state));
      }
      if (params['events']) {
        this.filters.events = params['events']
          .split(",")
          .filter(event => Events.includes(event));
      }
    }));

    // retireve and formats data from the CMS Competitions Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.competitions).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText = res.fields.subText1;
      this.filtersDescription = res.fields.subTopics[0]?.fields.description;
      this.loadingContent = false;
    }));

    // retrieve the competitions list from WCA
    this.subscriptions.add(this.southeastcubingApiService.getUpcomingCompetitions().subscribe(res => {
      this.competitions = res;
      this.filteredCompetitions = res;
      this.filterCompetitions();
      if (this.selectedCompetitionIdFromRoute) {
        let foundCompetition = this.competitions.find(comp => comp.id === this.selectedCompetitionIdFromRoute);
        if (foundCompetition) {
          this.selectCompetition(foundCompetition);
        } else {
          this.updateUrl();
        }
      }
      this.loadingCompetitions = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a competition to drill in details on
  selectCompetition(competition: Competition) {
    // close Nav
    this.navService.closeNav();

    // close Filters
    this.filtersOpen = false;

    // Check if clicking an active competition, and delselect the competition if so.
    if (this.selectedCompetition?.name === competition.name) {
      this.selectedCompetition = undefined;
      this.themeService.setMainPaneColor(Colors.darkGrey); //resets left pane
      this.updateUrl();
    } else {
      this.selectedCompetition = competition;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[this.selectedCompetition.state]);

        //scroll to top of main pane
        document.getElementById("header")?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedCompetition.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.updateUrl();
    }
  }
  // Adds a state to the filters
  handleStateSelection(state: States) {
    // If the state is already filtered on, remove it from the filters
    if (this.filters.states.includes(state)) {
      this.filters.states.splice(this.filters.states.indexOf(state), 1);
    } else {
      this.filters.states.push(state);
    }

    // If filters are all full, remove them (same condition)
    if (this.filters.states.length === 6) {
      this.filters.states = [];
    }

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToCompetitions();
    this.filterCompetitions();
  }

  // Adds an event to the filters
  handleEventSelection(event: string) {
    // If the event is already filtered on, remove it from the filters
    if (this.filters.events.includes(event)) {
      this.filters.events.splice(this.filters.events.indexOf(event), 1);
    } else {
      this.filters.events.push(event);
    }

    // If filters are all full, remove them (same condition)
    if (this.filters.events.length === 17) {
      this.filters.events = [];
    }

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToCompetitions();
    this.filterCompetitions();
  }

  // Filters Competitions in list according to filters
  filterCompetitions() {
    this.filteredCompetitions = this.competitions;
    if (this.filters.states.length > 0) {
      this.filteredCompetitions = this.filteredCompetitions.filter(comp => this.filters.states.includes(comp.state));
    }
    if (this.filters.events.length > 0) {
      this.filteredCompetitions = this.filteredCompetitions.filter(comp => this.filters.events.reduce((include, event) => include && comp.event_ids.includes(event), true));
    }

    this.createMapPoints();
  }

  // Updates URL to include filters
  updateUrl() {
    let queryParams = [];
    if (this.filters.states.length > 0) {
      queryParams.push("states=" + this.filters.states.join(","));
    }
    if (this.filters.events.length > 0) {
      queryParams.push("events=" + this.filters.events.join(","));
    }
    this.location.replaceState('/competitions' +
      (this.selectedCompetition ? '/' + this.selectedCompetition.id : '') +
      (queryParams.length > 0 ? '?' + queryParams.join("&") : ''));
  }

  // Scrolls to the secondary pane on mobile
  scrollToCompetitions() {
    if (this.isMobile) {
      setTimeout(() => {
        document.getElementById('competition-list-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.competitionMapPoints = this.filteredCompetitions.map(competition => ({
      id: competition.id,
      lat: competition.latitude_degrees,
      long: competition.longitude_degrees,
      colorClass: this.getRegistrationColor(competition.registration_status)
    }));
  }

  // gets map marker color based on registration status
  getRegistrationColor(status: RegistrationStatus): MarkerColorClass {
    if(status === RegistrationStatus.closed) {
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
  }

  // handles click event on map to open competition
  mapClickEvent(competitionId: string) {
    const competition = this.filteredCompetitions.find(competition => competition.id === competitionId);
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
    this.filtersOpen = !this.filtersOpen;

    if (this.filtersOpen) {
      // scroll to top on mobile
      document.getElementById("header")?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected competition on filter changes
      if (this.selectedCompetition) {
        this.selectCompetition(this.selectedCompetition);
      }
    }
  }

}
