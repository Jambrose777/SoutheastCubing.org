import { Component, OnDestroy, OnInit } from '@angular/core';
import { Championship } from 'src/app/models/Championship';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'se-championships',
  templateUrl: './championships.component.html',
  styleUrls: ['./championships.component.scss']
})
export class ChampionshipsComponent implements OnInit, OnDestroy {
  isMobile: boolean
  StateColors = StateColors;
  enviroment = environment;
  title: string = 'Southeast Championships';
  description: string = '';
  loadingContent: boolean = true;
  loadingChampionships: boolean = true;
  championships: Championship[];
  selectedChampionship: Championship;
  selectedChampionshipIdFromRoute: string;
  subText1: string = '';
  subscriptions: Subscription = new Subscription();

  constructor(
    private contentful: ContentfulService,
    private themeService: ThemeService,
    private navService: NavService,
    private route: ActivatedRoute,
    private location: Location,
    private screenSizeService: ScreenSizeService,
  ) { }

  ngOnInit(): void {
    // sets up responsive screensize
    this.subscriptions.add(this.screenSizeService.getIsMobileSubject().subscribe(isMobile => this.isMobile = isMobile));

    // sets up main color for the championships page
    this.themeService.setMainPaneColor(Colors.blue);

    // collect championshipId from params
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.selectedChampionshipIdFromRoute = params['championshipId'];
    }));

    // retireve formats data from the CMS Championships Page
    this.subscriptions.add(this.contentful.getContentfulEntry(ContentfulEntryId.championships).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.loadingContent = false;
    }));

    // retrieve, sorts, and formats the championships list from the CMS Championships
    this.subscriptions.add(this.contentful.getContentfulGroup(ContentfulContentType.championships).subscribe(res => {
      this.championships = res.items
        .map(championship => ({
          ...championship.fields,
          logo: championship.fields.logo?.fields.file.url,
          images: championship.fields.images?.map(image => ({ path: image.fields.file.url })),
          state: championship.fields?.city.substring(championship.fields?.city.length - 2),
          champions: championship.fields.champions?.map(champion => ({ ...champion.fields }))
        }))
        .sort((a: Championship, b: Championship) => a.year < b.year ? 1 : -1);
      if (this.selectedChampionshipIdFromRoute) {
        let foundChampionship = this.championships.find(championship => championship.id === this.selectedChampionshipIdFromRoute);
        if (foundChampionship) {
          this.selectChampionship(foundChampionship);
        } else {
          this.location.replaceState('/championships');
        }
      }
      this.loadingChampionships = false;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a championship as the selected Championship to drill details
  selectChampionship(championship: Championship) {
    // close Nav
    this.navService.closeNav();

    // deselect a championship if it is already selected
    if (this.selectedChampionship?.name === championship.name) {
      this.selectedChampionship = undefined;
      this.themeService.setMainPaneColor(Colors.blue);
      this.location.replaceState('/championships');
    } else {
      this.selectedChampionship = championship;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[this.selectedChampionship.state]);

        //scroll to top of main pane
        document.getElementById("header")?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedChampionship.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.location.replaceState('/championships/' + this.selectedChampionship.id);
    }
  }

}
