import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'se-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss']
})
export class NavComponent implements OnInit {
  @Input() isNavActive = false;
  @Input() transition = false;
  @Output() toggleNavEmitter = new EventEmitter<boolean>();

  constructor() { }

  ngOnInit(): void {
  }

  // Opens / Closes the nav controls
  toggleNav(toggled: boolean) {
    this.toggleNavEmitter.emit(toggled);
  }

}
