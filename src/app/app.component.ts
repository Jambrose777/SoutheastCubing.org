import { Component, OnInit } from '@angular/core';
import { ScreenSizeService } from './services/screen-size.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'southeast-cubing';
  isMobile: boolean;

  constructor(private screenSizeService: ScreenSizeService) { }

  ngOnInit(): void {
    this.screenSizeService.setUpScreenSize();

    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);

  }

}
