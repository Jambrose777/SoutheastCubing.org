import { Component, OnDestroy, OnInit } from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'se-involvement',
  templateUrl: './involvement.component.html',
  styleUrls: ['./involvement.component.scss']
})
export class InvolvementComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  title: string = 'Get Involved';
  description: string = '';
  loadingContent: boolean = true;
  subTopics: SubTopic[];
  selectedSubTopic: SubTopic;
  selectedSubTopicTitleFromRoute: string;
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location,
    private screenSizeService: ScreenSizeService,
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.red);

    // collect subTopicId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedSubTopicTitleFromRoute = params['subTopicId'];
    }));

    // retireve formats data from the CMS Involvement Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.involvement).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics.map(subTopic => ({ ...subTopic.fields, photo: subTopic.fields['photo']?.fields.file.url, color: Colors[subTopic.fields.color] }));
      if (this.selectedSubTopicTitleFromRoute) {
        let foundSubTopic = this.subTopics.find(subTopic => subTopic.title.replace(/ +/g, "-") === this.selectedSubTopicTitleFromRoute);
        if (foundSubTopic) {
          this.selectSubTopic(foundSubTopic);
        } else {
          this.location.replaceState('/involvement');
        }
      }
      this.loadingContent = false;
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
      this.location.replaceState('/involvement');
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
      this.location.replaceState('/involvement/' + this.selectedSubTopic.title.replace(/ +/g, "-"));
    }
  }

}
