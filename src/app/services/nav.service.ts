import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NavService {
  closeNavSubject = new Subject<boolean>();

  constructor() {
  }

  getCloseNavSubject(): Subject<boolean> {
    return this.closeNavSubject;
  }

  closeNav() {
    this.closeNavSubject.next(true);
  }
}
