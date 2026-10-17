import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
  untracked,
  OnInit,
} from '@angular/core';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatError, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { PeopleApiService } from 'src/app/services/southeastcubing-api/people-api.service';
import { SoutheastcubingApiService } from 'src/app/services/southeastcubing-api/southeastcubing-api.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { States } from 'src/app/shared/types';
import * as moment from 'moment';
import { Moment } from 'moment';
import { PlannerCompetition, PlannerPerson } from 'src/app/models/PlannerCompetition';
import { Delegate } from 'src/app/models/Delegate';
import { SelectedPerson } from 'src/app/models/Person';
import {
  equipmentPeopleIdsToValues,
  OTHER_EQUIPMENT_VALUE,
  toPlannerPerson,
} from '../competition-planner.util';
import {
  getEquipmentAssignments,
  getEquipmentSelectOptions,
  getSortedEquipmentRoster,
} from './competition-equipment.util';
import { buildCompetitionSaveBodies } from './competition-save.util';
import {
  createCompetitionForm,
  getMinimumStartDate,
  minStartDateValidator,
} from './competition-form.util';
import {
  getUnofficialIconOptions,
  sortUnofficialEventDrafts,
  UnofficialEventDraft,
} from '../../../../shared/unofficial-event-icon/unofficial-events.util';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { PersonSearchComponent } from '../../../../shared/person-search/person-search.component';
import { EventListComponent } from '../../../../shared/event-list/event-list.component';
import { UnofficialEventIconComponent } from '../../../../shared/unofficial-event-icon/unofficial-event-icon.component';

