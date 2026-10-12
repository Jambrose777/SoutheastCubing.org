import * as moment from 'moment';
import { AbstractControl } from '@angular/forms';

// Converts a backend date column (serialized as an ISO datetime string, e.g.
// "2026-07-21T04:00:00.000Z") to the plain "YYYY-MM-DD" an <input type="date">
// expects.
export function toDateInputValue(date: string | null): string | null {
  return date ? moment.utc(date).format('YYYY-MM-DD') : null;
}

// Formats a date for human-readable display as "MMM D, YYYY".
export function formatLongDate(date: string): string {
  return moment.utc(date).format('MMM D, YYYY');
}

// Returns the user's local calendar date one day before today as YYYY-MM-DD.
export function getYesterdayDateString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Returns the first day of the current local month as YYYY-MM-DD.
export function currentMonthDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}

// Formats a timestamp in the user's local timezone.
export function formatLongDateTime(date: string): string {
  return moment.utc(date).local().format('MMM D, YYYY h:mm A');
}

// Formats a timestamp as a concise relative time (e.g. "5 minutes ago").
export function formatRelativeTime(timestamp: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];
  const [unit, unitSeconds] = units.find(([, seconds]) => elapsedSeconds >= seconds) ?? [
    'second',
    1,
  ];
  const value = Math.floor(elapsedSeconds / unitSeconds);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-value, unit);
}

// Formats a competition date range using compact month/year-aware grouping.
export function formatLongDateRange(startDate: string, endDate: string | null): string {
  const start = moment.utc(startDate);
  if (endDate === null) {
    return `${formatLongDate(startDate)} - present`;
  }

  const end = moment.utc(endDate);
  if (start.isSame(end, 'day')) {
    return formatLongDate(startDate);
  }
  if (start.isSame(end, 'year')) {
    if (start.isSame(end, 'month')) {
      return `${start.format('MMM D')} - ${end.format('D, YYYY')}`;
    }
    return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
  }
  return `${formatLongDate(startDate)} - ${formatLongDate(endDate)}`;
}

// Formats the weekday or weekday range for date-only values.
export function formatWeekdayDateRange(startDate: string, endDate: string | null): string {
  const start = moment.utc(startDate);
  if (endDate === null || start.isSame(endDate, 'day')) {
    return start.format('dddd');
  }

  return `${start.format('dddd')} - ${moment.utc(endDate).format('dddd')}`;
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
