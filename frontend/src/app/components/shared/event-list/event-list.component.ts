import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, Events } from 'src/app/shared/types';
import { NgClass } from '@angular/common';

@Component({
  selector: 'se-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass],
})
export class EventListComponent {
  Events = Events;
  Colors = Colors;
  selectedEvents = input<string[]>();
  selectEventEmitter = output<string>();

  constructor() {}

  eventClicked(event: string) {
    this.selectEventEmitter.emit(event);
  }
}
