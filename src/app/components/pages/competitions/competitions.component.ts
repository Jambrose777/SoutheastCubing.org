import { Component, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, RegistrationStatus, StateColors } from 'src/app/shared/types';
import { WcaService } from 'src/app/services/wca.service';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'app-competitions',
  templateUrl: './competitions.component.html',
  styleUrls: ['./competitions.component.scss']
})
export class CompetitionsComponent implements OnInit {
  isMobile = isMobile;
  RegistrationStatus = RegistrationStatus;
  StateColors = StateColors;
  title: string = 'Competitions';
  description: string = '';
  competitions: Competition[] = [];
  loadingContent: boolean = true;
  loadingCompetitions: boolean = true;
  selectedCompetition: Competition;
  subText: string = '';

  constructor(private contentful: ContentfulService, private wca: WcaService, private themeService: ThemeService) { }

  ngOnInit(): void {
    this.themeService.setRightPaneColor(Colors.darkGrey);

    this.contentful.getContentfulEntry('competitions').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText = res.fields.subText1;
      this.loadingContent = false;
    });

    this.wca.getUpcomingCompetitions().subscribe(res => {
      this.competitions = res;
      this.loadingCompetitions = false;
    });
  }

  selectCompetition(competition: Competition) {
    if(this.selectedCompetition?.name === competition.name) {
      this.selectedCompetition = undefined;
      this.themeService.setRightPaneColor(Colors.darkGrey);
    } else {
      this.selectedCompetition = competition;
      this.themeService.setRightPaneColor(StateColors[this.selectedCompetition.state]);
      if (this.selectedCompetition.registration_status === RegistrationStatus.open) {
        this.findRegistrationOpenStatus();
      }
    }
  }

  findRegistrationOpenStatus() {
    this.wca.getActiveRegistrations(this.selectedCompetition.id).subscribe(res => {
      this.selectedCompetition.active_registrations = res;
      if(this.selectedCompetition.active_registrations >= this.selectedCompetition.competitor_limit) {
        this.selectedCompetition.registration_status = RegistrationStatus.openWithWaitingList;
      } else {
        this.selectedCompetition.registration_status = RegistrationStatus.openWithSpots; 
      }
      this.wca.saveCompetitionstoLocalStorage(this.competitions);
    })
  }

}
