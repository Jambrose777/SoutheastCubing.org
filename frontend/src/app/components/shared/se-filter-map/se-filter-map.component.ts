import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, StateColors, States } from 'src/app/shared/types';

@Component({
  selector: 'se-filter-map',
  templateUrl: './se-filter-map.component.html',
  styleUrls: ['./se-filter-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SeFilterMapComponent {
  StateColors = StateColors;
  Colors = Colors;
  States = States;
  @Input() selectedStates: States[];
  @Output() selectStateEmitter = new EventEmitter<States>();

  constructor() {}

  stateClicked(state: States) {
    this.selectStateEmitter.emit(state);
  }
}
