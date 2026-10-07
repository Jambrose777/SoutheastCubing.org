import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  effect,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  ValidatorFn,
} from '@angular/forms';
import { MatFormField, MatLabel, MatError, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { CompetitionPlannerApiService } from 'src/app/services/southeastcubing-api/competition-planner-api.service';
import { PeopleApiService } from 'src/app/services/southeastcubing-api/people-api.service';
import { SoutheastcubingApiService } from 'src/app/services/southeastcubing-api/southeastcubing-api.service';
import { AuthService } from 'src/app/services/southeastcubing-api/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { States } from 'src/app/shared/types';
import * as moment from 'moment';
import { Moment } from 'moment';
import {
  PlannerCompetition,
  PlannerCompetitionSaveRequest,
  PlannerPerson,
} from 'src/app/models/PlannerCompetition';
import { Delegate } from 'src/app/models/Delegate';
import { SelectedPerson } from 'src/app/models/Person';
import { AvatarComponent } from '../../../../shared/avatar/avatar.component';
import { PersonSearchComponent } from '../../../../shared/person-search/person-search.component';
import { EventListComponent } from '../../../../shared/event-list/event-list.component';

// Sentinel value standing in for the plain "Other" Equipment option.
const OTHER_EQUIPMENT_VALUE = '__other__';

// WCA competitions need at least this many days' notice.
const MIN_START_DATE_LEAD_DAYS = 28;

const minStartDateValidator: ValidatorFn = (control) => {
  if (!control.value) return null;
  const minDate = moment.utc().add(MIN_START_DATE_LEAD_DAYS, 'days').startOf('day');
  return (control.value as Moment).isBefore(minDate) ? { minStartDate: true } : null;
};

function toPlannerPerson(person: SelectedPerson): PlannerPerson {
  return {
    peopleId: person.peopleId ?? '',
    name: person.name,
    wcaId: person.wcaId ?? null,
    pictureUrl: person.pictureUrl,
    thumbnailCropX: person.thumbnailCropX ?? null,
    thumbnailCropY: person.thumbnailCropY ?? null,
    thumbnailCropW: person.thumbnailCropW ?? null,
    thumbnailCropH: person.thumbnailCropH ?? null,
  };
}

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
    MatSelect,
    MatOption,
    MatDatepickerModule,
    AvatarComponent,
    PersonSearchComponent,
    EventListComponent,
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
  closed = output<void>();
  saved = output<void>();

  // Disables every date earlier than the minimum in the Start date
  // calendar, matching minStartDateValidator/the backend's own minimum.
  minStartDate = moment.utc().add(MIN_START_DATE_LEAD_DAYS, 'days').startOf('day');

  saving = false;
  stateOptions = Object.values(States);
  otherEquipmentValue = OTHER_EQUIPMENT_VALUE;

  // All venue fields start collapsed behind a "Show Venue fields" toggle.
  showVenueFields = signal(false);

  delegateRoster = signal<Delegate[]>([]);
  // Equipment's own options list - alphabetical by name, regardless of
  // whatever order the roster endpoint returns.
  equipmentOptions = computed(() =>
    [...this.delegateRoster()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  delegates = signal<PlannerPerson[]>([]);
  organizers = signal<PlannerPerson[]>([]);
  // Equipment holder ids, drawn from this sheet's own Delegates list.
  equipmentValues = signal<string[]>([]);
  eventIds = signal<string[]>([]);

  // Status is derived once, since create mode (competition() === null) is
  // always Potential - only an existing competition can already be linked.
  isLinked = computed(() => (this.competition()?.status ?? 'potential') !== 'potential');

  form = new FormGroup({
    name: new FormControl('', Validators.required),
    city: new FormControl('', Validators.required),
    state: new FormControl<string | null>(null, Validators.required),
    venueAddress: new FormControl(''),
    venueDetails: new FormControl(''),
    venue: new FormControl(''),
    venueUrl: new FormControl(''),
    latitudeDegrees: new FormControl<number | null>(null),
    longitudeDegrees: new FormControl<number | null>(null),
    startDate: new FormControl<Moment | null>(null, [Validators.required, minStartDateValidator]),
    endDate: new FormControl<Moment | null>(null, Validators.required),
    competitorLimit: new FormControl<number | null>(null),
    leadPeopleId: new FormControl<string | null>(null, Validators.required),
    createWcaDriveFolder: new FormControl(true, { nonNullable: true }),
    wcaDriveLink: new FormControl(''),
  });

  // Lead must already be one of this sheet's own Delegates.
  delegateOptions = computed(() => this.delegates());

  constructor() {
    // Reseeds the form/lists whenever a different competition is opened, or
    // the sheet is switched into create mode.
    effect(() => {
      const comp = this.competition();
      // Creating a new entry auto-populates the Delegates list with the
      // creating Delegate and makes them the lead - editing an existing
      // competition always starts from its own stored Delegates/lead.
      const user = this.authService.currentUser();
      const defaultDelegates: PlannerPerson[] =
        !comp && user?.peopleId
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
      this.equipmentValues.set(
        (comp?.equipmentHolders ?? []).map((holder) =>
          holder.peopleId === null ? OTHER_EQUIPMENT_VALUE : holder.peopleId,
        ),
      );
      this.eventIds.set(comp?.event_ids ?? []);
      this.signalsDirty = false;

      // WCA-synced fields are read-only once linked - only Equipment and
      // the lead pick stay editable regardless of status.
      const wcaSyncedControls = [
        this.form.controls.name,
        this.form.controls.city,
        this.form.controls.state,
        this.form.controls.venueAddress,
        this.form.controls.venueDetails,
        this.form.controls.venue,
        this.form.controls.venueUrl,
        this.form.controls.latitudeDegrees,
        this.form.controls.longitudeDegrees,
        this.form.controls.startDate,
        this.form.controls.endDate,
        this.form.controls.competitorLimit,
      ];
      if (this.isLinked()) {
        wcaSyncedControls.forEach((control) => control.disable());
      } else {
        wcaSyncedControls.forEach((control) => control.enable());
      }
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

  setEquipmentValues(values: string[]) {
    this.equipmentValues.set(values);
    this.signalsDirty = true;
  }

  save() {
    if (this.form.invalid || !this.delegates().length) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const leadPeopleId = value.leadPeopleId ?? '';
    const equipmentPeopleIds = this.equipmentValues().map((v) =>
      v === OTHER_EQUIPMENT_VALUE ? null : v,
    );

    const body: PlannerCompetitionSaveRequest = {
      name: value.name ?? '',
      city: value.city ?? '',
      state: value.state ?? '',
      venueAddress: value.venueAddress || null,
      venueDetails: value.venueDetails || null,
      venue: value.venue || null,
      venueUrl: value.venueUrl || null,
      latitudeDegrees: value.latitudeDegrees,
      longitudeDegrees: value.longitudeDegrees,
      startDate: value.startDate?.format('YYYY-MM-DD') ?? '',
      endDate: value.endDate?.format('YYYY-MM-DD') ?? '',
      competitorLimit: value.competitorLimit,
      leadPeopleId,
      delegatePeopleIds: this.delegates().map((d) => d.peopleId),
      organizerPeopleIds: this.organizers().map((o) => o.peopleId),
      equipmentPeopleIds,
      eventIds: this.eventIds(),
    };

    const existing = this.competition();
    if (existing) {
      const wcaDriveLink = value.wcaDriveLink?.trim() ?? '';
      if (wcaDriveLink !== (existing.wca_drive_link ?? '')) {
        body.wcaDriveLink = wcaDriveLink || null;
      }
    } else {
      body.createWcaDriveFolder = value.createWcaDriveFolder;
      if (!value.createWcaDriveFolder && value.wcaDriveLink?.trim()) {
        body.wcaDriveLink = value.wcaDriveLink.trim();
      }
    }

    this.saving = true;
    const request = existing
      ? this.competitionPlannerApi.updateCompetition(existing.id, body)
      : this.competitionPlannerApi.createCompetition(body);

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
