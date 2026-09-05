import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, Events } from 'src/app/shared/types';
import { NgClass } from '@angular/common';

@Component({
  selector: 'se-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
})
export class EventListComponent {
  Events = Events;
  Colors = Colors;
  selectedEvents = input<string[]>();
  selectEventEmitter = output<string>();

  // Precomputed colors for each event based on the selected events.
  eventColors = computed<Record<string, string>>(() => {
    const selected = this.selectedEvents();
    return Object.fromEntries(
      this.Events.map((event) => [
        event,
        !selected?.length || selected.includes(event) ? Colors.black : Colors.grey,
      ]),
    );
  });

  eventClicked(event: string) {
    this.selectEventEmitter.emit(event);
  }
}
