import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavService {
  // `closeNav()` represents a one-off event, not state, so an
  // ever-incrementing counter guarantees every call produces a
  // new value, so every call is observed downstream.
  private closeNavTrigger = signal(0);
  closeNavSignal = this.closeNavTrigger.asReadonly();

  constructor() {}

  closeNav() {
    this.closeNavTrigger.update((count) => count + 1);
  }
}
