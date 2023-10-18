import { Component, Input, OnInit } from '@angular/core';
import { SubTopic } from 'src/app/models/SubTopic';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'se-selected-sub-topic',
  templateUrl: './selected-sub-topic.component.html',
  styleUrls: ['./selected-sub-topic.component.scss']
})
export class SelectedSubTopicComponent implements OnInit {
  isMobile = isMobile();
  @Input() selectedSubTopic: SubTopic;

  constructor() { }

  ngOnInit(): void {
  }

}
