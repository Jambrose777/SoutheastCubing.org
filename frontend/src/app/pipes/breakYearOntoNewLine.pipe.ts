import { Pipe, PipeTransform } from '@angular/core';

// Breaks the year in a formatted date (e.g. "Mar 15, 2026" or
// "Mar 15 - 16, 2026") onto its own line (and drops the now-redundant comma.
@Pipe({ name: 'breakYearOntoNewLine' })
export class BreakYearOntoNewLinePipe implements PipeTransform {
  transform(fullDate?: string): string {
    return fullDate?.replace(/,\s*(\d{4})$/, '\n$1') ?? '';
  }
}
