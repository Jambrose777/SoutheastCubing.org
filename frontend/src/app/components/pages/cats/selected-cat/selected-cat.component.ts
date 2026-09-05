import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Cat } from 'src/app/models/Cat';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'se-selected-cat',
  templateUrl: './selected-cat.component.html',
  styleUrls: ['./selected-cat.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SelectedCatComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  selectedCat = input<Cat>();
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(
      this.screenSizeService
        .getIsMobileSubject()
        .subscribe((isMobile) => (this.isMobile = isMobile)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
