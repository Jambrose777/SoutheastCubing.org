import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect, MatOption } from '@angular/material/select';
import { ManageDelegatesApiService } from 'src/app/services/southeastcubing-api/manage-delegates-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { toDateInputValue, checkBadDateInput } from 'src/app/shared/date.util';
import { States } from 'src/app/shared/types';
import { RANK_LABELS } from 'src/app/models/Delegate';
import { SelectedPerson } from 'src/app/models/Person';
import {
  ManageDelegateHistoryEntry,
  ManageDelegateHistoryType,
} from 'src/app/models/ManageDelegate';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { PersonSearchComponent } from '../../../../shared/person-search/person-search.component';

// Every rank value, in display order - same order/labels used elsewhere
const RANK_OPTIONS: { value: string; label: string }[] = [
  { value: 'trainee', label: RANK_LABELS['trainee'] },
  { value: 'junior', label: RANK_LABELS['junior'] },
  { value: 'delegate', label: RANK_LABELS['delegate'] },
  { value: 'senior', label: RANK_LABELS['senior'] },
  { value: 'regional', label: RANK_LABELS['regional'] },
  { value: 'temporary', label: RANK_LABELS['temporary'] },
];

// The 6 states SECI tracks, in alphabetical order.
const STATE_OPTIONS: string[] = Object.values(States).sort();

// Slide-in "Add/Edit rank or state history row" sheet.
// Add mode's first step picks Rank-vs-State, then (once picked) shows
// se-person-search's own combobox; Edit mode skips both - a row can't move
// between tables, and the person is already known. Editing a
// currently-open row (end_date IS NULL) locks the value dropdown and End
// Date - only Start Date is editable there, matching the backend's own
// open-row-lock validation.
@Component({
  selector: 'se-add-edit-delegate-history-sheet',
  templateUrl: './add-edit-delegate-history-sheet.component.html',
  styleUrls: ['./add-edit-delegate-history-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    AvatarComponent,
    PersonSearchComponent,
  ],
})
export class AddEditDelegateHistorySheetComponent {
  private manageDelegatesApi = inject(ManageDelegatesApiService);
  private toastService = inject(ToastService);

  // null = add mode.
  row = input<ManageDelegateHistoryEntry | null>(null);
  closed = output<void>();
  saved = output<ManageDelegateHistoryEntry>();

  rankOptions = RANK_OPTIONS;
  stateOptions = STATE_OPTIONS;
  checkBadDateInput = checkBadDateInput;
  saving = false;

  // Which table the new row goes into - only choosable on add.
  historyType = signal<ManageDelegateHistoryType>('rank');

  selectedPerson = signal<SelectedPerson | null>(null);
  personSearch = viewChild(PersonSearchComponent);

  form = new FormGroup({
    value: new FormControl<string | null>(null, Validators.required),
    startDate: new FormControl<string | null>(null, Validators.required),
    endDate: new FormControl<string | null>(null, Validators.required),
  });

  // A currently-open row (end_date IS NULL) can only have its start date
  // corrected here - the value dropdown and End Date are both locked,
  // since which rank/state a currently-open row holds stays
  // sync-controlled.
  isOpenRow = computed(() => !!this.row() && !this.row()?.endDate);

  isEditMode = computed(() => !!this.row());

  constructor() {
    // Edit mode always starts with the person and type already known; add
    // mode starts at the type-then-search step.
    effect(() => {
      const row = this.row();
      if (row) {
        this.historyType.set(row.type);
        this.selectedPerson.set({
          peopleId: row.peopleId,
          name: row.name,
          pictureUrl: row.pictureUrl,
          thumbnailCropX: row.thumbnailCropX,
          thumbnailCropY: row.thumbnailCropY,
          thumbnailCropW: row.thumbnailCropW,
          thumbnailCropH: row.thumbnailCropH,
        });
        this.form.reset({
          value: row.value,
          startDate: toDateInputValue(row.startDate),
          endDate: toDateInputValue(row.endDate),
        });
      } else {
        this.historyType.set('rank');
        this.selectedPerson.set(null);
        this.form.reset({ value: null, startDate: null, endDate: null });
      }
      this.updateLockedControls();
    });
  }

  // Only choosable on add - switches which value dropdown (rank vs state)
  // shows, and clears any value already picked under the other type.
  selectHistoryType(type: ManageDelegateHistoryType) {
    if (this.isEditMode()) return;
    this.historyType.set(type);
    this.form.controls.value.setValue(null);
  }

  onPersonSelected(person: SelectedPerson) {
    this.selectedPerson.set(person);
  }

  // Only available in add mode - lets the user back out of a selection and
  // search again.
  changePerson() {
    this.selectedPerson.set(null);
    this.personSearch()?.clear();
  }

  // Locks the value dropdown and End Date when editing a currently-open
  // row.
  private updateLockedControls() {
    if (this.isOpenRow()) {
      this.form.controls.value.disable();
      this.form.controls.endDate.disable();
    } else {
      this.form.controls.value.enable();
      this.form.controls.endDate.enable();
    }
  }

  isDirty(): boolean {
    return !!this.selectedPerson() && this.form.dirty;
  }

  save() {
    const person = this.selectedPerson();
    if (!person || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    const value = this.form.getRawValue();
    const existingRow = this.row();
    const type = this.historyType();

    // form.invalid (checked above) already guarantees startDate/endDate/
    // value are non-null here - the `?? ''` fallbacks just satisfy
    // TypeScript's own null-safety, not a real runtime possibility.
    let request;
    if (existingRow) {
      request =
        type === 'rank'
          ? this.manageDelegatesApi.updateRankRow(existingRow.id, {
              rank: value.value ?? undefined,
              startDate: value.startDate ?? '',
              endDate: value.endDate,
            })
          : this.manageDelegatesApi.updateStateRow(existingRow.id, {
              state: value.value ?? undefined,
              startDate: value.startDate ?? '',
              endDate: value.endDate,
            });
    } else {
      const personBody = { peopleId: person.peopleId, wcaId: person.wcaId };
      request =
        type === 'rank'
          ? this.manageDelegatesApi.createRankRow({
              ...personBody,
              rank: value.value ?? '',
              startDate: value.startDate ?? '',
              endDate: value.endDate ?? '',
            })
          : this.manageDelegatesApi.createStateRow({
              ...personBody,
              state: value.value ?? '',
              startDate: value.startDate ?? '',
              endDate: value.endDate ?? '',
            });
    }

    request.subscribe({
      next: (row) => {
        this.saving = false;
        this.toastService.success(existingRow ? 'History row updated.' : 'History row added.');
        this.saved.emit(row);
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message ?? 'Failed to save history row.');
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
