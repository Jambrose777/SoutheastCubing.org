import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Delegate } from 'src/app/models/Delegate';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-delegate',
  templateUrl: './selected-delegate.component.html',
  styleUrls: ['./selected-delegate.component.scss']
})
export class SelectedDelegateComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  enviroment = environment;
  @Input() selectedDelegate: Delegate;
  subscriptions: Subscription = new Subscription();

  constructor(
    private screenSizeService: ScreenSizeService,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}
