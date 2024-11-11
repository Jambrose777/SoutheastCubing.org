import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { MapPoint } from 'src/app/models/Map';

@Component({
  selector: 'se-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss']
})
export class ClubsComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  StateColors = StateColors;
  enviroment = environment;
  title: string = 'Southeast Clubs';
  description: string = '';
  loadingContent: boolean = true;
  loadingClubs: boolean = true;
  clubs: Club[];
  filteredClubs: Club[];
  selectedClub: Club;
  selectedClubIdFromRoute: string;
  subText1: string = '';
  subText1ButtonText: string = '';
  subText1ButtonLink: string = '';
  subText2: string = '';
  subText2ButtonText: string = '';
  subText2ButtonLink: string = '';
  filters = {
    states: [],
  };
  hoveredMapClub: string;
  hoveredListClub: string;
  clubMapPoints: MapPoint[];
  filtersDescription: string;
  filtersOpen: boolean = false;
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
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

    // sets up main color for the clubs page
    this.themeService.setMainPaneColor(Colors.purple);

    // collect competitionId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedClubIdFromRoute = params['clubId'];
    }));

    // collect filters from query params
    this.subscriptions.add(this.route.queryParams.subscribe(params => {
      if (params['states']) {
        this.filters.states = params['states']
          .split(",")
          .filter(state => ["Alabama", "Florida", "Georgia", "North Carolina", "South Carolina", "Tennessee"].includes(state));
      }
    }));

    // retireve formats data from the CMS Clubs Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.clubs).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.subText1ButtonText = res.fields.subText1ButtonText;
      this.subText1ButtonLink = res.fields.subText1ButtonLink;
      this.subText2 = res.fields.subText2;
      this.subText2ButtonText = res.fields.subText2ButtonText;
      this.subText2ButtonLink = res.fields.subText2ButtonLink;
      this.filtersDescription = res.fields.subTopics[0]?.fields.description;
      this.loadingContent = false;
    }));

    // retrieve, sorts, and formats the clubs list from the CMS Clubs
    this.subscriptions.add(this.contentful.getContentfulGroup(ContentfulContentType.clubs).subscribe(res => {
      this.clubs = res.items
        .map(club => ({ ...club.fields, image: club.fields.image?.fields.file.url, state: club.fields?.city.substring(club.fields?.city.length - 2) }))
        .sort((a: Club, b: Club) => a.city == b.city ? (a.name > b.name ? 1 : -1) : (a.city > b.city ? 1 : -1));
      this.filterClubs();
      if (this.selectedClubIdFromRoute) {
        let foundClub = this.clubs.find(comp => comp.id === this.selectedClubIdFromRoute);
        if (foundClub) {
          this.selectClub(foundClub);
        } else {
          this.updateUrl();
        }
      }
      this.loadingClubs = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // close Nav
    this.navService.closeNav();

    // close Filters
    this.filtersOpen = false;

    // deselect a club if it is already selected
    if (this.selectedClub?.id === club.id) {
      this.selectedClub = undefined;
      this.themeService.setMainPaneColor(Colors.purple);
      this.updateUrl();
    } else {
      this.selectedClub = club;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[this.selectedClub.state]);

        //scroll to top of main pane
        document.getElementById("header")?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedClub.id)?.scrollIntoView({ behavior: 'smooth' });
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
    this.scrollToClubs();
    this.filterClubs();
  }

  // Filters Clubs in list according to filters
  filterClubs() {
    this.filteredClubs = this.clubs;
    if (this.filters.states.length > 0) {
      this.filteredClubs = this.filteredClubs.filter(club => this.filters.states.includes(States[club.state]));
    }

    this.createMapPoints();
  }

  // Updates URL to include filters
  updateUrl() {
    this.location.replaceState('/clubs' +
      (this.selectedClub ? '/' + this.selectedClub.id : '') +
      (this.filters.states.length > 0 ? '?states=' + this.filters.states.join(",") : ''));
  }

  // Scrolls to the secondary pane on mobile
  scrollToClubs() {
    if(this.isMobile) {
      setTimeout(() => {
        document.getElementById('club-list-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.clubMapPoints = this.filteredClubs.map(club => ({
      id: club.id,
      lat: club.latitude,
      long: club.longitude,
    })).filter(club => club.lat && club.long);
  }

  // handles hover event on map
  mapHoverEvent(clubId: string) {
    this.hoveredMapClub = clubId;

    // scroll club into view if not visible
    setTimeout(() => {
      const target = document.getElementById(clubId);
      if (target && (target.getBoundingClientRect().bottom > window.innerHeight || target.getBoundingClientRect().top < 0)) {
          target.scrollIntoView({ behavior: 'smooth' })
      }
    }, 0);
  }
  
  // handles click event on map to open club
  mapClickEvent(clubId: string) {
    const club = this.filteredClubs.find(club => club.id === clubId);
    this.selectClub(club);
    // resets hovered event
    this.hoveredMapClub = '';
  }

  // hover event on club list
  clubHover(club?: Club) {
    this.hoveredListClub = club?.id;
  }

  // toggles whether the filters pane is open or not
  toggleFiltersOpen() {
    this.filtersOpen = !this.filtersOpen;

    if (this.filtersOpen) {
      // scroll to top on mobile
      document.getElementById("header")?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected club on filter changes
      if (this.selectedClub) {
        this.selectClub(this.selectedClub);
      }
    }
  }

}
