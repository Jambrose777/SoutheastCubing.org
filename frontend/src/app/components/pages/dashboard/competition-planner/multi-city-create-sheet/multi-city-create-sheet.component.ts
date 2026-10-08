import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { Delegate } from 'src/app/models/Delegate';
import {
  PlannerMultiCityLocationRequest,
  PlannerPerson,
  PlannerWcaCompetitionOption,
} from 'src/app/models/PlannerCompetition';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { PeopleApiService } from 'src/app/services/southeastcubing-api/people-api.service';
import { SoutheastcubingApiService } from 'src/app/services/southeastcubing-api/southeastcubing-api.service';
import { ToastService } from 'src/app/services/toast.service';
import { EventNames, States } from 'src/app/shared/types';
import {
  equipmentValuesToPeopleIds,
  OTHER_EQUIPMENT_VALUE,
  toPlannerPerson,
} from '../competition-planner.util';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';

interface MultiCityLocationDraft {
  id: number;
  form: FormGroup;
  delegates: PlannerPerson[];
  selectedDelegateWcaIds: string[];
  delegateSelectionTouched: boolean;
  delegateSearch: FormControl<string>;
  resolvingDelegates: boolean;
  equipmentValues: string[];
}

// Creates multiple Planner location rows from one managed multi-city WCA competition.
@Component({
  selector: 'se-multi-city-create-sheet',
  templateUrl: './multi-city-create-sheet.component.html',
  styleUrls: ['./multi-city-create-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule,
    MatError,
    MatFormField,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
    MatTooltipModule,
    NgxMatSelectSearchModule,
    NgClass,
    AvatarComponent,
  ],
})
export class MultiCityCreateSheetComponent implements OnInit {
  private competitionPlannerApi = inject(CompetitionPlannerApiService);
  private peopleApi = inject(PeopleApiService);
  private southeastcubingApi = inject(SoutheastcubingApiService);
  private toastService = inject(ToastService);

  competition = input.required<PlannerWcaCompetitionOption>();
  closed = output<void>();
  saved = output<void>();

