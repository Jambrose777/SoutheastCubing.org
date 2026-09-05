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
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location, NgClass } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedSubTopicComponent } from '../../shared/selected-sub-topic/selected-sub-topic.component';

@Component({
  selector: 'se-organizers',
  templateUrl: './organizers.component.html',
  styleUrls: ['./organizers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedSubTopicComponent,
    NgClass,
  ],
})
export class OrganizersComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);

  // Derived from the service's observable via toSignal() so OnPush change
  // detection picks up resize-driven updates
  isMobile = toSignal(this.screenSizeService.getIsMobileSubject(), {
    initialValue: this.screenSizeService.isMobile,
  });
  title = signal('Organizer Guidelines');
  description = signal('');
  loadingContent = signal(true);
  subTopics = signal<SubTopic[]>(undefined);
  selectedSubTopic = signal<SubTopic>(undefined);
  subTopicId = input<string>();
  subText = signal<string>(undefined);
  subTextButtonText = signal('');
  subTextButtonLink = signal('');
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the Organizers page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve formats data from the CMS Organizers Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.organizers).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        const subTopics = res.fields.subTopics?.map((subTopic) => ({
          ...subTopic.fields,
          photo: subTopic.fields['photo']?.fields.file.url,
          color: Colors[subTopic.fields.color],
        }));
        this.subTopics.set(subTopics);
        this.subText.set(res.fields.subText1);
        this.subTextButtonText.set(res.fields.subText1ButtonText);
        this.subTextButtonLink.set(res.fields.subText1ButtonLink);

        // select topic based on route information
        if (this.subTopicId()) {
          const foundSubTopic = subTopics.find(
            (subTopic) => subTopic.title.replace(/ +/g, '-') === this.subTopicId(),
          );
          if (foundSubTopic) {
            this.selectSubTopic(foundSubTopic);
          } else {
            this.location.replaceState('/organizers');
          }
        }
        this.loadingContent.set(false);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a sub topic as the selected sub topic to drill details
  selectSubTopic(subTopic: SubTopic) {
    // close Nav
    this.navService.closeNav();

    // deselect a sub topic if it is already selected
    if (this.selectedSubTopic()?.title === subTopic.title) {
      this.selectedSubTopic.set(undefined);
      this.themeService.setMainPaneColor(Colors.yellow);
      this.location.replaceState('/organizers');
    } else {
      this.selectedSubTopic.set(subTopic);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(subTopic.color);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(subTopic.title)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/organizers/' + subTopic.title.replace(/ +/g, '-'));
    }
  }
}
