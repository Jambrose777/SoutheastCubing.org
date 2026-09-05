import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { SubTopic } from 'src/app/models/SubTopic';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { MarkdownComponent } from 'ngx-markdown';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MarkdownComponent, RouterLink],
})
export class SelectedSubTopicComponent implements OnInit, OnDestroy {
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  selectedSubTopic = input<SubTopic>();
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
