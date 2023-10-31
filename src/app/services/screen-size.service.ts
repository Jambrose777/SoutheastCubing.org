import { HostListener, Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScreenSizeService {
  isMobile = false;
  mobileScreenSize = 950;
  isMobileSubject = new Subject<boolean>();

  constructor() { }
  
  setUpScreenSize() {
    this.isMobile = window.innerWidth <= this.mobileScreenSize;
    window.addEventListener('resize', () => {
      if(!this.isMobile && window.innerWidth <= this.mobileScreenSize) {
        this.isMobile = true;
        this.isMobileSubject.next(this.isMobile);
      } else if(this.isMobile && window.innerWidth > this.mobileScreenSize) {
        this.isMobile = false;
        this.isMobileSubject.next(this.isMobile);
      }
    });
  }

  getIsMobileSubject() {
    setTimeout(() => {
      this.isMobileSubject.next(this.isMobile);
    }, 0)
    return this.isMobileSubject;
  }
}
