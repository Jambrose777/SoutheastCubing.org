import { Component, Input, OnInit } from '@angular/core';
import { SubTopic } from 'src/app/models/SubTopic';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss']
})
export class SelectedSubTopicComponent implements OnInit {
  isMobile: boolean;
  @Input() selectedSubTopic: SubTopic;

  constructor(
    private screenSizeService: ScreenSizeService
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);
  }

}
