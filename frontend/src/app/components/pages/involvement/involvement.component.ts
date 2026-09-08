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
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { SelectItemService } from 'src/app/services/select-item.service';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
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
  subTopics = signal<SubTopic[]>(undefined);
  selectedSubTopic = signal<SubTopic>(undefined);
  subTopicId = input<string>();
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.red);

    // retrieve formats data from the CMS Involvement Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.involvement).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description);
          const subTopics = res.fields.subTopics.map((subTopic) => {
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
          this.subTopics.set(subTopics);
          if (this.subTopicId()) {
            const foundSubTopic = subTopics.find(
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

  // sets a sub topic as the selected sub topic to drill details
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
}
