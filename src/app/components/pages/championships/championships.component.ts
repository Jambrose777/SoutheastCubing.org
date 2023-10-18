import { Component, OnInit } from '@angular/core';
import { Championship } from 'src/app/models/Championship';
import { ContentfulContentType, ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors, StateColors } from 'src/app/shared/types';

@Component({
  selector: 'se-championships',
  templateUrl: './championships.component.html',
  styleUrls: ['./championships.component.scss']
})
export class ChampionshipsComponent implements OnInit {
  isMobile = isMobile();
  StateColors = StateColors;
  title: string = 'Southeast Championships';
  description: string = '';
  loadingContent: boolean = true;
  loadingChampionships: boolean = true;
  championships: Championship[];
  selectedChampionship: Championship;
  subText1: string = '';

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    // sets up main color for the championships page
    this.themeService.setMainPaneColor(Colors.blue);

    // retireve formats data from the CMS Championships Page
    this.contentful.getContentfulEntry(ContentfulEntryId.championships).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subText1 = res.fields.subText1;
      this.loadingContent = false;
    });


    // retrieve, sorts, and formats the championships list from the CMS Championships
    this.contentful.getContentfulGroup(ContentfulContentType.championships).subscribe(res => {
      this.championships = res.items
        .map(championship => ({
          ...championship.fields,
          logo: championship.fields.logo?.fields.file.url,
          images: championship.fields.images?.map(image => ({ path: image.fields.file.url })),
          state: championship.fields?.city.substring(championship.fields?.city.length - 2),
          champions: championship.fields.champions?.map(champion => ({ ...champion.fields }))
        }))
        .sort((a: Championship, b: Championship) => a.year < b.year ? 1 : -1);
      this.loadingChampionships = false;
      console.log(this.championships)
    });
  }

  // sets a championship as the selected Championship to drill details
  selectChampionship(championship: Championship) {
    // deselect a championship if it is already selected
    if (this.selectedChampionship?.name === championship.name) {
      this.selectedChampionship = undefined;
      this.themeService.setMainPaneColor(Colors.blue);
    } else {
      this.selectedChampionship = championship;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(StateColors[this.selectedChampionship.state]);
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedChampionship.id)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
    }
  }

}
