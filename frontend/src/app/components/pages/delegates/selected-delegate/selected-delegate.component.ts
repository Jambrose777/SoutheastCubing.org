import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Delegate } from 'src/app/models/Delegate';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MarkdownComponent],
})
export class SelectedDelegateComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  enviroment = environment;
  selectedDelegate = input<Delegate>();
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
