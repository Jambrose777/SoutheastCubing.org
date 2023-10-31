import { Component, Input, OnInit } from '@angular/core';
import { Delegate } from 'src/app/models/Delegate';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss']
})
export class SelectedDelegateComponent implements OnInit {
  isMobile: boolean;
  enviroment = environment;
  @Input() selectedDelegate: Delegate;

  constructor(
    private screenSizeService: ScreenSizeService,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);

  }

}
