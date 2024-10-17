import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { SubTopic } from 'src/app/models/SubTopic';
import { Team } from 'src/app/models/Team';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DocumentLink } from 'src/app/models/Document';

@Component({
  selector: 'se-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  title: string = 'About SECI';
  description: string = '';
  loadingContent: boolean = true;
  loadingTeams: boolean = true;
  loadingDocuments: boolean = true;
  subTopics: SubTopic[];
  selectedSubTopic: SubTopic;
  selectedSubTopicTitleFromRoute: string;
  teams: Team[];
  documents: DocumentLink[];
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService, 
    private themeService: ThemeService,
    private screenSizeService: ScreenSizeService,
    private location: Location,
    private navService: NavService,
    private route: ActivatedRoute,
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.orange);

    // collect subTopicId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedSubTopicTitleFromRoute = params['subTopicId'];
    }));

    // retireve formats data from the CMS Involvement Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.about).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics.map(subTopic => ({ ...subTopic.fields, photo: subTopic.fields['photo']?.fields.file.url, color: Colors[subTopic.fields.color] }));
      
      // Add additional custom Pages as SubTopics
      this.subTopics = [
        { title: 'Who We Are', color: Colors.yellow },
        ...this.subTopics,
        { title: 'Documents', color: Colors.purple },
      ];

      // select a subtopic based on url on load
      if (this.selectedSubTopicTitleFromRoute) {
        let foundSubTopic = this.subTopics.find(subTopic => subTopic.title.replace(/ +/g, "-") === this.selectedSubTopicTitleFromRoute);
        if (foundSubTopic) {
          this.selectSubTopic(foundSubTopic);
        } else {
          this.location.replaceState('/about');
        }
      }
      this.loadingContent = false;
    }));

    // retrieve teams list from the CMS Teams
    this.subscriptions.add(this.contentful.getContentfulGroup(ContentfulContentType.teams).subscribe(res => {
      this.teams = res.items
        .map(team => ({
          ...team.fields,
          teamMembers: team.fields.teamMembers.map(teamMember => ({ 
            ...teamMember.fields,
            color: Colors[teamMember.fields.color] ||  Colors.grey,
            thumbnail: teamMember.fields['thumbnail']?.fields.file.url,
          })),
        }))
        .sort((a: Team, b: Team) => a.order > b.order ? 1 : -1);
      this.loadingTeams = false;
    }));

    // retrieve Documents list from the CMS Teams
    this.subscriptions.add(this.contentful.getContentfulGroup(ContentfulContentType.documents).subscribe(res => {
      this.documents = res.items
        .map(document => ({
          ...document.fields,
          color: Colors[document.fields.color] ||  Colors.grey,
        }))
        .sort((a: Team, b: Team) => a.order > b.order ? 1 : -1);
      this.loadingDocuments = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a sub topic as the selected sub topic to drill details
  selectSubTopic(subTopic: SubTopic) {
    // close Nav
    this.navService.closeNav();

    // deselect a sub topic if it is already selected
    if (this.selectedSubTopic?.title === subTopic.title) {
      this.selectedSubTopic = undefined;
      this.themeService.setMainPaneColor(Colors.red);
      this.location.replaceState('/about');
    } else {
      this.selectedSubTopic = subTopic;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(subTopic.color);

        //scroll to top of main pane
        document.getElementById("header")?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedSubTopic.title)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/about/' + this.selectedSubTopic.title.replace(/ +/g, "-"));
    }
  }

}
