import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { Delegate } from 'src/app/models/Delegate';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location, NgClass } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedDelegateComponent } from './selected-delegate/selected-delegate.component';

@Component({
  selector: 'se-delegates',
  templateUrl: './delegates.component.html',
  styleUrls: ['./delegates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedDelegateComponent,
    NgClass,
  ],
})
export class DelegatesComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  linksService = inject(LinksService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });

  StateColors = StateColors;
  enviroment = environment;
  delegates = signal<Delegate[]>(undefined);
  delegateName = input<string>();
  title = signal('Southeast Delegates');
  description = signal('');
  subText = signal('');
  subTextButtonText = signal('');
  subTextButtonLink = signal('');
  loadingContent = signal(true);
  loadingDelegates = signal(true);
  selectedDelegate = signal<Delegate>(undefined);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the delegates page
    this.themeService.setMainPaneColor(Colors.green);

    // retireve, sorts, and formats data from the CMS Delegates Entries
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.delegates).subscribe((res) => {
        const delegates = res.items
          .sort((a, b) => a['fields']['order'] - b.fields['order'])
          .map(
            (delegate) =>
              ({
                ...delegate.fields,
                photo: delegate.fields['photo']?.fields.file.url,
                thumbnail: delegate.fields['thumbnail']?.fields.file.url,
              }) as Delegate,
          );
        this.delegates.set(delegates);
        if (this.delegateName()) {
          const foundDelegate = delegates.find(
            (delegate) => delegate.name.replace(/ +/g, '-') === this.delegateName(),
          );
          if (foundDelegate) {
            this.selectDelegate(foundDelegate);
          } else {
            this.location.replaceState('/delegates');
          }
        }
        this.loadingDelegates.set(false);
      }),
    );

    // retireve and formats data from the CMS Delegate Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.delegates).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        this.subText.set(res.fields.subText1);
        this.subTextButtonText.set(res.fields.subText1ButtonText);
        this.subTextButtonLink.set(res.fields.subText1ButtonLink);
        this.loadingContent.set(false);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a delegate to drill in details on
  selectDelegate(delegate: Delegate) {
    // close Nav
    this.navService.closeNav();

    // Check if clicking an active delegate, and delselect the delegate if so.
    if (this.selectedDelegate()?.name === delegate.name) {
      this.selectedDelegate.set(undefined);
      this.themeService.setMainPaneColor(Colors.green); //resets left pane
      this.location.replaceState('/delegates');
    } else {
      this.selectedDelegate.set(delegate);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[delegate.state]);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(delegate.name)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/delegates/' + delegate.name.replace(/ +/g, '-'));
    }
  }
}
