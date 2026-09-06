import { Component, input, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Cat } from 'src/app/models/Cat';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'se-selected-cat',
  templateUrl: './selected-cat.component.html',
  styleUrls: ['./selected-cat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
})
export class SelectedCatComponent {
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  selectedCat = input<Cat>();

  // Single-item array for the @for that keys the photo <img>, memoized so its
  // reference only changes when the photo URL itself changes.
  photoAsArray = computed(() => {
    const photo = this.selectedCat()?.photo;
    return photo ? [photo] : [];
  });
}
