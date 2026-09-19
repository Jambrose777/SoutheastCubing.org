import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { InvolvementPageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { resolvedAsset, resolvedEntry, SubTopicEntryLink } from 'src/app/shared/contentful-links';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { isPlainLeftClick } from 'src/app/shared/is-plain-left-click';
import { colorFromField } from 'src/app/shared/color-from-field';
import { SelectItemService } from 'src/app/services/select-item.service';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { Location, NgClass, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedSubTopicComponent } from '../../shared/selected-sub-topic/selected-sub-topic.component';

@Component({
  selector: 'se-involvement',
  templateUrl: './involvement.component.html',
  styleUrls: ['./involvement.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedSubTopicComponent,
    NgClass,
    NgTemplateOutlet,
    RouterLink,
  ],
})
export class InvolvementComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);

  isMobile = this.screenSizeService.isMobile;

  title = signal('Get Involved');
  description = signal('');
  loadingContent = signal(true);
  subTopics = signal<SubTopic[] | undefined>(undefined);
  selectedSubTopic = signal<SubTopic | undefined>(undefined);
  subTopicId = input<string>();
  subscriptions: Subscription = new Subscription();
  buildDetailUrl = buildDetailUrl;

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedSubTopic,
    basePaneColor: Colors.red,
    selectColor: (s: SubTopic) => s.color,
  });

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.red);

    // retrieve formats data from the CMS Involvement Page
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<InvolvementPageSkeleton>(ContentfulEntryId.involvement)
        .subscribe({
          next: (res) => {
            this.title.set(res.fields.title);
            this.description.set(res.fields.description ?? '');
            const subTopics = res.fields.subTopics.map((subTopicLink) =>
              this.mapSubTopic(subTopicLink, true),
            );
            this.subTopics.set(subTopics);
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
                this.location.replaceState('/involvement');
              }
            }
            this.loadingContent.set(false);
          },
          error: (err) => {
            console.error('Failed to load the involvement page content from Contentful:', err);
            this.loadingContent.set(false);
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
        this.location.replaceState(buildDetailUrl('/involvement', this.selectedSubTopic()?.title)),
    });
  }

  // A plain left click is intercepted here to keep the existing cheap in-place
  // selection instead of a full router navigation.
  onSubTopicRowClick(event: MouseEvent, subTopic: SubTopic): void {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    this.selectSubTopic(subTopic);
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
