import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlannerBulkRefreshConflictResponse } from 'src/app/models/PlannerCompetition';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { ToastService } from 'src/app/services/toast.service';
import { formatRelativeTime } from 'src/app/shared/date.util';

// Matches backend hardcoded value. 5 Minute global cooldown between refreshes.
const BULK_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

@Component({
  selector: 'se-competition-refresh-control',
  templateUrl: './competition-refresh-control.component.html',
  styleUrls: ['./competition-refresh-control.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTooltipModule],
})
export class CompetitionRefreshControlComponent implements OnDestroy {
  private competitionPlannerApi = inject(CompetitionPlannerApiService);
  private toastService = inject(ToastService);
  private errorBannerService = inject(ErrorBannerService);

  lastBulkRefreshAt = input<string | null>(null);
  refreshed = output<void>();

  bulkRefreshInProgress = signal(false);
  bulkRefreshCoolingDown = signal(false);
  bulkRefreshDisabled = computed(
    () => this.bulkRefreshInProgress() || this.bulkRefreshCoolingDown(),
  );
  private displayedLastRefreshAt = signal<string | null>(null);
  private cooldownTimeout?: ReturnType<typeof setTimeout>;

  private refreshTimestampEffect = effect((onCleanup) => {
    this.setLastBulkRefreshAt(this.lastBulkRefreshAt());
    onCleanup(() => this.clearCooldownTimeout());
  });

  // Includes operation scope, side effects, and the most recent bulk-refresh time.
  bulkRefreshTooltip(): string {
    const details =
      'Refreshes upcoming competition data from WCA. Makes multiple external calls and database updates, and posts new competitions to Discord.';
    const lastRefresh = this.displayedLastRefreshAt();
    return `${details}\nLast bulk refresh: ${lastRefresh ? formatRelativeTime(lastRefresh) : 'never'}.`;
  }

  refreshAllCompetitions(): void {
    if (this.bulkRefreshDisabled()) return;
    this.bulkRefreshInProgress.set(true);
    const pendingToast = this.toastService.pending('Refreshing competitions…');

    this.competitionPlannerApi.refreshCompetitions().subscribe({
      next: (response) => {
        pendingToast.dismiss();
        this.bulkRefreshInProgress.set(false);
        this.setLastBulkRefreshAt(response.meta.lastBulkRefreshAt);
        const warnings: string[] = [];
        if (response.privateDataRefreshFailed) {
          warnings.push(
            'Private or unannounced WCA data could not be refreshed. Public competitions were refreshed; check your WCA connection and try again.',
          );
        }
        if (response.discordPostFailures.length) {
          const failedNames = response.discordPostFailures
            .map((competition) => competition.name)
            .join(', ');
          warnings.push(`Discord posting failed for: ${failedNames}.`);
        }
        if (warnings.length) {
          this.toastService.error(`Competitions refreshed with issues. ${warnings.join(' ')}`);
        } else {
          this.toastService.success('Competitions refreshed.');
        }
        this.refreshed.emit();
      },
      error: (err) => {
        pendingToast.dismiss();
        this.bulkRefreshInProgress.set(false);
        const errorBody = err?.error as PlannerBulkRefreshConflictResponse | undefined;
        if (err?.status === 409) {
          this.setLastBulkRefreshAt(errorBody?.meta?.lastBulkRefreshAt ?? null);
        }
        this.errorBannerService.show(errorBody?.message ?? 'Failed to refresh competitions.');
      },
    });
  }

  ngOnDestroy(): void {
    this.clearCooldownTimeout();
  }

  private setLastBulkRefreshAt(timestamp: string | null): void {
    this.displayedLastRefreshAt.set(timestamp);
    this.clearCooldownTimeout();

    if (!timestamp) {
      this.bulkRefreshCoolingDown.set(false);
      return;
    }

    const remainingMs = Date.parse(timestamp) + BULK_REFRESH_COOLDOWN_MS - Date.now();
    this.bulkRefreshCoolingDown.set(Number.isFinite(remainingMs) && remainingMs > 0);
    if (remainingMs > 0) {
      this.cooldownTimeout = setTimeout(() => {
        this.bulkRefreshCoolingDown.set(false);
        this.cooldownTimeout = undefined;
      }, remainingMs);
    }
  }

  private clearCooldownTimeout(): void {
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
      this.cooldownTimeout = undefined;
    }
  }
}
