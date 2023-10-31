import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Competition } from 'src/app/models/Competition';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RegistrationStatus } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss']
})
export class SelectedCompetitionComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  RegistrationStatus = RegistrationStatus;
  enviroment = environment;
  @Input() selectedCompetition: Competition;
  subscriptions: Subscription = new Subscription();

  constructor(
    private screenSizeService: ScreenSizeService,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}
