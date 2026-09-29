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

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  // How much of the auto-dismiss window is left - only meaningful while
  // paused, so a resume() can pick back up where pause() left off instead of
  // restarting the full window.
  private remainingMs = AUTO_DISMISS_MS;
  private timerStartedAt = 0;

  // Shows `message` in the shared banner, auto-dismissing after AUTO_DISMISS_MS.
  // A later call with a different message simply replaces the current one and
  // restarts the timer.
  show(message: string) {
    this.clearTimer();
    this.messageSignal.set(message);
    this.remainingMs = AUTO_DISMISS_MS;
    this.startTimer();
  }

  // Freezes the auto-dismiss countdown.
  pause() {
    if (this.timeoutId === null) {
      return;
    }
    this.remainingMs -= Date.now() - this.timerStartedAt;
    this.clearTimer();
  }

  // Picks the countdown back up from wherever pause() left it.
  resume() {
    if (this.messageSignal() === null || this.timeoutId !== null) {
      return;
    }
    this.startTimer();
  }

  dismiss() {
    this.clearTimer();
    this.messageSignal.set(null);
  }

  private startTimer() {
    this.timerStartedAt = Date.now();
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.messageSignal.set(null);
    }, this.remainingMs);
  }

  private clearTimer() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
