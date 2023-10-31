import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Championship } from 'src/app/models/Championship';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-championship',
  templateUrl: './selected-championship.component.html',
  styleUrls: ['./selected-championship.component.scss']
})
export class SelectedChampionshipComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  enviroment = environment;
  @Input() selectedChampionship: Championship;
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
