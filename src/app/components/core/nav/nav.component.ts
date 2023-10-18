import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { NavService } from 'src/app/services/nav.service';

@Component({
  selector: 'se-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss']
})
export class NavComponent implements OnInit, OnDestroy {
  @Input() isNavActive = false;
  @Input() transition = false;
  @Output() toggleNavEmitter = new EventEmitter<boolean>();
  subscriptions = new Subscription();

  constructor(private navService: NavService) { }

  ngOnInit(): void {
    this.subscriptions.add(this.navService.closeNavSubject.subscribe((closeNav) => {
      if (this.isNavActive) {
        this.toggleNav();
      }
    }))
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Opens / Closes the nav controls
  toggleNav() {
    this.toggleNavEmitter.emit(!this.isNavActive);
  }

}
