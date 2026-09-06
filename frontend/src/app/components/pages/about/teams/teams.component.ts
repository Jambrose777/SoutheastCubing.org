import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { Team } from 'src/app/models/Team';
import { NgClass, NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'se-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, NgOptimizedImage],
})
export class TeamsComponent {
  teams = input<Team[]>();
}
