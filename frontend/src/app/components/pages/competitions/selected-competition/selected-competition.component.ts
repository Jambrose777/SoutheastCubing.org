import { Component, input, ChangeDetectionStrategy, inject } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { LinksService } from 'src/app/services/links.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { EventNames, RegistrationStatus } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { NgClass, NgOptimizedImage, PercentPipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GoogleMapComponent } from '../../../shared/google-map/google-map.component';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, PercentPipe, NgOptimizedImage, MatTooltipModule, GoogleMapComponent],
})
export class SelectedCompetitionComponent {
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  RegistrationStatus = RegistrationStatus;
  EventNames = EventNames;
  environment = environment;
  selectedCompetition = input<Competition>();
}
