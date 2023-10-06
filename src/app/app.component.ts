import { Component, OnInit } from '@angular/core';
import { isMobile } from './shared/functions';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'southeast-cubing';
  isMobile = isMobile;

  constructor() { }

  ngOnInit(): void {
  }

}
