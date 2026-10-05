import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, EventNames, Events } from 'src/app/shared/types';
import { NgClass } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'se-event-list',
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatTooltipModule],
})
export class EventListComponent {
  Events = Events;
  EventNames = EventNames;
  Colors = Colors;
  selectedEvents = input<string[]>();
  selectEventEmitter = output<string>();

  // Whether an empty selection has every icon shown active (black),
  // or every / icon starts dimmed.
  emptyMeansAllSelected = input(true);

  // Precomputed colors for each event based on the selected events.
  eventColors = computed<Record<string, string>>(() => {
    const selected = this.selectedEvents();
    const noneSelected = !selected?.length;
    return Object.fromEntries(
      this.Events.map((event) => [
        event,
        (noneSelected ? this.emptyMeansAllSelected() : selected!.includes(event))
          ? Colors.black
          : Colors.darkGrey,
      ]),
    );
  });

  eventClicked(event: string) {
    this.selectEventEmitter.emit(event);
  }
}