// Slide-in "Add/Edit Competition" sheet - one reactive form shared by create
// and edit mode. Every WCA-synced field (hand-entered fields, Delegates,
// Organizers) is disabled and hidden once the competition is linked to WCA
// (Planning/Announced).
@Component({
  selector: 'se-add-edit-competition-sheet',
  templateUrl: './add-edit-competition-sheet.component.html',
  styleUrls: ['./add-edit-competition-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideMomentDateAdapter()],
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatError,
    MatSuffix,
    MatInput,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatSelect,
    MatOption,
    MatDatepickerModule,
    MatSlideToggleModule,
    MatTooltip,
    AvatarComponent,
    PersonSearchComponent,
    EventListComponent,
    UnofficialEventIconComponent,
  ],
})
export class AddEditCompetitionSheetComponent implements OnInit {
  private competitionPlannerApi = inject(CompetitionPlannerApiService);
  private peopleApi = inject(PeopleApiService);
  private southeastcubingApi = inject(SoutheastcubingApiService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  // null = create mode (a brand-new Potential competition).
  competition = input<PlannerCompetition | null>(null);
  canCreateMajor = input(false);
  majorCreate = signal(false);
  closed = output<void>();
  saved = output<void>();

  // Disables every date earlier than the minimum in the Start date
  // calendar, matching minStartDateValidator/the backend's own minimum.
  minStartDate = getMinimumStartDate();

  saving = false;
  stateOptions = Object.values(States);
  otherEquipmentValue = OTHER_EQUIPMENT_VALUE;

  // All venue fields start collapsed behind a "Show Venue fields" toggle.
  showVenueFields = signal(false);

  delegateRoster = signal<Delegate[]>([]);
  // Equipment's own options list - alphabetical by name, regardless of
  // whatever order the roster endpoint returns.
  equipmentOptions = computed(() => getSortedEquipmentRoster(this.delegateRoster()));
  equipmentSelectOptions = computed(() => getEquipmentSelectOptions(this.equipmentOptions()));

  delegates = signal<PlannerPerson[]>([]);
  organizers = signal<PlannerPerson[]>([]);
  // Equipment holder ids, drawn from this sheet's own Delegates list.
  equipmentValues = signal<string[]>([]);
  equipmentDetailsByHolder = signal<Record<string, string>>({});
  equipmentAssignments = computed(() =>
    getEquipmentAssignments(
      this.equipmentValues(),
      this.equipmentDetailsByHolder(),
      this.competition()?.equipmentHolders ?? [],
      this.equipmentOptions(),
    ),
  );
  eventIds = signal<string[]>([]);
  unofficialEvents = signal<UnofficialEventDraft[]>([]);
  unofficialEventSearchControl = new FormControl('', { nonNullable: true });
  unofficialEventSearchQuery = signal('');
  readonly unofficialIconOptions = getUnofficialIconOptions();
  filteredUnofficialIconOptions = computed(() => {
    const query = this.unofficialEventSearchQuery().trim().toLowerCase();
    return this.unofficialIconOptions.filter(
      (option) => !query || `${option.name} ${option.icon}`.toLowerCase().includes(query),
    );
  });
  readonly displayUnofficialIcon = (icon: string | null): string =>
    this.unofficialIconOptions.find((option) => option.icon === icon)?.name ?? icon ?? '';

  // Status is derived once, since create mode (competition() === null) is
  // always Potential - only an existing competition can already be linked.
  isLinked = computed(() => (this.competition()?.status ?? 'potential') !== 'potential');
  isMultiCity = computed(() => this.competition()?.is_multiple_cities_competition ?? false);
  isMajor = computed(() => this.majorCreate() || (this.competition()?.is_major ?? false));
  private nextUnofficialEventDraftId = 0;
  private defaultCreatorPeopleId: string | null = null;

  form = createCompetitionForm();

  // Lead must already be one of this sheet's own Delegates.
  delegateOptions = computed(() => this.delegates());

  constructor() {
    // Reseeds the form/lists whenever a different competition is opened, or
    // the sheet is switched into create mode.
    effect(() => {
      const comp = this.competition();
      const isMajor = untracked(() => this.isMajor());
      // Regular competition creation defaults the creator to Delegate and lead;
      // majors and edits start from their stored Delegate assignments.
      const user = this.authService.currentUser();
      const defaultDelegates: PlannerPerson[] =
        !comp && !isMajor && user?.peopleId
          ? [
              {
                peopleId: user.peopleId,
                name: user.name,
                wcaId: user.wcaId,
                pictureUrl: user.pictureUrl,
                thumbnailCropX: user.thumbnailCropX,
                thumbnailCropY: user.thumbnailCropY,
                thumbnailCropW: user.thumbnailCropW,
                thumbnailCropH: user.thumbnailCropH,
              },
            ]
          : [];
      this.defaultCreatorPeopleId = defaultDelegates[0]?.peopleId ?? null;

      this.form.reset({
        name: comp?.name ?? '',
        city: comp?.city.split(',')[0]?.trim() ?? '',
        state: comp?.state ?? null,
        venueAddress: comp?.venue_address ?? '',
        venueDetails: comp?.venue_details ?? '',
        venue: comp?.venue ?? '',
        venueUrl: comp?.venue_url ?? '',
        latitudeDegrees: comp?.latitude_degrees ?? null,
        longitudeDegrees: comp?.longitude_degrees ?? null,
        startDate: comp?.start_date ? moment.utc(comp.start_date) : null,
        endDate: comp?.end_date ? moment.utc(comp.end_date) : null,
        competitorLimit: comp?.competitor_limit ?? null,
        leadPeopleId:
          comp?.delegates.find((d) => d.isLead)?.peopleId ?? defaultDelegates[0]?.peopleId ?? null,
        createWcaDriveFolder: true,
        wcaDriveLink: comp?.wca_drive_link ?? '',
      });
      this.delegates.set(comp?.delegates ?? defaultDelegates);
      this.organizers.set(comp?.organizers ?? []);
      const equipmentHolders = comp?.equipmentHolders ?? [];
      this.equipmentValues.set(
        equipmentPeopleIdsToValues(equipmentHolders.map((holder) => holder.peopleId)),
      );
      this.equipmentDetailsByHolder.set(
        Object.fromEntries(
          equipmentHolders.map((holder) => [
            holder.peopleId ?? OTHER_EQUIPMENT_VALUE,
            holder.equipmentDetails ?? '',
          ]),
        ),
      );
      this.eventIds.set(comp?.event_ids ?? []);
      this.unofficialEvents.set(
        sortUnofficialEventDrafts(
          (comp?.unofficial_events ?? []).map(({ event_name, icon }) => ({
            id: this.nextUnofficialEventDraftId++,
            eventName: event_name,
            icon,
          })),
        ),
      );
      this.unofficialEventSearchControl.setValue('');
      this.unofficialEventSearchQuery.set('');
      this.signalsDirty = false;

      const wcaSyncedControls = [
        this.form.controls.name,
        this.form.controls.startDate,
        this.form.controls.endDate,
      ];
      const locationControls = [
        this.form.controls.city,
        this.form.controls.state,
        this.form.controls.venueAddress,
        this.form.controls.venueDetails,
        this.form.controls.venue,
        this.form.controls.venueUrl,
        this.form.controls.latitudeDegrees,
        this.form.controls.longitudeDegrees,
        this.form.controls.competitorLimit,
      ];
      const multiCityRequiredControls = [
        this.form.controls.venueAddress,
        this.form.controls.venueDetails,
        this.form.controls.venue,
        this.form.controls.latitudeDegrees,
        this.form.controls.longitudeDegrees,
      ];
      multiCityRequiredControls.forEach((control) =>
        control.setValidators(this.isMultiCity() ? Validators.required : null),
      );
      this.form.controls.competitorLimit.setValidators(
        this.isMultiCity() ? [Validators.required, Validators.min(1)] : null,
      );
      [...multiCityRequiredControls, this.form.controls.competitorLimit].forEach((control) =>
        control.updateValueAndValidity({ emitEvent: false }),
      );
      if (this.isMultiCity()) {
        this.form.controls.startDate.removeValidators(minStartDateValidator);
      } else {
        this.form.controls.startDate.addValidators(minStartDateValidator);
      }
      this.form.controls.startDate.updateValueAndValidity({ emitEvent: false });

      if (this.isLinked()) {
        wcaSyncedControls.forEach((control) => control.disable());
        locationControls.forEach((control) => control.disable());
        if (this.isMultiCity()) locationControls.forEach((control) => control.enable());
      } else {
        wcaSyncedControls.forEach((control) => control.enable());
        locationControls.forEach((control) => control.enable());
      }
    });

    effect(() => {
      this.form.controls.leadPeopleId.setValidators(this.isMajor() ? null : Validators.required);
      this.form.controls.leadPeopleId.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.southeastcubingApi.getPublicDelegates().subscribe({
      next: (roster) => this.delegateRoster.set(roster),
    });
  }

  toggleVenueFields(): void {
    this.showVenueFields.update((shown) => !shown);
  }

  setMajorCreate(enabled: boolean): void {
    if (this.majorCreate() === enabled) return;
    this.majorCreate.set(enabled);

    if (enabled) {
      const creatorPeopleId = this.defaultCreatorPeopleId;
      if (creatorPeopleId) {
        this.delegates.update((current) =>
          current.filter((delegate) => delegate.peopleId !== creatorPeopleId),
        );
        if (this.form.controls.leadPeopleId.value === creatorPeopleId) {
          this.form.controls.leadPeopleId.setValue(null);
        }
        this.defaultCreatorPeopleId = null;
      }
    }
    this.signalsDirty = true;
  }

  // Fires on a committed start date pick (calendar selection or blur),
  // defaults the end date to match when it's still empty (a single-day
  // competition is the common case).
  onStartDateChanged(value: Moment | null): void {
    if (value && !this.form.controls.endDate.value) {
      this.form.controls.endDate.setValue(value.clone());
    }
  }

  get isCreateMode(): boolean {
    return !this.competition();
  }

  isDirty(): boolean {
    return this.form.dirty || this.signalsDirty;
  }

  // Delegates/Organizers/Equipment/Events live in plain signals outside the
  // reactive form, so they never mark form.dirty on their own - this flag
  // backs isDirty() for changes to any of those lists.
  private signalsDirty = false;

  // se-person-search's WCA-ID fallback has no peopleId yet - resolved immediately.
  private resolveIfNeeded(person: SelectedPerson, onResolved: (resolved: PlannerPerson) => void) {
    if (person.peopleId) {
      onResolved(toPlannerPerson(person));
      return;
    }
    this.peopleApi.resolvePerson({ wcaId: person.wcaId }).subscribe({
      next: (resolved) => onResolved(toPlannerPerson(resolved)),
      error: (err) => this.toastService.error(err?.error?.message ?? 'Failed to resolve person.'),
    });
  }

  addDelegate(person: SelectedPerson) {
    this.resolveIfNeeded(person, (resolved) => {
      if (this.delegates().some((d) => d.peopleId === resolved.peopleId)) return;
      this.delegates.update((current) => [...current, resolved]);
      this.signalsDirty = true;
    });
  }

  // Removes Delegate from list of delegates and remvoes lead if the person
  // was the lead Delegate.
  removeDelegate(peopleId: string) {
    this.delegates.update((current) => current.filter((d) => d.peopleId !== peopleId));
    if (this.defaultCreatorPeopleId === peopleId) this.defaultCreatorPeopleId = null;
    this.signalsDirty = true;
    if (this.form.controls.leadPeopleId.value === peopleId) {
      this.form.controls.leadPeopleId.setValue(null);
    }
  }

  addOrganizer(person: SelectedPerson) {
    this.resolveIfNeeded(person, (resolved) => {
      if (this.organizers().some((o) => o.peopleId === resolved.peopleId)) return;
      this.organizers.update((current) => [...current, resolved]);
      this.signalsDirty = true;
    });
  }

  removeOrganizer(peopleId: string) {
    this.organizers.update((current) => current.filter((o) => o.peopleId !== peopleId));
    this.signalsDirty = true;
  }

  toggleEvent(eventId: string) {
    this.eventIds.update((current) =>
      current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId],
    );
    this.signalsDirty = true;
  }

  // Adds one icon selection without deduplicating repeated choices.
  addUnofficialEvent(icon: string): void {
    const option = this.unofficialIconOptions.find((candidate) => candidate.icon === icon);
    if (!option) return;
    this.unofficialEvents.update((current) =>
      sortUnofficialEventDrafts([
        ...current,
        { id: this.nextUnofficialEventDraftId++, eventName: option.name, icon },
      ]),
    );
    this.signalsDirty = true;
    this.unofficialEventSearchControl.setValue('');
    this.unofficialEventSearchQuery.set('');
  }

  // Updates one unofficial event's editable saved name.
  setUnofficialEventName(id: number, eventName: string): void {
    this.unofficialEvents.update((current) =>
      current.map((event) => (event.id === id ? { ...event, eventName } : event)),
    );
    this.signalsDirty = true;
  }

  // Reorders edited rows only after the name input loses focus.
  sortUnofficialEvents(): void {
    this.unofficialEvents.update((current) => sortUnofficialEventDrafts(current));
  }

  // Removes only the selected row, preserving other uses of the same icon.
  removeUnofficialEvent(id: number): void {
    this.unofficialEvents.update((current) => current.filter((event) => event.id !== id));
    this.signalsDirty = true;
  }

  // Keeps autocomplete filtering in sync with the search input.
  onUnofficialEventSearchInput(event: Event): void {
    this.unofficialEventSearchQuery.set((event.target as HTMLInputElement).value);
  }

  setEquipmentValues(values: string[]) {
    this.equipmentValues.set(values);
    this.signalsDirty = true;
  }

  setEquipmentDetails(peopleId: string, equipmentDetails: string): void {
    this.equipmentDetailsByHolder.update((current) => ({
      ...current,
      [peopleId]: equipmentDetails,
    }));
    this.signalsDirty = true;
  }

  save() {
    if (this.form.invalid || (!this.isMajor() && !this.delegates().length)) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const existing = this.competition();
    const { regularBody, majorBody } = buildCompetitionSaveBodies({
      value,
      delegates: this.delegates(),
      organizers: this.organizers(),
      equipmentAssignments: this.equipmentAssignments(),
      eventIds: this.eventIds(),
      unofficialEvents: this.unofficialEvents(),
      existing,
      isMajor: this.isMajor(),
    });

    this.saving = true;
    const request = existing
      ? this.competitionPlannerApi.updateCompetition(
          existing.id,
          this.isMajor() ? majorBody : regularBody,
        )
      : this.isMajor()
        ? this.competitionPlannerApi.createMajorCompetition(majorBody)
        : this.competitionPlannerApi.createCompetition(regularBody);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toastService.success(existing ? 'Competition updated.' : 'Competition created.');
        this.saved.emit();
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message ?? 'Failed to save competition.');
      },
    });
  }

  close() {
    this.closed.emit();
  }
}
