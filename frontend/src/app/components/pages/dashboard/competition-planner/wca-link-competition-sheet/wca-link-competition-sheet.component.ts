import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { ErrorBannerService } from 'src/app/services/error-banner.service';
import { ToastService } from 'src/app/services/toast.service';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { PlannerCompetition, PlannerWcaCompetitionOption } from 'src/app/models/PlannerCompetition';
import { LoadingSpinnerComponent } from '../../../../shared/loading-spinner/loading-spinner.component';

// Links a Potential Planner row to a WCA competition selected by the Delegate.
@Component({
  selector: 'se-wca-link-competition-sheet',
  templateUrl: './wca-link-competition-sheet.component.html',
  styleUrls: ['./wca-link-competition-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormField, MatLabel, MatSelect, MatOption, LoadingSpinnerComponent],
})
export class WcaLinkCompetitionSheetComponent implements OnInit {
  competition = input.required<PlannerCompetition>();
  closed = output<void>();
  saved = output<void>();

  private errorBannerService = inject(ErrorBannerService);
  private toastService = inject(ToastService);
  private competitionPlannerApi = inject(CompetitionPlannerApiService);

  options = signal<PlannerWcaCompetitionOption[]>([]);
  selectedWcaCompetitionId = signal('');
  loading = signal(true);
  saving = signal(false);

  ngOnInit(): void {
    this.loadOptions();
  }

  // Loads available WCA competitions without selecting one automatically.
  private loadOptions(): void {
    this.competitionPlannerApi.getWcaLinkOptions().subscribe({
      next: (options) => {
        this.options.set(
          [...options].sort((left, right) => left.start_date.localeCompare(right.start_date)),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorBannerService.show('Failed to load WCA competitions.');
        this.closed.emit();
      },
    });
  }

  // Saves the selected WCA link and lets the Planner reload its canonical row.
  save(): void {
    const wcaCompetitionId = this.selectedWcaCompetitionId();
    if (!wcaCompetitionId || this.loading() || this.saving()) return;

    this.saving.set(true);
    this.competitionPlannerApi
      .linkWcaCompetition({
        wcaCompetitionId,
        plannerCompetitionId: this.competition().id,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toastService.success('Competition linked in Planner.');
          this.saved.emit();
        },
        error: () => {
          this.saving.set(false);
          this.errorBannerService.show('Failed to link the WCA competition.');
          this.closed.emit();
        },
      });
  }

  // Closes the sheet without changing the Planner row.
  close(): void {
    this.closed.emit();
  }
}
