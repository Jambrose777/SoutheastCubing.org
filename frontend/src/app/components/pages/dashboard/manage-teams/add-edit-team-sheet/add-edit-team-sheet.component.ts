import { Component, ChangeDetectionStrategy, inject, input, output, effect } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManageTeamsApiService } from 'src/app/services/southeastcubing-api/manage-teams-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { ManageTeam } from 'src/app/models/ManageTeam';

// Slide-in "Add/Edit Team" sheet.
@Component({
  selector: 'se-add-edit-team-sheet',
  templateUrl: './add-edit-team-sheet.component.html',
  styleUrls: ['./add-edit-team-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormField, MatLabel, MatError, MatInput, MatTooltipModule],
})
export class AddEditTeamSheetComponent {
  private manageTeamsApi = inject(ManageTeamsApiService);
  private toastService = inject(ToastService);

  // null = create mode (a brand-new ordinary team).
  team = input<ManageTeam | null>(null);
  closed = output<void>();
  saved = output<ManageTeam>();

  saving = false;

  form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/[a-zA-Z0-9]/)]),
    description: new FormControl(''),
    email: new FormControl('', Validators.email),
    hidden: new FormControl(false),
  });

  constructor() {
    // Reseeds the form whenever a different team is opened for editing.
    effect(() => {
      const team = this.team();
      this.form.reset({
        name: team?.name ?? '',
        description: team?.description ?? '',
        email: team?.email ?? '',
        hidden: team?.hidden ?? false,
      });
      // A fixed team's name/hidden flag can never change - lock both
      // controls.
      if (team?.isFixed) {
        this.form.controls.name.disable();
        this.form.controls.hidden.disable();
      } else {
        this.form.controls.name.enable();
        this.form.controls.hidden.enable();
      }
    });
  }

  get isCreateMode(): boolean {
    return !this.team();
  }

  // Used by the parent to decide whether closing this sheet needs an "are
  // you sure" confirmation first.
  isDirty(): boolean {
    return this.form.dirty;
  }

  toggleHidden() {
    this.form.controls.hidden.setValue(!this.form.controls.hidden.value);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();
    const body = {
      name: value.name ?? '',
      description: value.description || null,
      email: value.email || null,
      hidden: !!value.hidden,
    };

    const existingTeam = this.team();
    const request = existingTeam
      ? this.manageTeamsApi.updateTeam(existingTeam.id, body)
      : this.manageTeamsApi.createTeam(body);

    request.subscribe({
      next: (team) => {
        this.saving = false;
        this.toastService.success(existingTeam ? 'Team updated.' : 'Team created.');
        this.saved.emit(team);
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message ?? 'Failed to save team.');
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
