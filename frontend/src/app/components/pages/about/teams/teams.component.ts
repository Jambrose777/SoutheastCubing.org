import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { Team } from 'src/app/models/Team';
import { NgClass } from '@angular/common';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';

@Component({
  selector: 'se-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, AvatarComponent],
})
export class TeamsComponent {
  teams = input<Team[]>();
}
