import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import * as moment from 'moment';
import { Moment } from 'moment';

// WCA competitions need at least this many days notice.
const MIN_START_DATE_LEAD_DAYS = 28;

// Rejects start dates earlier than the WCA announcement lead-time cutoff.
export const minStartDateValidator: ValidatorFn = (control) => {
  if (!control.value) return null;
  const minimumDate = moment.utc().add(MIN_START_DATE_LEAD_DAYS, 'days').startOf('day');
  return (control.value as Moment).isBefore(minimumDate) ? { minStartDate: true } : null;
};

// Returns the datepicker minimum matching the form validator.
export function getMinimumStartDate(): Moment {
  return moment.utc().add(MIN_START_DATE_LEAD_DAYS, 'days').startOf('day');
}

// Creates the typed controls and base validation rules for the sheet.
export function createCompetitionForm() {
  return new FormGroup({
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
}
