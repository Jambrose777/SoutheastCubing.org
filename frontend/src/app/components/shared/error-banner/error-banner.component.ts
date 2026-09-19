import { Component, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import { ErrorBannerService } from 'src/app/services/error-banner.service';

// How long the slide-up exit animation takes to play, in ms.
const CLOSE_ANIMATION_MS = 400;

// Shared, generic-copy-capable banner for a failure serious enough to need
// the user's sustained attention (as opposed to a lighter toast - see
// ToastService).
@Component({
  selector: 'se-error-banner',
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBannerComponent {
  errorBannerService = inject(ErrorBannerService);

  // Kept true for the duration of the slide-up exit animation after
  // message() goes null (whether from the close button or the service's
  // own auto-dismiss), so the element isn't yanked out of the DOM
  // mid-animation.
  closing = signal(false);
  visible = signal(false);
  lastMessage = signal('');

  constructor() {
    effect(() => {
      const message = this.errorBannerService.message();
      if (message !== null) {
        this.lastMessage.set(message);
        this.visible.set(true);
      } else if (this.visible()) {
        this.visible.set(false);
        this.closing.set(true);
        setTimeout(() => this.closing.set(false), CLOSE_ANIMATION_MS);
      }
    });
  }

  dismiss() {
    this.errorBannerService.dismiss();
  }
}
