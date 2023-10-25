import { Component, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';

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
  subText1: string = '';
  subText2: string = '';
  filters = {
    states: [],
  }

  constructor(private contentful: ContentfulService, private themeService: ThemeService, private navService: NavService) { }

  ngOnInit(): void {
    // sets up main color for the clubs page
    this.themeService.setMainPaneColor(Colors.purple);

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
      this.fliteredClubs = this.clubs;
      this.loadingClubs = false;
    });
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // close Nav
    this.navService.closeNav();

    // deselect a club if it is already selected
    if (this.selectedClub?.name === club.name && this.selectedClub?.city === club.city) {
      this.selectedClub = undefined;
      this.themeService.setMainPaneColor(Colors.purple);
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

    this.filterCompetitions();
  }

  filterCompetitions() {
    this.fliteredClubs = this.clubs;
    if (this.filters.states.length > 0) {
      this.fliteredClubs = this.fliteredClubs.filter(club => this.filters.states.includes(club.state));
    }
  }

}
