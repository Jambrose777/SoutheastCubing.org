import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Competition } from 'src/app/models/Competition';
import { LinksService } from 'src/app/services/links.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { RegistrationStatus } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { NgClass, NgOptimizedImage, PercentPipe } from '@angular/common';
import { SafeUrlPipe } from '../../../../pipes/safeUrl.pipe';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, PercentPipe, SafeUrlPipe, NgOptimizedImage],
})
export class SelectedCompetitionComponent {
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  RegistrationStatus = RegistrationStatus;
  enviroment = environment;
  selectedCompetition = input<Competition>();

  // Derived purely from the selectedCompetition input signal, so a computed()
  // keeps this in sync automatically without needing ngOnInit/ngOnChanges.
  googleMapUrl = computed(
    () => this.enviroment.links.googleMapsApi + this.selectedCompetition()?.venue_address,
  );
}
