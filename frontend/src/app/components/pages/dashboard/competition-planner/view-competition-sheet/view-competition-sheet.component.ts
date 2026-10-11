import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlannerCompetition } from 'src/app/models/PlannerCompetition';
import { formatLongDateRange } from 'src/app/shared/date.util';
import { Colors, EventNames, StateColors } from 'src/app/shared/types';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { GoogleMapComponent } from '../../../../shared/google-map/google-map.component';
import { UnofficialEventIconComponent } from '../../../../shared/unofficial-event-icon/unofficial-event-icon.component';
import {
  getRegistrationStatus,
  getRegistrationStatusColor,
  getRegistrationStatusLabel,
} from 'src/app/shared/registrationStatus.util';

// Sheet for Viewing a competition's data.
@Component({
  selector: 'se-view-competition-sheet',
  templateUrl: './view-competition-sheet.component.html',
  styleUrls: ['./view-competition-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    GoogleMapComponent,
    NgClass,
    MatTooltipModule,
    UnofficialEventIconComponent,
  ],
})
export class ViewCompetitionSheetComponent {
  competition = input.required<PlannerCompetition>();
  closed = output<void>();
  EventNames = EventNames;
  StateColors = StateColors;
  formatLongDateRange = formatLongDateRange;

  registrationPeriodText(): string {
    const competition = this.competition();
    if (!competition.registration_open || !competition.registration_close) return '--';
    return formatLongDateRange(competition.registration_open, competition.registration_close);
  }

  hasRegistrationPeriod(): boolean {
    const competition = this.competition();
    return (
      getRegistrationStatus(
        competition.registration_open,
        competition.registration_close,
        competition.accepted_registrations,
        competition.competitor_limit,
      ) !== null
    );
  }

  registrationStatusLabel(): string {
    const competition = this.competition();
    const status = getRegistrationStatus(
      competition.registration_open,
      competition.registration_close,
      competition.accepted_registrations,
      competition.competitor_limit,
    );
    return status ? getRegistrationStatusLabel(status) : '--';
  }

  registrationStatusColor(): Colors {
    const competition = this.competition();
    const status = getRegistrationStatus(
      competition.registration_open,
      competition.registration_close,
      competition.accepted_registrations,
      competition.competitor_limit,
    );
    return status ? getRegistrationStatusColor(status) : Colors.grey;
  }

  hasExternalWebsite(): boolean {
    const competition = this.competition();
    return !!competition.website && competition.website !== competition.url;
  }
}
