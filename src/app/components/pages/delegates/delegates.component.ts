import { Component, HostListener, OnInit } from '@angular/core';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { Delegate } from 'src/app/models/Delegate';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors, StateColors } from 'src/app/shared/types';

@Component({
  selector: 'se-delegates',
  templateUrl: './delegates.component.html',
  styleUrls: ['./delegates.component.scss']
})
export class DelegatesComponent implements OnInit {
  isMobile = isMobile();
  StateColors = StateColors;
  delegates: Delegate[];
  title: string = 'Southeast Delegates';
  description: string = '';
  subText: string = '';
  loadingContent: boolean = true;
  loadingDelegates: boolean = true;
  selectedDelegate: Delegate;

  constructor(private contentful: ContentfulService, private themeService: ThemeService, private navService: NavService) { }

  ngOnInit(): void {
    // sets up main color for the delegates page
    this.themeService.setMainPaneColor(Colors.green);

    // retireve, sorts, and formats data from the CMS Delegates Entries
    this.contentful.getContentfulGroup(ContentfulContentType.delegates).subscribe(res => {
      this.delegates = res.items
        .sort((a, b) => a['fields']['order'] - b.fields['order'])
        .map(delegate => ({
          ...delegate.fields,
          photo: delegate.fields['photo']?.fields.file.url,
          thumbnail: delegate.fields['thumbnail']?.fields.file.url,
        } as Delegate));
      this.loadingDelegates = false;
    });

    // retireve and formats data from the CMS Delegate Page
    this.contentful.getContentfulEntry(ContentfulEntryId.delegates).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText = res.fields.subText1;
      this.loadingContent = false;
    });
  }

  // selects a delegate to drill in details on
  selectDelegate(delegate: Delegate) {
    // close Nav
    this.navService.closeNav();

    // Check if clicking an active delegate, and delselect the delegate if so.
    if (this.selectedDelegate?.name === delegate.name) {
      this.selectedDelegate = undefined;
      this.themeService.setMainPaneColor(Colors.green); //resets left pane
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
    }
  }
}
