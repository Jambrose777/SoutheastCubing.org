import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Delegate } from 'src/app/models/Delegate';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { NgOptimizedImage } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent, NgOptimizedImage],
})
export class SelectedDelegateComponent {
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  enviroment = environment;
  selectedDelegate = input<Delegate>();

  // Single-item array for the @for that keys the photo <img>, memoized so its
  // reference only changes when the photo URL itself changes.
  photoAsArray = computed(() => {
    const photo = this.selectedDelegate()?.photo;
    return photo ? [photo] : [];
  });
}
