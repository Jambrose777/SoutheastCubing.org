import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl' })
export class SafeUrlPipe implements PipeTransform {
  private domSanitizer = inject(DomSanitizer);

  transform(url: string) {
    // Only http(s) URLs are ever trusted here — this blocks javascript:, data:,
    // and other schemes that could execute in the embedding iframe if a bad
    // venue_address (or similar untrusted input) ever reached this pipe.
    if (!url?.startsWith('http://') && !url?.startsWith('https://')) {
      console.warn(`SafeUrlPipe rejected an untrusted URL: ${url}`);
      return null;
    }

    return this.domSanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
