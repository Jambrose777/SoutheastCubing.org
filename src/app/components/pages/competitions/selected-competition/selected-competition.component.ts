import { Component, Input, OnInit } from '@angular/core';
import { Competition } from 'src/app/models/Competition';
import { isMobile } from 'src/app/shared/functions';
import { RegistrationStatus } from 'src/app/shared/types';

@Component({
  selector: 'se-selected-competition',
  templateUrl: './selected-competition.component.html',
  styleUrls: ['./selected-competition.component.scss']
})
export class SelectedCompetitionComponent implements OnInit {
  isMobile = isMobile();
  RegistrationStatus = RegistrationStatus;
  @Input() selectedCompetition: Competition;

  constructor() { }

  ngOnInit(): void {
  }

}
