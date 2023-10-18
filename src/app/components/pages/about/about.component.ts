import { Component, OnInit } from '@angular/core';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { Team } from 'src/app/models/Team';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  isMobile = isMobile();
  title: string = 'Get Involved';
  description: string = '';
  loadingContent: boolean = true;
  loadingTeams: boolean = true;
  teams: Team[];

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
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