  locations = signal<MultiCityLocationDraft[]>([]);
  delegateRoster = signal<Delegate[]>([]);
  saving = signal(false);
  stateOptions = Object.values(States);
  EventNames = EventNames;
  otherEquipmentValue = OTHER_EQUIPMENT_VALUE;
  createWcaDriveFolder = new FormControl(true, { nonNullable: true });
  wcaDriveLink = new FormControl('');
  equipmentOptions = computed(() =>
    [...this.delegateRoster()].sort((left, right) => left.name.localeCompare(right.name)),
  );
  wcaDelegateOptions = computed(() =>
    [...(this.competition().delegates ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  );

  private nextLocationId = 1;
  private signalsDirty = false;

  ngOnInit(): void {
    this.southeastcubingApi.getPublicDelegates().subscribe({
      next: (roster) => this.delegateRoster.set(roster),
    });
    this.addLocation(false);
  }

  // Reports whether the batch has any edits worth protecting from accidental close.
  isDirty(): boolean {
    return (
      this.signalsDirty ||
      this.locations().some((location) => location.form.dirty) ||
      this.createWcaDriveFolder.dirty ||
      this.wcaDriveLink.dirty
    );
  }

  // Adds a blank location without selecting a Delegate or lead in advance.
  addLocation(markDirty = true): void {
    const location: MultiCityLocationDraft = {
      id: this.nextLocationId++,
      form: new FormGroup({
        city: new FormControl('', Validators.required),
        state: new FormControl<string | null>(null, Validators.required),
        venueAddress: new FormControl('', Validators.required),
        venueDetails: new FormControl('', Validators.required),
        venue: new FormControl('', Validators.required),
        venueUrl: new FormControl(''),
        latitudeDegrees: new FormControl<number | null>(null, Validators.required),
        longitudeDegrees: new FormControl<number | null>(null, Validators.required),
        competitorLimit: new FormControl<number | null>(null, [
          Validators.required,
          Validators.min(1),
        ]),
        delegateWcaIds: new FormControl<string[]>([], { nonNullable: true }),
        leadPeopleId: new FormControl<string | null>(null, Validators.required),
      }),
      delegates: [],
      selectedDelegateWcaIds: [],
      delegateSelectionTouched: false,
      delegateSearch: new FormControl('', { nonNullable: true }),
      resolvingDelegates: false,
      equipmentValues: [],
    };
    this.locations.update((current) => [...current, location]);
    if (markDirty) this.signalsDirty = true;
  }

  // Removes a location while preserving at least one editable location in the batch.
  removeLocation(locationId: number): void {
    if (this.locations().length <= 1) return;
    this.locations.update((current) => current.filter((location) => location.id !== locationId));
    this.signalsDirty = true;
  }

  // Filters the alphabetized WCA delegate options by name or WCA ID.
  filteredWcaDelegates(location: MultiCityLocationDraft) {
    const query = location.delegateSearch.value.trim().toLocaleLowerCase();
    if (!query) return this.wcaDelegateOptions();
    return this.wcaDelegateOptions().filter(
      (delegate) =>
        delegate.name.toLocaleLowerCase().includes(query) ||
        delegate.wcaId?.toLocaleLowerCase().includes(query),
    );
  }

  // Resolves newly selected WCA delegates and removes deselected assignments.
  setSelectedDelegates(locationId: number, selectedWcaIds: string[]): void {
    const location = this.locations().find((item) => item.id === locationId);
    if (!location || location.resolvingDelegates) return;

    const selectedIds = selectedWcaIds.filter(Boolean);
    const delegateWcaIdsControl = location.form.controls['delegateWcaIds'];
    delegateWcaIdsControl.setValue(selectedIds, { emitEvent: false });
    const previousIds = new Set(location.selectedDelegateWcaIds);
    const addedIds = selectedIds.filter((wcaId) => !previousIds.has(wcaId));
    if (addedIds.length) delegateWcaIdsControl.disable({ emitEvent: false });
    const selectedIdSet = new Set(selectedIds);
    this.updateLocation(locationId, (current) => {
      const delegates = current.delegates.filter(
        (delegate) => delegate.wcaId && selectedIdSet.has(delegate.wcaId),
      );
      const leadPeopleId = current.form.controls['leadPeopleId'].value;
      if (leadPeopleId && !delegates.some((delegate) => delegate.peopleId === leadPeopleId)) {
        current.form.controls['leadPeopleId'].setValue(null);
      }
      return {
        ...current,
        selectedDelegateWcaIds: selectedIds,
        delegateSelectionTouched: true,
        delegates,
        resolvingDelegates: addedIds.length > 0,
      };
    });
    this.signalsDirty = true;
    this.resolveSelectedDelegates(locationId, addedIds);
  }

  // Removes a selected Delegate and clears the lead if it was assigned to them.
  removeDelegate(locationId: number, peopleId: string): void {
    const location = this.locations().find((item) => item.id === locationId);
    const delegate = location?.delegates.find((item) => item.peopleId === peopleId);
    if (!location || !delegate?.wcaId) return;
    this.setSelectedDelegates(
      locationId,
      location.selectedDelegateWcaIds.filter((wcaId) => wcaId !== delegate.wcaId),
    );
  }

  // Tracks interaction with this location's Delegate selector independently of other fields.
  markDelegateSelectionTouched(locationId: number): void {
    this.updateLocation(locationId, (location) => ({
      ...location,
      delegateSelectionTouched: true,
    }));
  }

  // Keeps equipment assignments scoped to the selected location.
  setEquipmentValues(locationId: number, values: string[]): void {
    this.updateLocation(locationId, (location) => ({ ...location, equipmentValues: values }));
    this.signalsDirty = true;
  }

  // Builds the server payload and submits all location rows as one batch.
  save(): void {
    const locations = this.locations();
    if (locations.some((location) => location.form.invalid || !location.delegates.length)) {
      locations.forEach((location) => location.form.markAllAsTouched());
      this.locations.update((current) =>
        current.map((location) => ({ ...location, delegateSelectionTouched: true })),
      );
      this.toastService.error('Complete the required fields for every location.');
      return;
    }

    const locationRequests: PlannerMultiCityLocationRequest[] = locations.map((location) => {
      const value = location.form.getRawValue();
      return {
        city: value.city.trim(),
        state: value.state,
        venueAddress: value.venueAddress.trim(),
        venueDetails: value.venueDetails.trim(),
        venue: value.venue.trim(),
        venueUrl: value.venueUrl?.trim() || null,
        latitudeDegrees: value.latitudeDegrees,
        longitudeDegrees: value.longitudeDegrees,
        competitorLimit: value.competitorLimit,
        leadPeopleId: value.leadPeopleId,
        delegatePeopleIds: location.delegates.map((delegate) => delegate.peopleId),
        equipmentPeopleIds: equipmentValuesToPeopleIds(location.equipmentValues),
      };
    });
    const driveLink = this.wcaDriveLink.value?.trim() ?? '';
    const request = {
      wcaCompetitionId: this.competition().wca_competition_id,
      locations: locationRequests,
      createWcaDriveFolder: this.createWcaDriveFolder.value,
      ...(!this.createWcaDriveFolder.value && driveLink ? { wcaDriveLink: driveLink } : {}),
    };

    this.saving.set(true);
    this.competitionPlannerApi.createMultiCityCompetition(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastService.success('Multi-city locations created in Planner.');
        this.saved.emit();
      },
      error: (error) => {
        this.saving.set(false);
        this.toastService.error(error?.error?.message ?? 'Failed to create multi-city locations.');
      },
    });
  }

