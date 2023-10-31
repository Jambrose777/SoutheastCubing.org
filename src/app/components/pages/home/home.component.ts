import { Component, OnDestroy, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { environment } from 'src/environments/environment';
import { SubTopic } from 'src/app/models/SubTopic';
import { Router } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'se-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  enviroment = environment;
  title: string = 'Southeast Cubing';
  description: string = '';
  photos: string[] = [];
  loadingContent: boolean = true;
  subTopics: SubTopic[];
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService, 
    private themeService: ThemeService, 
    private router: Router,
    private screenSizeService: ScreenSizeService
    ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.blue);

    // retireve and formats data from the CMS home Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.home).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics?.map(subTopic => ({ ...subTopic.fields, color: Colors[subTopic.fields.color] }))
      this.photos = res.fields.photos?.map(photo => ({ path: photo.fields.file.url }));
      this.loadingContent = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  announcementClick(subTopic: SubTopic) {
    if(subTopic.buttonInternalLink) {
      this.router.navigate([subTopic.buttonInternalLink])
    } else if (subTopic.buttonExternalLink) {
      this.router.navigate([]).then(() => {
        window.open(subTopic.buttonExternalLink, '_blank');
      });
    }
  }
}
