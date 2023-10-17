import { Component, Input, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'se-selected-club',
  templateUrl: './selected-club.component.html',
  styleUrls: ['./selected-club.component.scss']
})
export class SelectedClubComponent implements OnInit {
  isMobile = isMobile();
  @Input() selectedClub: Club;

  constructor() { }

  ngOnInit(): void {
  }

}
