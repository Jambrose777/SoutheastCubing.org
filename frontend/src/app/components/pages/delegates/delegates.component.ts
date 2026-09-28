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
import { DelegatesPageSkeleton } from 'src/app/models/ContentfulSkeletons';
import { buildDetailUrl } from 'src/app/shared/build-detail-url';
import { isPlainLeftClick } from 'src/app/shared/is-plain-left-click';
import { SelectItemService } from 'src/app/services/select-item.service';
import { Delegate } from 'src/app/models/Delegate';
import { ContentfulService } from 'src/app/services/contentful.service';
import { SoutheastcubingApiService } from 'src/app/services/southeastcubing-api/southeastcubing-api.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
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
    AvatarComponent,
    NgClass,
    RouterLink,
  ],
})
export class DelegatesComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private api = inject(SoutheastcubingApiService);
  private themeService = inject(ThemeService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);
  private selectItemService = inject(SelectItemService);
  linksService = inject(LinksService);

  isMobile = this.screenSizeService.isMobile;

  StateColors = StateColors;
  environment = environment;
  delegates = signal<Delegate[] | undefined>(undefined);
  delegateName = input<string>();
  title = signal('Southeast Delegates');
  description = signal('');
  subText = signal('');
  subTextButtonText = signal('');
  subTextButtonLink = signal('');
  loadingContent = signal(true);
  loadingDelegates = signal(true);
  selectedDelegate = signal<Delegate | undefined>(undefined);
  subscriptions: Subscription = new Subscription();
  buildDetailUrl = buildDetailUrl;

  // Keeps the main pane color in sync with the current viewport/selection.
  private syncMainPaneColor = this.selectItemService.syncMainPaneColorWithViewport({
    selectedSignal: this.selectedDelegate,
    basePaneColor: Colors.green,
    selectColor: (d: Delegate) => StateColors[d.state ?? '??'],
  });

  ngOnInit(): void {
    // sets up main color for the delegates page
    this.themeService.setMainPaneColor(Colors.green);

    // retrieves the Delegate roster from our own API.
    this.subscriptions.add(
      this.api.getPublicDelegates().subscribe({
        next: (delegates) => {
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
          console.error('Failed to load the delegates list:', err);
          this.loadingDelegates.set(false);
        },
      }),
    );

    // retrieve and formats data from the CMS Delegate Page
    this.subscriptions.add(
      this.contentful
        .getContentfulEntry<DelegatesPageSkeleton>(ContentfulEntryId.delegates)
        .subscribe({
          next: (res) => {
            this.title.set(res.fields.title);
            this.description.set(res.fields.description ?? '');
            this.subText.set(res.fields.subText1 ?? '');
            this.subTextButtonText.set(res.fields.subText1ButtonText ?? '');
            this.subTextButtonLink.set(res.fields.subText1ButtonLink ?? '');
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
      selectColor: (d) => StateColors[d.state ?? '??'],
      updateUrl: () =>
        this.location.replaceState(buildDetailUrl('/delegates', this.selectedDelegate()?.name)),
    });
  }

  // A plain left click is intercepted here to keep the existing cheap in-place
  // selection instead of a full router navigation.
  onDelegateRowClick(event: MouseEvent, delegate: Delegate): void {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    this.selectDelegate(delegate);
  }
}
