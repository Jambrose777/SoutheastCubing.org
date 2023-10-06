import { Component, Input, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() title: string = 'Southeast Cubing';

  constructor() { }

  ngOnInit(): void {
  }

}
