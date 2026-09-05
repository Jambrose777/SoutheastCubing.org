import { Component, input, ChangeDetectionStrategy, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Cat } from 'src/app/models/Cat';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'se-selected-cat',
  templateUrl: './selected-cat.component.html',
  styleUrls: ['./selected-cat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectedCatComponent {
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  selectedCat = input<Cat>();
}
