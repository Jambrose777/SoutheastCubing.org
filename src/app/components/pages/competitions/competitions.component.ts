import { Component, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, RegistrationStatus, StateColors } from 'src/app/shared/types';
import { WcaService } from 'src/app/services/wca.service';
import { isMobile } from 'src/app/shared/functions';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { NavService } from 'src/app/services/nav.service';

@Component({
  selector: 'se-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss']
})
export class CompetitionsComponent implements OnInit {
  isMobile = isMobile();
  StateColors = StateColors;
  title: string = 'Competitions';
  description: string = '';
  competitions: Competition[] = [];
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;
  selectedCompetition: Competition;
  subText: string = '';

  constructor(private contentful: ContentfulService, private wca: WcaService, private themeService: ThemeService, private navService: NavService) { }

  ngOnInit(): void {
    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.darkGrey);

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

}
