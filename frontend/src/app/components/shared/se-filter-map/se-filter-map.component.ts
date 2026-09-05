import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Colors, StateColors, States } from 'src/app/shared/types';

@Component({
  selector: 'se-filter-map',
  templateUrl: './se-filter-map.component.html',
  styleUrls: ['./se-filter-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeFilterMapComponent {
  StateColors = StateColors;
  Colors = Colors;
  States = States;
  selectedStates = input<States[]>();
  selectStateEmitter = output<States>();

  // Precomputed fill colors for each state based on the selected states.
  stateFillColors = computed<Record<States, string>>(() => {
    const selected = this.selectedStates();
    return Object.fromEntries(
      Object.values(States).map((state) => [
        state,
        !selected?.length || selected.includes(state) ? StateColors[state] : Colors.grey,
      ]),
    ) as Record<States, string>;
  });

  stateClicked(state: States) {
    this.selectStateEmitter.emit(state);
  }
}
