import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl' })
export class SafeUrlPipe implements PipeTransform {
  private domSanitizer = inject(DomSanitizer);

  transform(url) {
    return this.domSanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
