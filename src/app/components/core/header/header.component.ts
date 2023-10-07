import { Component, Input, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() title: string = 'Southeast Cubing';
  isNavActive = false;
  transition = false;

  constructor() { }

  ngOnInit(): void {
  }

  toggleNav(toggled: boolean) {
    this.isNavActive = toggled;
    this.transition = true;
    setTimeout(() => {
      this.transition = false;
    }, 500);
  }

}
