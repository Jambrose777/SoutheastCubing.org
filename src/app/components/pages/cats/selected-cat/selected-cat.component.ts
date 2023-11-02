import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Cat } from 'src/app/models/Cat';
import { ScreenSizeService } from 'src/app/services/screen-size.service';

@Component({
  selector: 'se-selected-cat',
  templateUrl: './selected-cat.component.html',
  styleUrls: ['./selected-cat.component.scss']
})
export class SelectedCatComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  @Input() selectedCat: Cat;
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
