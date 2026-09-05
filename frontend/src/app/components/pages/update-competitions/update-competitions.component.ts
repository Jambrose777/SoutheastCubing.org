import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Subscription, take } from 'rxjs';
import { SouteastcubingApiService } from 'src/app/services/souteastcubing-api.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';

enum UpdateStatus {
  default = 'default',
  updating = 'updating',
  success = 'success',
  failure = 'failure',
}

@Component({
  selector: 'se-update-competitions',
  templateUrl: './update-competitions.component.html',
  styleUrls: ['./update-competitions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderComponent, LoadingSpinnerComponent],
})
export class UpdateCompetitionsComponent implements OnInit {
  private themeService = inject(ThemeService);
  private southeastcubingApi = inject(SouteastcubingApiService);

  title: string = 'Competitions';
  subscriptions: Subscription = new Subscription();
  description: string =
    'This page is meant for admin use only. Admins can click the button below to fetch the list of competitions from WCA and update the global cache. This action is limited to once an hour. Refreshes happen automatically at midnight everyday, however this can be used to immediately update for recently announced competitions.';
  updateCompetitionsStatus = signal(UpdateStatus.default);
  errorMessage = signal<string>(undefined);

  ngOnInit(): void {
    // sets up main color for the competitions page
    this.themeService.setMainPaneColor(Colors.darkGrey);
  }

  // makes call to update competitions on the Southeastcubing API
  updateCompetitions() {
    this.updateCompetitionsStatus.set(UpdateStatus.updating);

    this.southeastcubingApi
      .updateCompetitions()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.updateCompetitionsStatus.set(UpdateStatus.success);
        },
        error: (err) => {
          this.updateCompetitionsStatus.set(UpdateStatus.failure);
          this.errorMessage.set(err?.error?.message);
        },
      });
  }
}
