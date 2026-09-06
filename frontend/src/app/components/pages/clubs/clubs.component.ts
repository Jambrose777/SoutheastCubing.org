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
import { ActivatedRoute } from '@angular/router';
import { Club } from 'src/app/models/Club';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { scaleToDisplaySize } from 'src/app/shared/scale-to-display-size';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors, StateColors, States } from 'src/app/shared/types';
import { environment } from 'src/environments/environment';
import { Location, NgClass } from '@angular/common';
import { ScreenSizeService } from 'src/app/services/screen-size.service';
import { Subscription } from 'rxjs';
import { LinksService } from 'src/app/services/links.service';
import { MapPoint } from 'src/app/models/Map';
import { HeaderComponent } from '../../core/header/header.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { MarkdownComponent } from 'ngx-markdown';
import { SeMapComponent } from '../../shared/se-map/se-map.component';
import { SeFilterMapComponent } from '../../shared/se-filter-map/se-filter-map.component';
import { SelectedClubComponent } from './selected-club/selected-club.component';

@Component({
  selector: 'se-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeaderComponent,
    LoadingSpinnerComponent,
    MarkdownComponent,
    SeMapComponent,
    SeFilterMapComponent,
    SelectedClubComponent,
    NgClass,
  ],
})
export class ClubsComponent implements OnInit, OnDestroy {
  private contentful = inject(ContentfulService);
  private themeService = inject(ThemeService);
  private navService = inject(NavService);
  private route = inject(ActivatedRoute);
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
  title = signal('Southeast Clubs');
  description = signal('');
  loadingContent = signal(true);
  loadingClubs = signal(true);
  clubs = signal<Club[]>(undefined);
  filteredClubs = signal<Club[]>(undefined);
  selectedClub = signal<Club>(undefined);
  clubId = input<string>();
  subText1 = signal('');
  subText1ButtonText = signal('');
  subText1ButtonLink = signal('');
  subText2 = signal('');
  subText2ButtonText = signal('');
  subText2ButtonLink = signal('');
  filters = signal<{ states: States[] }>({ states: [] });
  // Set only from click/mouseover events originating in this component's own
  // template (or a child's output binding in that template), which already
  // trigger OnPush change detection on their own, so these stay as plain
  // fields instead of signals.
  hoveredMapClub: string;
  hoveredListClub: string;
  clubMapPoints = signal<MapPoint[]>(undefined);
  filtersDescription = signal<string>(undefined);
  filtersOpen = signal(false);
  subscriptions: Subscription = new Subscription();

