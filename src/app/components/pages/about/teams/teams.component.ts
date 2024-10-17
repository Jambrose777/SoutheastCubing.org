import { Component, Input, OnInit } from '@angular/core';
import { Team } from 'src/app/models/Team';

@Component({
  selector: 'se-teams',
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.scss']
})
export class TeamsComponent implements OnInit {
  @Input() teams: Team[];

  constructor() { }

  ngOnInit(): void { }

}
