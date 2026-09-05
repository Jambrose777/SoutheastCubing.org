import {
  Component,
  input,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ChangeDetectionStrategy,
  OnChanges,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Competition } from 'src/app/models/Competition';
import { LinksService } from 'src/app/services/links.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RegistrationStatus } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { NgClass, PercentPipe } from '@angular/common';
import { SafeUrlPipe } from '../../../../pipes/safeUrl.pipe';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass, PercentPipe, SafeUrlPipe],
})
export class SelectedCompetitionComponent implements OnInit, OnDestroy, OnChanges {
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  isMobile: boolean;
  RegistrationStatus = RegistrationStatus;
  enviroment = environment;
  selectedCompetition = input<Competition>();
  subscriptions: Subscription = new Subscription();
  googleMapUrl: string;

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(
      this.screenSizeService
        .getIsMobileSubject()
        .subscribe((isMobile) => (this.isMobile = isMobile)),
    );

    // update Competition Details on init
    this.updateCompetitionDetails();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // changes to selectedCompetition
    if (changes['selectedCompetition']) {
      this.updateCompetitionDetails();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // updates dynamic details relating to the competition.
  updateCompetitionDetails(): void {
    // set up google map url with the competition's venue
    this.googleMapUrl =
      this.enviroment.links.googleMapsApi + this.selectedCompetition().venue_address;
  }
}
