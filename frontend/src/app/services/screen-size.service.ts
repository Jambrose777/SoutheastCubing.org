import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ScreenSizeService {
  mobileScreenSize = 950;

  // A signal always replays its current value to new readers synchronously,
  // so consumers can read it directly with no timing workaround needed.
  isMobile = signal(false);

  constructor() {}

  setUpScreenSize() {
    this.isMobile.set(window.innerWidth <= this.mobileScreenSize);
    window.addEventListener('resize', () => {
      if (!this.isMobile() && window.innerWidth <= this.mobileScreenSize) {
        this.isMobile.set(true);
      } else if (this.isMobile() && window.innerWidth > this.mobileScreenSize) {
        this.isMobile.set(false);
      }
    });
  }
}
