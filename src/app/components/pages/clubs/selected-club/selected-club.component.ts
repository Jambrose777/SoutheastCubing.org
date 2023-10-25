import { Component, Input, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { isMobile } from 'src/app/shared/functions';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-club',
  templateUrl: './selected-club.component.html',
  styleUrls: ['./selected-club.component.scss']
})
export class SelectedClubComponent implements OnInit {
  isMobile = isMobile();
  enviroment = environment;
  @Input() selectedClub: Club;

  constructor() { }

  ngOnInit(): void {
  }

}
