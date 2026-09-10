import { Pipe, PipeTransform } from '@angular/core';

// Breaks the trailing state abbreviation in a "City, ST" string
// onto its own line (and drops the now-redundant comma).
@Pipe({ name: 'breakStateOntoNewLine' })
export class BreakStateOntoNewLinePipe implements PipeTransform {
  transform(city?: string): string {
    return city?.replace(/,\s*([A-Za-z]{2})$/, '\n$1') ?? '';
  }
}
