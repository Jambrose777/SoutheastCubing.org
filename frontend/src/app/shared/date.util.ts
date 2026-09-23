import * as moment from 'moment';
import { AbstractControl } from '@angular/forms';

// Converts a backend date column (serialized as an ISO datetime string, e.g.
// "2026-07-21T04:00:00.000Z") to the plain "YYYY-MM-DD" an <input type="date">
// expects.
export function toDateInputValue(date: string | null): string | null {
  return date ? moment.utc(date).format('YYYY-MM-DD') : null;
}

// Formats a backend date column for human-readable display, as MM/DD/YYYY.
export function formatDate(date: string): string {
  return moment.utc(date).format('MM/DD/YYYY');
}

// A native <input type="date"> reports an empty string for BOTH "left
// blank on purpose" and "typed something the browser couldn't parse as a
// complete date" (e.g. "30" in the month segment) - there's no way to tell
// those apart from the FormControl's value alone, since both look like "".
export function checkBadDateInput(event: Event, control: AbstractControl): void {
  const input = event.target as HTMLInputElement;
  if (input.validity.badInput) {
    control.markAsTouched();
    control.setErrors({ ...control.errors, badDate: true });
  } else if (control.hasError('badDate')) {
    const remainingErrors = { ...control.errors };
    delete remainingErrors['badDate'];
    control.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
  }
}