  // Closes the sheet without changing the Planner rows.
  close(): void {
    this.closed.emit();
  }

  private updateLocation(
    locationId: number,
    update: (location: MultiCityLocationDraft) => MultiCityLocationDraft,
  ): void {
    this.locations.update((current) =>
      current.map((location) => (location.id === locationId ? update(location) : location)),
    );
  }

  // Resolves additions sequentially so the first selection consistently becomes lead.
  private resolveSelectedDelegates(locationId: number, wcaIds: string[], index = 0): void {
    // final case after all Delegates are resolved update the location.
    if (index >= wcaIds.length) {
      this.updateLocation(locationId, (location) => {
        location.form.controls['delegateWcaIds'].enable({ emitEvent: false });
        return { ...location, resolvingDelegates: false };
      });
      return;
    }
    const wcaId = wcaIds[index];
    this.peopleApi.resolvePerson({ wcaId }).subscribe({
      next: (person) => {
        const location = this.locations().find((item) => item.id === locationId);
        if (location?.selectedDelegateWcaIds.includes(wcaId)) {
          const delegate = toPlannerPerson(person);
          this.updateLocation(locationId, (current) => {
            if (current.delegates.some((item) => item.peopleId === delegate.peopleId)) {
              return current;
            }
            // sets a null lead Delegate
            if (!current.form.controls['leadPeopleId'].value) {
              current.form.controls['leadPeopleId'].setValue(delegate.peopleId);
            }
            return { ...current, delegates: [...current.delegates, delegate] };
          });
        }
        this.resolveSelectedDelegates(locationId, wcaIds, index + 1);
      },
      error: (error) => {
        this.updateLocation(locationId, (current) => {
          const selectedDelegateWcaIds = current.selectedDelegateWcaIds.filter(
            (id) => id !== wcaId,
          );
          current.form.controls['delegateWcaIds'].setValue(selectedDelegateWcaIds, {
            emitEvent: false,
          });
          return { ...current, selectedDelegateWcaIds };
        });
        this.toastService.error(error?.error?.message ?? `Failed to resolve ${wcaId}.`);
        this.resolveSelectedDelegates(locationId, wcaIds, index + 1);
      },
    });
  }
}
