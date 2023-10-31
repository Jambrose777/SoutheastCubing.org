import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Club } from 'src/app/models/Club';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-club',
  templateUrl: './selected-club.component.html',
  styleUrls: ['./selected-club.component.scss']
})
export class SelectedClubComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  enviroment = environment;
  @Input() selectedClub: Club;
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
