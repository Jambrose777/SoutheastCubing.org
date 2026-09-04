import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Team } from 'src/app/models/Team';

@Component({
    selector: 'se-teams',
    templateUrl: './teams.component.html',
    styleUrls: ['./teams.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamsComponent implements OnInit {
  @Input() teams: Team[];

  constructor() { }

  ngOnInit(): void { }

}
