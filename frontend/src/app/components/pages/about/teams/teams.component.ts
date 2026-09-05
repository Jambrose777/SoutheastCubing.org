import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { Team } from 'src/app/models/Team';
import { NgClass } from '@angular/common';

@Component({
  selector: 'se-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgClass],
})
export class TeamsComponent {
  teams = input<Team[]>();

  constructor() {}
}
