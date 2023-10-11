import { Component, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors, StateColors } from 'src/app/shared/types';

@Component({
  selector: 'app-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss']
})
export class ClubsComponent implements OnInit {
  isMobile = isMobile;
  StateColors = StateColors;
  title: string = 'Southeast Clubs';
  description: string = '';
  loadingContent: boolean = true;
  loadingClubs: boolean = true;
  clubs: Club[];
  selectedClub: Club;
  subText1: string = '';
  subText2: string = '';

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    this.themeService.setRightPaneColor(Colors.purple);

    this.contentful.getContentfulEntry('clubs').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.subText2 = res.fields.subText2;
      this.loadingContent = false;
    });

    this.contentful.getContentfulGroup('clubs').subscribe(res => {
      this.clubs = res.items
        .map(club => ({...club.fields, images: club.fields.images?.map(image => ({path: image.fields.file.url})), state: club.fields?.city.substring(club.fields?.city.length-2)}))
        .sort((a: Club, b: Club) => a.city > b.city ? 1 : -1);
      console.log(this.clubs)
      this.loadingClubs = false;
    });
  }

  selectClub(club: Club) {
    if(this.selectedClub?.name === club.name) {
      this.selectedClub = undefined;
      this.themeService.setRightPaneColor(Colors.purple);
    } else {
      this.selectedClub = club;
      this.themeService.setRightPaneColor(StateColors[this.selectedClub.state]);
    }
    console.log(this.selectedClub);
  }

}
