import {
  Component,
  input,
  OnDestroy,
  OnInit,
  output,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { NavService } from 'src/app/services/nav.service';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'se-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, RouterLink],
})
export class NavComponent implements OnInit, OnDestroy {
  private navService = inject(NavService);

  isNavActive = input(false);
  transition = input(false);
  toggleNavEmitter = output<boolean>();
  subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.navService.closeNavSubject.subscribe(() => {
        if (this.isNavActive()) {
          this.toggleNav();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Opens / Closes the nav controls
  toggleNav() {
    this.toggleNavEmitter.emit(!this.isNavActive());
  }
}
