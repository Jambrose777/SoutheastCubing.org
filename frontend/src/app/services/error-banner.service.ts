import { Injectable, signal } from '@angular/core';

// How long a shown message stays up before auto-dismissing, in ms.
const AUTO_DISMISS_MS = 10000;

// Generic, reusable "something failed and needs your attention" banner
// state - callers just call show() with their own message.
@Injectable({
  providedIn: 'root',
})
export class ErrorBannerService {
  private messageSignal = signal<string | null>(null);
  message = this.messageSignal.asReadonly();

  // Shows `message` in the shared banner, auto-dismissing after AUTO_DISMISS_MS.
  // A later call with a different message simply replaces the current one and
  // restarts the timer.
  show(message: string) {
    this.messageSignal.set(message);
    setTimeout(() => {
      // Only clear if this call's message is still the one showing - an
      // earlier show()'s timer firing after a newer message replaced it
      // shouldn't dismiss that newer message early.
      if (this.messageSignal() === message) {
        this.messageSignal.set(null);
      }
    }, AUTO_DISMISS_MS);
  }

  dismiss() {
    this.messageSignal.set(null);
  }
}
