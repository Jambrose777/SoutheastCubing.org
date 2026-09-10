import { Pipe, PipeTransform } from '@angular/core';

// Strips the trailing year WCA appends to every competition name (e.g.
// "Atlanta Open 2026" -> "Atlanta Open").
@Pipe({ name: 'stripYear' })
export class StripYearPipe implements PipeTransform {
  transform(name: string): string {
    return name.replace(/\s*\d{4}$/, '');
  }
}
