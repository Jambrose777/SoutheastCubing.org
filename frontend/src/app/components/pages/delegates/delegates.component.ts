import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { SelectItemService } from 'src/app/services/select-item.service';
import { Delegate } from 'src/app/models/Delegate';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location, NgClass, NgOptimizedImage } from '@angular/common';
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
    NgOptimizedImage,
  ],
})
export class DelegatesComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  StateColors = StateColors;
  environment = environment;
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

    // retrieve, sorts, and formats data from the CMS Delegates Entries
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.delegates).subscribe({
        next: (res) => {
          const delegates = res.items
            .sort((a, b) => a['fields']['order'] - b.fields['order'])
            .map((delegate) => {
              const photoSize = scaleToDisplaySize(
                delegate.fields['photo']?.fields.file.details?.image?.width,
                delegate.fields['photo']?.fields.file.details?.image?.height,
              );
              // Delegate thumbnails render in a 60x60 box; scale the native
              // Contentful asset down (max ~120px, covering a 2x-density srcset)
              // instead of shipping the full-resolution upload for a tiny thumbnail.
              const thumbnailSize = scaleToDisplaySize(
                delegate.fields['thumbnail']?.fields.file.details?.image?.width,
                delegate.fields['thumbnail']?.fields.file.details?.image?.height,
                120,
              );
              return {
                ...delegate.fields,
                photo: delegate.fields['photo']?.fields.file.url,
                photoWidth: photoSize.width,
                photoHeight: photoSize.height,
                thumbnail: delegate.fields['thumbnail']?.fields.file.url,
                thumbnailWidth: thumbnailSize.width,
                thumbnailHeight: thumbnailSize.height,
              } as Delegate;
            });
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
        },
        error: (err) => {
          console.error('Failed to load the delegates list from Contentful:', err);
          this.loadingDelegates.set(false);
        },
      }),
    );

    // retrieve and formats data from the CMS Delegate Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.delegates).subscribe({
        next: (res) => {
          this.title.set(res.fields.title);
          this.description.set(res.fields.description);
          this.subText.set(res.fields.subText1);
          this.subTextButtonText.set(res.fields.subText1ButtonText);
          this.subTextButtonLink.set(res.fields.subText1ButtonLink);
          this.loadingContent.set(false);
        },
        error: (err) => {
          console.error('Failed to load the delegates page content from Contentful:', err);
          this.loadingContent.set(false);
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a delegate to drill in details on
  selectDelegate(delegate: Delegate) {
    this.selectItemService.select(delegate, {
      selectedSignal: this.selectedDelegate,
      isSelected: (d) => this.selectedDelegate()?.name === d.name,
      elementId: (d) => d.name,
      basePaneColor: Colors.green,
      selectColor: (d) => StateColors[d.state],
      updateUrl: () =>
        this.location.replaceState(buildDetailUrl('/delegates', this.selectedDelegate()?.name)),
    });
  }
}
