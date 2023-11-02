import { Component, OnDestroy, OnInit } from '@angular/core';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { Delegate } from 'src/app/models/Delegate';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'se-delegates',
  templateUrl: './delegates.component.html',
  styleUrls: ['./delegates.component.scss']
})
export class DelegatesComponent implements OnInit, OnDestroy {
  isMobile: boolean;
  StateColors = StateColors;
  enviroment = environment;
  delegates: Delegate[];
  selectedDelegateNameFromRoute: string;
  title: string = 'Southeast Delegates';
  description: string = '';
  subText: string = '';
  loadingContent: boolean = true;
  loadingDelegates: boolean = true;
  selectedDelegate: Delegate;
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location,
    private screenSizeService: ScreenSizeService,
  ) {

  }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the delegates page
    this.themeService.setMainPaneColor(Colors.green);

    // collect competitionId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedDelegateNameFromRoute = params['delegateName'];
    }));

    // retireve, sorts, and formats data from the CMS Delegates Entries
    this.subscriptions.add(this.contentful.getContentfulGroup(ContentfulContentType.delegates).subscribe(res => {
      this.delegates = res.items
        .sort((a, b) => a['fields']['order'] - b.fields['order'])
        .map(delegate => ({
          ...delegate.fields,
          photo: delegate.fields['photo']?.fields.file.url,
          thumbnail: delegate.fields['thumbnail']?.fields.file.url,
        } as Delegate));
      if (this.selectedDelegateNameFromRoute) {
        let foundDelegate = this.delegates.find(delegate => delegate.name.replace(/ +/g, "-") === this.selectedDelegateNameFromRoute);
        if (foundDelegate) {
          this.selectDelegate(foundDelegate);
        } else {
          this.location.replaceState('/delegates');
        }
      }
      this.loadingDelegates = false;
    }));

    // retireve and formats data from the CMS Delegate Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.delegates).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText = res.fields.subText1;
      this.loadingContent = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a delegate to drill in details on
  selectDelegate(delegate: Delegate) {
    // close Nav
    this.navService.closeNav();

    // Check if clicking an active delegate, and delselect the delegate if so.
    if (this.selectedDelegate?.name === delegate.name) {
      this.selectedDelegate = undefined;
      this.themeService.setMainPaneColor(Colors.green); //resets left pane
      this.location.replaceState('/delegates');
    } else {
      this.selectedDelegate = delegate;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[this.selectedDelegate.state]);

        //scroll to top of main pane
        document.getElementById("header")?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedDelegate.name)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/delegates/' + this.selectedDelegate.name.replace(/ +/g, "-"));
    }
  }
}
