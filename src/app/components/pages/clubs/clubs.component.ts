import { Component, OnInit } from '@angular/core';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
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
    // sets up main color for the home page
    this.themeService.setLeftPaneColor(Colors.purple);

    // retireve formats data from the CMS Clubs Page
    this.contentful.getContentfulEntry(ContentfulEntryId.clubs).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.subText2 = res.fields.subText2;
      this.loadingContent = false;
    });


    // retrieve, sorts, and formats the clubs list from the CMS Clubs
    this.contentful.getContentfulGroup(ContentfulContentType.clubs).subscribe(res => {
      this.clubs = res.items
        .map(club => ({ ...club.fields, image: club.fields.image?.fields.file.url, state: club.fields?.city.substring(club.fields?.city.length - 2) }))
        .sort((a: Club, b: Club) => a.city > b.city ? 1 : -1);
      this.loadingClubs = false;
    });
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // deselect a club if it is already selected
    if (this.selectedClub?.name === club.name && this.selectedClub?.city === club.city) {
      this.selectedClub = undefined;
      this.themeService.setLeftPaneColor(Colors.purple);
    } else {
      this.selectedClub = club;
      this.themeService.setLeftPaneColor(StateColors[this.selectedClub.state]); // sets the left pane color based on state value
    }
  }

}
