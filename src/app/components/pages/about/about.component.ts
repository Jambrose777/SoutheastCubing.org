import { Component, OnInit } from '@angular/core';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { Team } from 'src/app/models/Team';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  isMobile: boolean;
  title: string = 'About Us';
  description: string = '';
  loadingContent: boolean = true;
  loadingTeams: boolean = true;
  teams: Team[];

  constructor(
    private contentful: ContentfulService, 
    private themeService: ThemeService,
    private screenSizeService: ScreenSizeService
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile);

    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.orange);

    // retireve formats data from the CMS Involvement Page
    this.contentful.getContentfulEntry(ContentfulEntryId.about).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    });

    // retrieve theams list from the CMS Teams
    this.contentful.getContentfulGroup(ContentfulContentType.teams).subscribe(res => {
      this.teams = res.items
        .map(team => ({
          ...team.fields,
        }))
        .sort((a: Team, b: Team) => a.order > b.order ? 1 : -1);
      this.loadingTeams = false;
    });
  }

}
