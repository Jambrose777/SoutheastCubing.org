import { Component, Input, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RegistrationStatus } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss']
})
export class SelectedCompetitionComponent implements OnInit {
  isMobile: boolean;
  RegistrationStatus = RegistrationStatus;
  enviroment = environment;
  @Input() selectedCompetition: Competition;

  constructor(
    private screenSizeService: ScreenSizeService,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);

  }

}
