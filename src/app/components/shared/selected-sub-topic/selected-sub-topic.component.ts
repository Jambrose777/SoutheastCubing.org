import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SubTopic } from 'src/app/models/SubTopic';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss']
})
export class SelectedSubTopicComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  @Input() selectedSubTopic: SubTopic;
  subscriptions: Subscription = new Subscription();

  constructor(
    private screenSizeService: ScreenSizeService
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}
