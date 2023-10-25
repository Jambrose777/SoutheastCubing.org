import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Colors, Events } from 'src/app/shared/types';

@Component({
  selector: 'se-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss']
})
export class EventListComponent implements OnInit {
  Events = Events;
  Colors = Colors;
  @Input() selectedEvents: string[];
  @Output() selectEventEmitter = new EventEmitter<string>();

  constructor() { }

  ngOnInit(): void {
  }

  eventClicked(event: string) {
    this.selectEventEmitter.emit(event);
  }

}
