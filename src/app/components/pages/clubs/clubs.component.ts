import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location } from '@angular/common';

@Component({
  selector: 'se-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss']
})
export class ClubsComponent implements OnInit {
  isMobile = isMobile();
  StateColors = StateColors;
  enviroment = environment;
  title: string = 'Southeast Clubs';
  description: string = '';
  loadingContent: boolean = true;
  loadingClubs: boolean = true;
  clubs: Club[];
  fliteredClubs: Club[];
  selectedClub: Club;
  selectedClubIdFromRoute: string;
  subText1: string = '';
  subText2: string = '';
  filters = {
    states: [],
  }

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location,
  ) { }

  ngOnInit(): void {
    // sets up main color for the clubs page
    this.themeService.setMainPaneColor(Colors.purple);

    // collect competitionId from params
    this.route.params.subscribe(params => {
      this.selectedClubIdFromRoute = params['clubId'];
    });

    // collect filters from query params
    this.route.queryParams.subscribe(params => {
      if (params['states']) {
        this.filters.states = params['states']
          .split(",")
          .filter(state => ["Alabama", "Florida", "Georgia", "North Carolina", "South Carolina", "Tennessee"].includes(state));
      }
    });

    // retireve formats data from the CMS Clubs Page
    this.contentful.getContentfulEntry(ContentfulEntryId.clubs).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.subText2 = res.fields.subText2;
      this.loadingContent = false;
    });

    // retrieve, sorts, and formats the clubs list from the CMS Clubs
    this.contentful.getContentfulGroup(ContentfulContentType.clubs).subscribe(res => {
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
    });
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // close Nav
    this.navService.closeNav();

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
          document.getElementById(this.selectedClub.name + this.selectedClub.city)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.updateUrl();
    }
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
    this.filterClubs();
  }

  filterClubs() {
    this.fliteredClubs = this.clubs;
    if (this.filters.states.length > 0) {
      this.fliteredClubs = this.fliteredClubs.filter(club => this.filters.states.includes(States[club.state]));
    }
  }

  updateUrl() {
    this.location.replaceState('/clubs' +
      (this.selectedClub ? '/' + this.selectedClub.id : '') +
      (this.filters.states.length > 0 ? '?states=' + this.filters.states.join(",") : ''));
  }

}
