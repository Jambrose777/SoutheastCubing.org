import { Component, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, Events, RegistrationStatus, StateColors, States } from 'src/app/shared/types';
import { WcaService } from 'src/app/services/wca.service';
import { isMobile } from 'src/app/shared/functions';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { NavService } from 'src/app/services/nav.service';
import { environment } from 'src/environments/environment';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'se-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss']
})
export class CompetitionsComponent implements OnInit {
  isMobile = isMobile();
  StateColors = StateColors;
  enviroment = environment;
  title: string = 'Competitions';
  description: string = '';
  competitions: Competition[] = [];
  filteredCompetitions: Competition[] = [];
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;
  selectedCompetition: Competition;
  selectedCompetitionIdFromRoute: string;
  subText: string = '';
  filters = {
    states: [],
    events: [],
  }

  constructor(
    private contentful: ContentfulService,
    private wca: WcaService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location
  ) { }

  ngOnInit(): void {
    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.darkGrey);

    // collect competitionId from params
    this.route.params.subscribe(params => {
      this.selectedCompetitionIdFromRoute = params['competitionId'];
    });

    // collect filters from query params
    this.route.queryParams.subscribe(params => {
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
    });

    // retireve and formats data from the CMS Competitions Page
    this.contentful.getContentfulEntry(ContentfulEntryId.competitions).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText = res.fields.subText1;
      this.loadingContent = false;
    });

    // retrieve the competitions list from WCA
    this.wca.getUpcomingCompetitions().subscribe(res => {
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
    });
  }

  // selects a competition to drill in details on
  selectCompetition(competition: Competition) {
    // close Nav
    this.navService.closeNav();

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
      if (this.selectedCompetition.registration_status === RegistrationStatus.open) {
        // fetch the registration status when drilling into a competition
        this.findRegistrationOpenStatus();
      }
      this.updateUrl();
    }
  }

  // retrieves and sets the registration status for open registrations for the selected competition
  findRegistrationOpenStatus() {
    // fetch the number of accepted registrations from wca
    this.wca.getAcceptedRegistrations(this.selectedCompetition.id).subscribe(res => {
      this.selectedCompetition.accepted_registrations = res;
      // registration is full and has a waiting list if the competitor limit is = the accepted registrations, otherwise registration is still open.
      if (this.selectedCompetition.accepted_registrations >= this.selectedCompetition.competitor_limit) {
        this.selectedCompetition.registration_status = RegistrationStatus.openWithWaitingList;
      } else {
        this.selectedCompetition.registration_status = RegistrationStatus.openWithSpots;
      }

      // save newly aquired data to local storage to cache all responses from WCA.
      this.wca.saveCompetitionstoLocalStorage(this.competitions);
    })
  }

  handleStateSelection(state: States) {
    if (this.filters.states.includes(state)) {
      this.filters.states.splice(this.filters.states.indexOf(state), 1);
    } else {
      this.filters.states.push(state);
    }
    if (this.filters.states.length === 6) {
      this.filters.states = [];
    }

    this.updateUrl();
    this.filterCompetitions();
  }

  handleEventSelection(event: string) {
    if (this.filters.events.includes(event)) {
      this.filters.events.splice(this.filters.events.indexOf(event), 1);
    } else {
      this.filters.events.push(event);
    }
    if (this.filters.events.length === 17) {
      this.filters.events = [];
    }

    this.updateUrl();
    this.filterCompetitions();
  }

  filterCompetitions() {
    this.filteredCompetitions = this.competitions;
    if (this.filters.states.length > 0) {
      this.filteredCompetitions = this.filteredCompetitions.filter(comp => this.filters.states.includes(comp.state));
    }
    if (this.filters.events.length > 0) {
      this.filteredCompetitions = this.filteredCompetitions.filter(comp => this.filters.events.reduce((include, event) => include && comp.event_ids.includes(event), true));
    }
  }

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

}
