import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, StateColors, States } from 'src/app/shared/types';

@Component({
  selector: 'se-filter-map',
  templateUrl: './se-filter-map.component.html',
  styleUrls: ['./se-filter-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SeFilterMapComponent {
  StateColors = StateColors;
  Colors = Colors;
  States = States;
  selectedStates = input<States[]>();
  selectStateEmitter = output<States>();

  constructor() {}

  stateClicked(state: States) {
    this.selectStateEmitter.emit(state);
  }
}
