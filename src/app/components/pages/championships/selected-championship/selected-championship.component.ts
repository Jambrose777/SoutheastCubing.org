import { Component, Input, OnInit } from '@angular/core';
import { Championship } from 'src/app/models/Championship';
import { isMobile } from 'src/app/shared/functions';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-championship',
  templateUrl: './selected-championship.component.html',
  styleUrls: ['./selected-championship.component.scss']
})
export class SelectedChampionshipComponent implements OnInit {
  isMobile = isMobile();
  enviroment = environment;
  @Input() selectedChampionship: Championship;

  constructor() { }

  ngOnInit(): void {
  }

}
