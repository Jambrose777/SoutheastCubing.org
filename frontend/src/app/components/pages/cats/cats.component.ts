import {
  Component,
  input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { Location, NgClass } from '@angular/common';
import { Cat } from 'src/app/models/Cat';
import { Subscription } from 'rxjs';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { NavService } from 'src/app/services/nav.service';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Colors } from 'src/app/shared/types';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SelectedCatComponent } from './selected-cat/selected-cat.component';

@Component({
  selector: 'se-cats',
  templateUrl: './cats.component.html',
  styleUrls: ['./cats.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SelectedCatComponent,
    NgClass,
  ],
})
export class CatsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private location = inject(Location);
  private screenSizeService = inject(ScreenSizeService);

  isMobile: boolean;
  cats: Cat[];
  catName = input<string>();
  title: string = 'Southeast Cats';
  description: string = '';
  loadingContent: boolean = true;
  loadingCats: boolean = true;
  selectedCat: Cat;
  subscriptions: Subscription = new Subscription();
  availableColors: Colors[] = [
    Colors.blue,
    Colors.darkGrey,
    Colors.green,
    Colors.grey,
    Colors.yellow,
    Colors.purple,
    Colors.orange,
    Colors.red,
  ];

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(
      this.screenSizeService
        .getIsMobileSubject()
        .subscribe((isMobile) => (this.isMobile = isMobile)),
    );

    // sets up main color for the cats page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve, sorts, and formats data from the CMS Cats Entries
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.cats).subscribe((res) => {
        this.cats = res.items
          .map((value) => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value)
          .map(
            (cat) =>
              ({
                ...cat.fields,
                photo: cat.fields['photo']?.fields.file.url,
                thumbnail: cat.fields['thumbnail']?.fields.file.url,
                color:
                  this.availableColors[Math.floor(Math.random() * this.availableColors.length)],
              }) as Cat,
          );
        if (this.catName()) {
          const foundCat = this.cats?.find(
            (cat) => cat.name.replace(/ +/g, '-') === this.catName(),
          );
          if (foundCat) {
            this.selectCat(foundCat);
          } else {
            this.location.replaceState('/cats');
          }
        }
        this.loadingCats = false;
      }),
    );

    // retireve and formats data from the CMS Cats Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.cats).subscribe((res) => {
        this.title = res.fields.title;
        this.description = res.fields.description;
        this.loadingContent = false;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // selects a cat to drill in details on
  selectCat(cat: Cat) {
    // close Nav
    this.navService.closeNav();

    // Check if clicking an active cat, and delselect the cat if so.
    if (this.selectedCat?.name === cat.name) {
      this.selectedCat = undefined;
      this.themeService.setMainPaneColor(Colors.green); //resets left pane
      this.location.replaceState('/cats');
    } else {
      this.selectedCat = cat;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(this.selectedCat.color);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedCat.name)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/cats/' + this.selectedCat.name.replace(/ +/g, '-'));
    }
  }
}
