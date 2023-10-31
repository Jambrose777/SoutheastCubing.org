import { Component, Input, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'se-selected-club',
  templateUrl: './selected-club.component.html',
  styleUrls: ['./selected-club.component.scss']
})
export class SelectedClubComponent implements OnInit {
  isMobile: boolean;
  enviroment = environment;
  @Input() selectedClub: Club;

  constructor(
    private screenSizeService: ScreenSizeService,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);

  }

}
