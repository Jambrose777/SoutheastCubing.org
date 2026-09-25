import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Subscription, take } from 'rxjs';
import { SoutheastcubingApiService } from 'src/app/services/southeastcubing-api/southeastcubing-api.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
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
  private southeastcubingApi = inject(SoutheastcubingApiService);
  private screenSizeService = inject(ScreenSizeService);

  isMobile = this.screenSizeService.isMobile;

  title: string = 'Update Competitions';
  subscriptions: Subscription = new Subscription();
  description: string =
    'This page is meant for admin use only. Admins can click the button below to fetch the list of competitions from WCA and update the global cache. This action is limited to once an hour. Refreshes happen automatically at midnight everyday, however this can be used to immediately update for recently announced competitions.';
  updateCompetitionsStatus = signal(UpdateStatus.default);
  errorMessage = signal<string | undefined>(undefined);
  // Competitions the backend refreshed successfully but couldn't announce on Discord
  discordPostFailures = signal<{ id: string; name: string }[]>([]);
  discordPostFailureNames = computed(() =>
    this.discordPostFailures()
      .map((competition) => competition.name)
      .join(', '),
  );

  ngOnInit(): void {
    // sets up main color for the update-competitions page
    this.themeService.setMainPaneColor(Colors.purple);
  }

  // makes call to update competitions on the Southeastcubing API
  updateCompetitions() {
    this.updateCompetitionsStatus.set(UpdateStatus.updating);
    this.discordPostFailures.set([]);

    this.southeastcubingApi
      .updateCompetitions()
      .pipe(take(1))
      .subscribe({
        next: (res) => {
          this.updateCompetitionsStatus.set(UpdateStatus.success);
          this.discordPostFailures.set(res.discordPostFailures ?? []);
        },
        error: (err) => {
          this.updateCompetitionsStatus.set(UpdateStatus.failure);
          this.errorMessage.set(err?.error?.message);
        },
      });
  }
}
