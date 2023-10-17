import { Component, Input, OnInit } from '@angular/core';
import { Delegate } from 'src/app/models/Delegate';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss']
})
export class SelectedDelegateComponent implements OnInit {
  isMobile = isMobile();
  @Input() selectedDelegate: Delegate;

  constructor() { }

  ngOnInit(): void {
  }

}
