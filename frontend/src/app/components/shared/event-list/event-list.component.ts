import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, Events } from 'src/app/shared/types';

@Component({
  selector: 'se-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EventListComponent {
  Events = Events;
  Colors = Colors;
  @Input() selectedEvents: string[];
  @Output() selectEventEmitter = new EventEmitter<string>();

  constructor() {}

  eventClicked(event: string) {
    this.selectEventEmitter.emit(event);
  }
}