  ngOnInit(): void {
    // sets up main color for the clubs page
    this.themeService.setMainPaneColor(Colors.purple);

    // collect filters from query params
    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        if (params['states']) {
          const states = params['states']
            .split(',')
            .filter((state) =>
              [
                'Alabama',
                'Florida',
                'Georgia',
                'North Carolina',
                'South Carolina',
                'Tennessee',
              ].includes(state),
            );
          this.filters.set({ states });
        }
      }),
    );

    // retireve formats data from the CMS Clubs Page
    this.subscriptions.add(
      this.contentful.getContentfulEntry(ContentfulEntryId.clubs).subscribe((res) => {
        this.title.set(res.fields.title);
        this.description.set(res.fields.description);
        this.subText1.set(res.fields.subText1);
        this.subText1ButtonText.set(res.fields.subText1ButtonText);
        this.subText1ButtonLink.set(res.fields.subText1ButtonLink);
        this.subText2.set(res.fields.subText2);
        this.subText2ButtonText.set(res.fields.subText2ButtonText);
        this.subText2ButtonLink.set(res.fields.subText2ButtonLink);
        this.filtersDescription.set(res.fields.subTopics[0]?.fields.description);
        this.loadingContent.set(false);
      }),
    );

    // retrieve, sorts, and formats the clubs list from the CMS Clubs
    this.subscriptions.add(
      this.contentful.getContentfulGroup(ContentfulContentType.clubs).subscribe((res) => {
        const clubs = res.items
          .map((club) => {
            const imageSize = scaleToDisplaySize(
              club.fields.image?.fields.file.details?.image?.width,
              club.fields.image?.fields.file.details?.image?.height,
            );
            return {
              ...club.fields,
              image: club.fields.image?.fields.file.url,
              imageWidth: imageSize.width,
              imageHeight: imageSize.height,
              state: club.fields?.city.substring(club.fields?.city.length - 2),
            };
          })
          .sort((a: Club, b: Club) =>
            a.city == b.city ? (a.name > b.name ? 1 : -1) : a.city > b.city ? 1 : -1,
          );
        this.clubs.set(clubs);
        this.filterClubs();
        if (this.clubId()) {
          const foundClub = clubs.find((comp) => comp.id === this.clubId());
          if (foundClub) {
            this.selectClub(foundClub);
          } else {
            this.updateUrl();
          }
        }
        this.loadingClubs.set(false);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // sets a club as the selected Club to drill details
  selectClub(club: Club) {
    // close Nav
    this.navService.closeNav();

    // close Filters
    this.filtersOpen.set(false);

    // deselect a club if it is already selected
    if (this.selectedClub()?.id === club.id) {
      this.selectedClub.set(undefined);
      this.themeService.setMainPaneColor(Colors.purple);
      this.updateUrl();
    } else {
      this.selectedClub.set(club);
      if (!this.isMobile()) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[club.state]);

        //scroll to top of main pane
        document.getElementById('header')?.scrollIntoView();
      } else {
        setTimeout(() => {
          document.getElementById(club.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      this.updateUrl();
    }
  }

  // Adds a state to the filters
  handleStateSelection(state: States) {
    const currentStates = this.filters().states;
    // If the state is already filtered on, remove it from the filters
    let newStates = currentStates.includes(state)
      ? currentStates.filter((filteredState) => filteredState !== state)
      : [...currentStates, state];

    // If filters are all full, remove them (same condition)
    if (newStates.length === 6) {
      newStates = [];
    }
    this.filters.set({ states: newStates });

    // Make Subsequent Calls
    this.updateUrl();
    this.scrollToClubs();
    this.filterClubs();
  }

  // Filters Clubs in list according to filters
  filterClubs() {
    let filteredClubs = this.clubs();
    const filterStates = this.filters().states;
    if (filterStates.length > 0) {
      filteredClubs = filteredClubs?.filter((club) => filterStates.includes(States[club.state]));
    }
    this.filteredClubs.set(filteredClubs);

    this.createMapPoints();
  }

  // Updates URL to include filters
  updateUrl() {
    const selectedClub = this.selectedClub();
    const filterStates = this.filters().states;
    this.location.replaceState(
      '/clubs' +
        (selectedClub ? '/' + selectedClub.id : '') +
        (filterStates.length > 0 ? '?states=' + filterStates.join(',') : ''),
    );
  }

  // Scrolls to the secondary pane on mobile
  scrollToClubs() {
    if (this.isMobile()) {
      setTimeout(() => {
        document.getElementById('club-list-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    }
  }

  // Creates array for the map points with lats and longs
  createMapPoints() {
    this.clubMapPoints.set(
      this.filteredClubs()
        ?.map((club) => ({
          id: club.id,
          lat: club.latitude,
          long: club.longitude,
        }))
        .filter((club) => club.lat && club.long),
    );
  }

  // handles hover event on map
  mapHoverEvent(clubId: string) {
    this.hoveredMapClub = clubId;

    // scroll club into view if not visible
    setTimeout(() => {
      const target = document.getElementById(clubId);
      if (
        target &&
        (target.getBoundingClientRect().bottom > window.innerHeight ||
          target.getBoundingClientRect().top < 0)
      ) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
  }

  // handles click event on map to open club
  mapClickEvent(clubId: string) {
    const club = this.filteredClubs().find((club) => club.id === clubId);
    this.selectClub(club);
    // resets hovered event
    this.hoveredMapClub = '';
  }

  // hover event on club list
  clubHover(club?: Club) {
    this.hoveredListClub = club?.id;
  }

  // toggles whether the filters pane is open or not
  toggleFiltersOpen() {
    this.filtersOpen.update((open) => !open);

    if (this.filtersOpen()) {
      // scroll to top on mobile
      document.getElementById('header')?.scrollIntoView({ behavior: 'smooth' });

      // clear page from a selected club on filter changes
      if (this.selectedClub()) {
        this.selectClub(this.selectedClub());
      }
    }
  }
}
