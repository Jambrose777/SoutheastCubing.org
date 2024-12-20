import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Colors, StateColors, States } from 'src/app/shared/types';

@Component({
  selector: 'se-filter-map',
  templateUrl: './se-filter-map.component.html',
  styleUrls: ['./se-filter-map.component.scss']
})
export class SeFilterMapComponent implements OnInit {
  StateColors = StateColors;
  Colors = Colors;
  States = States;
  @Input() selectedStates: States[];
  @Output() selectStateEmitter = new EventEmitter<States>();

  constructor() { }

  ngOnInit(): void {
  }

  stateClicked(state: States) {
    this.selectStateEmitter.emit(state);
  }

}
