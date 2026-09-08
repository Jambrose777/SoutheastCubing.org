import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { SubTopic } from 'src/app/models/SubTopic';
import { Team } from 'src/app/models/Team';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { SelectItemService } from 'src/app/services/select-item.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location, NgClass } from '@angular/common';
import { DocumentLink } from 'src/app/models/Document';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedSubTopicComponent } from '../../shared/selected-sub-topic/selected-sub-topic.component';
import { TeamsComponent } from './teams/teams.component';
import { DoucmentsComponent } from './documents/documents.component';

@Component({
  selector: 'se-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedSubTopicComponent,
    TeamsComponent,
    DoucmentsComponent,
    NgClass,
  ],
})
export class AboutComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private screenSizeService = inject(ScreenSizeService);
  private location = inject(Location);
  private selectItemService = inject(SelectItemService);

  isMobile = this.screenSizeService.isMobile;

  title = signal('About SECI');
  description = signal('');
  loadingContent = signal(true);
  loadingTeams = signal(true);
  loadingDocuments = signal(true);
  subTopics = signal<SubTopic[]>([]);
  selectedSubTopic = signal<SubTopic>(undefined);
  subTopicId = input<string>();
  teams = signal<Team[]>(undefined);
  documents = signal<DocumentLink[]>(undefined);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.orange);

    // retrieve formats data from the CMS Involvement Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.about).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description);
          let subTopics: SubTopic[] = res.fields.subTopics.map((subTopic) => {
            const photoSize = scaleToDisplaySize(
              subTopic.fields['photo']?.fields.file.details?.image?.width,
              subTopic.fields['photo']?.fields.file.details?.image?.height,
            );
            return {
              ...subTopic.fields,
              photo: subTopic.fields['photo']?.fields.file.url,
              photoWidth: photoSize.width,
              photoHeight: photoSize.height,
              color: Colors[subTopic.fields.color],
            };
          });

          // Add additional custom Pages as SubTopics
          subTopics = [
            { title: 'Who We Are', color: Colors.yellow },
            ...subTopics,
            { title: 'Documents', color: Colors.purple },
          ];
          this.subTopics.set(subTopics);

          // select a subtopic based on url on load
          if (this.subTopicId()) {
            const foundSubTopic = subTopics.find(
              (subTopic) => subTopic.title.replace(/ +/g, '-') === this.subTopicId(),
            );
            if (foundSubTopic) {
              this.selectSubTopic(foundSubTopic);
            } else {
              this.location.replaceState('/about');
            }
          }
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the about page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );

    // retrieve teams list from the CMS Teams
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.teams).subscribe({
        next: (res) => {
          this.teams.set(
            res.items
              .map((team) => ({
                ...team.fields,
                teamMembers: team.fields.teamMembers.map((teamMember) => {
                  // Team member thumbnails render in a 60x60 box; scale the native
                  // Contentful asset down (max ~120px, covering a 2x-density srcset)
                  // instead of shipping the full-resolution upload for a tiny thumbnail.
                  const thumbnailSize = scaleToDisplaySize(
                    teamMember.fields['thumbnail']?.fields.file.details?.image?.width,
                    teamMember.fields['thumbnail']?.fields.file.details?.image?.height,
                    120,
                  );
                  return {
                    ...teamMember.fields,
                    color: Colors[teamMember.fields.color] || Colors.grey,
                    thumbnail: teamMember.fields['thumbnail']?.fields.file.url,
                    thumbnailWidth: thumbnailSize.width,
                    thumbnailHeight: thumbnailSize.height,
                  };
                }),
              }))
              .sort((a: Team, b: Team) => (a.order > b.order ? 1 : -1)),
          );
          this.loadingTeams.set(false);
        },
        error: (err) => {
          console.error('Failed to load the teams list from Contentful:', err);
          this.loadingTeams.set(false);
        },
      }),
    );

    // retrieve Documents list from the CMS Teams
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.documents).subscribe({
        next: (res) => {
          this.documents.set(
            res.items
              .map((document) => ({
                ...document.fields,
                color: Colors[document.fields.color] || Colors.grey,
              }))
              .sort((a: Team, b: Team) => (a.order > b.order ? 1 : -1)),
          );
          this.loadingDocuments.set(false);
        },
        error: (err) => {
          console.error('Failed to load the documents list from Contentful:', err);
          this.loadingDocuments.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a sub topic as the selected sub topic to drill details
  selectSubTopic(subTopic: SubTopic) {
    this.selectItemService.select(subTopic, {
      selectedSignal: this.selectedSubTopic,
      isSelected: (s) => this.selectedSubTopic()?.title === s.title,
      elementId: (s) => s.title,
      basePaneColor: Colors.red,
      selectColor: (s) => s.color,
      updateUrl: () =>
        this.location.replaceState(buildDetailUrl('/about', this.selectedSubTopic()?.title)),
    });
  }
}
