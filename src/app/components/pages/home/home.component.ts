import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  isMobile = isMobile;
  title: string = 'Southeast Cubing';
  description: string = '';
  photos: string[] = [];
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    this.themeService.setRightPaneColor(Colors.blue);

    this.contentful.getContentfulEntry('home').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.photos = res.fields.photos.map(photo => ({path: photo.fields.file.url}));
      this.loadingContent = false;
    });
  }

}
