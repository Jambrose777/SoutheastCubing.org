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
import {
  AboutPageSkeleton,
  DocumentSkeleton,
  TeamMemberSkeleton,
  TeamSkeleton,
} from 'src/app/models/ContentfulSkeletons';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { resolvedAsset, resolvedEntry, SubTopicEntryLink } from 'src/app/shared/contentful-links';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { colorFromField } from 'src/app/shared/color-from-field';
import { SubTopic } from 'src/app/models/SubTopic';
import { Team } from 'src/app/models/Team';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { SelectItemService } from 'src/app/services/select-item.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location, NgClass, NgTemplateOutlet } from '@angular/common';
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
    NgTemplateOutlet,
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
  selectedSubTopic = signal<SubTopic | undefined>(undefined);
  subTopicId = input<string>();
  teams = signal<Team[] | undefined>(undefined);
  documents = signal<DocumentLink[] | undefined>(undefined);
  subscriptions: Subscription = new Subscription();

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedSubTopic,
    basePaneColor: Colors.red,
    selectColor: (s: SubTopic) => s.color,
  });

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.orange);

    // retrieve formats data from the CMS Involvement Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry<AboutPageSkeleton>(ContentfulEntryId.about).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description ?? '');
          let subTopics: SubTopic[] = res.fields.subTopics.map((subTopicLink) =>
            this.mapSubTopic(subTopicLink, true),
          );

          // Add additional custom Pages as SubTopics
          subTopics = [
            { title: 'Who We Are', color: Colors.yellow },
            ...subTopics,
            { title: 'Documents', color: Colors.purple },
          ];
          this.subTopics.set(subTopics);

          // select a subtopic based on url on load
          if (this.subTopicId()) {
            // Search both top-level and (one level of) nested subtopics, since
            // selecting either kind updates the URL to that item's own slug.
            const flatSubTopics = subTopics.flatMap((subTopic) => [
              subTopic,
              ...(subTopic.subTopics ?? []),
            ]);
            const foundSubTopic = flatSubTopics.find(
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
      this.contentful.getContentfulGroup<TeamSkeleton>(ContentfulContentType.teams).subscribe({
        next: (res) => {
          this.teams.set(
            res.items
              .map((team) => ({
                ...team.fields,
                teamMembers: team.fields.teamMembers.map((teamMemberLink) => {
                  const teamMember = resolvedEntry<TeamMemberSkeleton>(teamMemberLink);
                  // Team member thumbnails render in a 60x60 box; scale the native
                  // Contentful asset down (max ~120px, covering a 2x-density srcset)
                  // instead of shipping the full-resolution upload for a tiny thumbnail.
                  const thumbnail = resolvedAsset(teamMember?.fields['thumbnail']);
                  const thumbnailSize = scaleToDisplaySize(
                    thumbnail?.fields.file?.details?.image?.width,
                    thumbnail?.fields.file?.details?.image?.height,
                    120,
                  );
                  return {
                    ...teamMember?.fields,
                    name: teamMember?.fields.name ?? '',
                    color: colorFromField(teamMember?.fields.color),
                    thumbnail: thumbnail?.fields.file?.url,
                    thumbnailAlt: thumbnail?.fields.description ?? '',
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
      this.contentful
        .getContentfulGroup<DocumentSkeleton>(ContentfulContentType.documents)
        .subscribe({
          next: (res) => {
            this.documents.set(
              res.items
                .map((document) => ({
                  ...document.fields,
                  color: colorFromField(document.fields.color),
                }))
                .sort((a: DocumentLink, b: DocumentLink) => (a.order > b.order ? 1 : -1)),
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

  // sets a sub topic as the selected sub topic to drill details - used for both
  // top-level and nested subtopics, which are selected identically.
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

  // Whether a top-level subtopic's nested list should be shown in the side panel -
  // kept open both while the subtopic itself is selected and while one of its own
  // nested items is selected (so browsing a nested item doesn't collapse its parent).
  isSubTopicExpanded(subTopic: SubTopic): boolean {
    return (
      this.selectedSubTopic()?.title === subTopic.title ||
      !!subTopic.subTopics?.some((nested) => nested.title === this.selectedSubTopic()?.title)
    );
  }

  // Maps a resolved subTopic Contentful entry link into the `SubTopic` shape used by
  // the templates. Nesting is capped at exactly one level: `resolveNested` is only ever
  // true for the top-level call, so a nested subtopic's own `subTopics` field (if
  // populated in Contentful) is never read/rendered.
  private mapSubTopic(subTopicLink: SubTopicEntryLink, resolveNested: boolean): SubTopic {
    const subTopic = resolvedEntry(subTopicLink);
    const photo = resolvedAsset(subTopic?.fields['photo']);
    const photoSize = scaleToDisplaySize(
      photo?.fields.file?.details?.image?.width,
      photo?.fields.file?.details?.image?.height,
    );
    return {
      ...subTopic?.fields,
      title: subTopic?.fields.title ?? '',
      photo: photo?.fields.file?.url,
      photoAlt: photo?.fields.description ?? '',
      photoWidth: photoSize.width,
      photoHeight: photoSize.height,
      color: colorFromField(subTopic?.fields.color),
      subTopics: resolveNested
        ? subTopic?.fields.subTopics?.map((nestedLink) => this.mapSubTopic(nestedLink, false))
        : undefined,
    };
  }
}
