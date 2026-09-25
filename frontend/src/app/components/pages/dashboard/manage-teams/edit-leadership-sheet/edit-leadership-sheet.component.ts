import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
} from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatError, MatHint } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ManageTeamsApiService } from 'src/app/services/southeastcubing-api/manage-teams-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { toDateInputValue, formatDate, checkBadDateInput } from 'src/app/shared/date.util';
import { TeamLeaderStint } from 'src/app/models/ManageTeam';

// Slide-in "Edit Leadership" sheet - corrects the start/end date of, or
// deletes, one of a member's past or current team_leaders rows (leadership
// stints) on this team.
@Component({
  selector: 'se-edit-leadership-sheet',
  templateUrl: './edit-leadership-sheet.component.html',
  styleUrls: ['./edit-leadership-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
  ],
})
export class EditLeadershipSheetComponent {
  private manageTeamsApi = inject(ManageTeamsApiService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  // Every leadership stint the member being edited has on this team.
  stints = input.required<TeamLeaderStint[]>();
  closed = output<void>();
  saved = output<TeamLeaderStint>();
  deleted = output<void>();

  isAdmin = computed(() => this.authService.currentUser()?.roles?.isAdmin ?? false);

  selectedStintId = signal<string | null>(null);
  selectedStint = computed(
    () => this.stints().find((stint) => stint.id === this.selectedStintId()) ?? this.stints()[0],
  );

  formatDate = formatDate;
  checkBadDateInput = checkBadDateInput;
  saving = false;

  form = new FormGroup({
    startDate: new FormControl('', Validators.required),
    endDate: new FormControl<string | null>(null),
  });

  constructor() {
    // Defaults to the most recent stint whenever a different member's
    // stints are opened for editing, then reseeds the form whenever the
    // selected stint itself changes.
    effect(() => {
      const stints = this.stints();
      this.selectedStintId.set(stints[0]?.id ?? null);
    });
    effect(() => {
      const stint = this.selectedStint();
      if (!stint) return;
      this.form.reset({
        startDate: toDateInputValue(stint.start_date),
        endDate: toDateInputValue(stint.end_date),
      });
    });
  }

  selectStint(stintId: string) {
    this.selectedStintId.set(stintId);
  }

  // Used by the parent to decide whether closing this sheet needs an "are
  // you sure" confirmation first.
  isDirty(): boolean {
    return this.form.dirty;
  }

  save() {
    const stint = this.selectedStint();
    if (!stint || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();

    this.manageTeamsApi
      .updateLeadershipStint(stint.id, {
        startDate: value.startDate ?? stint.start_date,
        endDate: value.endDate || null,
      })
      .subscribe({
        next: (updated) => {
          this.saving = false;
          this.toastService.success('Leadership stint updated.');
          this.saved.emit(updated);
        },
        error: (err) => {
          this.saving = false;
          this.toastService.error(err?.error?.message ?? 'Failed to update leadership stint.');
        },
      });
  }

  delete() {
    const stint = this.selectedStint();
    if (!stint) return;
    if (!confirm(`Permanently delete ${stint.name}'s leadership stint? This can't be undone.`)) {
      return;
    }
    this.manageTeamsApi.hardDeleteLeadershipRow(stint.id).subscribe({
      next: () => {
        this.toastService.success('Leadership stint deleted.');
        this.deleted.emit();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message ?? 'Failed to delete leadership stint.');
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
