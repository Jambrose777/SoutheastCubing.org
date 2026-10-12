export interface PlannerMajorHoliday {
  name: string;
  date: string;
}

// Formats calendar parts as a date-only ISO string without timezone conversion.
function toDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Returns the date of the requested weekday occurrence in a month.
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): string {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (occurrence - 1) * 7;
  return toDateString(year, month, day);
}

// Returns the final occurrence of a weekday in a month.
function lastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const day = lastDay.getUTCDate() - ((lastDay.getUTCDay() - weekday + 7) % 7);
  return toDateString(year, month, day);
}

// Calculates Western Easter Sunday with the Gregorian computus.
function easterSunday(year: number): string {
  const century = Math.floor(year / 100);
  const yearWithinCentury = year % 100;
  const leapCentury = Math.floor(century / 4);
  const centuryRemainder = century % 4;
  const lunarCorrection = Math.floor((century + 8) / 25);
  const solarCorrection = Math.floor((century - lunarCorrection + 1) / 3);
  const epact = (19 * (year % 19) + century - leapCentury - solarCorrection + 15) % 30;
  const leapYears = Math.floor(yearWithinCentury / 4);
  const yearRemainder = yearWithinCentury % 4;
  const weekdayCorrection = (32 + 2 * centuryRemainder + 2 * leapYears - epact - yearRemainder) % 7;
  const phaseCorrection = Math.floor(((year % 19) + 11 * epact + 22 * weekdayCorrection) / 451);
  const month = Math.floor((epact + weekdayCorrection - 7 * phaseCorrection + 114) / 31);
  const day = ((epact + weekdayCorrection - 7 * phaseCorrection + 114) % 31) + 1;
  return toDateString(year, month, day);
}

// Returns the requested US holidays, sorted by their exact calendar date.
export function getPlannerMajorHolidays(year: number): PlannerMajorHoliday[] {
  return [
    { name: "New Year's Day", date: toDateString(year, 1, 1) },
    { name: 'Easter', date: easterSunday(year) },
    { name: "Mother's Day", date: nthWeekdayOfMonth(year, 5, 0, 2) },
    { name: 'Memorial Day', date: lastWeekdayOfMonth(year, 5, 1) },
    { name: "Father's Day", date: nthWeekdayOfMonth(year, 6, 0, 3) },
    { name: 'July 4th', date: toDateString(year, 7, 4) },
    { name: 'Labor Day', date: nthWeekdayOfMonth(year, 9, 1, 1) },
    { name: 'Columbus Day', date: nthWeekdayOfMonth(year, 10, 1, 2) },
    { name: 'Halloween', date: toDateString(year, 10, 31) },
    { name: 'Thanksgiving', date: nthWeekdayOfMonth(year, 11, 4, 4) },
    { name: 'Christmas', date: toDateString(year, 12, 25) },
  ].sort((left, right) => left.date.localeCompare(right.date));
}

// Returns holiday dates in an inclusive ISO date range across calendar years.
export function getPlannerMajorHolidaysBetween(
  startDate: string,
  endDate: string,
): PlannerMajorHoliday[] {
  if (startDate > endDate) return [];

  const firstYear = Number(startDate.slice(0, 4));
  const lastYear = Number(endDate.slice(0, 4));
  const holidays: PlannerMajorHoliday[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    holidays.push(...getPlannerMajorHolidays(year));
  }

  return holidays.filter(({ date }) => date >= startDate && date <= endDate);
}
