import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { isMobile } from 'src/app/shared/functions';
import { ContentfulEntryId } from 'src/app/models/Contentful';

@Component({
  selector: 'se-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  isMobile = isMobile();
  title: string = 'Southeast Cubing';
  description: string = '';
  photos: string[] = [];
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.blue);

    // retireve and formats data from the CMS home Page
    this.contentful.getContentfulEntry(ContentfulEntryId.home).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.photos = res.fields.photos.map(photo => ({ path: photo.fields.file.url }));
      this.loadingContent = false;
    });
  }

}
