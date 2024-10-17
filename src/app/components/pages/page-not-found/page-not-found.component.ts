import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'se-page-not-found',
  templateUrl: './page-not-found.component.html',
  styleUrls: ['./page-not-found.component.scss']
})
export class PageNotFoundComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  title: string = 'Page Not Found';
  description: string = '';
  loadingContent: boolean = true;
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private screenSizeService: ScreenSizeService
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.darkGrey);

    // retireve and formats data from the CMS home Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.pageNotFound).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}
