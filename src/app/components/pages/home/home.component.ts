import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { Colors } from 'src/app/shared/types';
import { isMobile } from 'src/app/shared/functions';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { environment } from 'src/environments/environment';
import { SubTopic } from 'src/app/models/SubTopic';
import { Router } from '@angular/router';

@Component({
  selector: 'se-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  isMobile = isMobile();
  enviroment = environment;
  title: string = 'Southeast Cubing';
  description: string = '';
  photos: string[] = [];
  loadingContent: boolean = true;
  subTopics: SubTopic[];

  constructor(private contentful: ContentfulService, private themeService: ThemeService, private router: Router) { }

  ngOnInit(): void {
    // sets up main color for the home page
    this.themeService.setMainPaneColor(Colors.blue);

    // retireve and formats data from the CMS home Page
    this.contentful.getContentfulEntry(ContentfulEntryId.home).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics?.map(subTopic => ({ ...subTopic.fields, color: Colors[subTopic.fields.color] }))
      this.photos = res.fields.photos?.map(photo => ({ path: photo.fields.file.url }));
      this.loadingContent = false;
    });
  }

  announcementClick(subTopic: SubTopic) {
    if(subTopic.buttonInternalLink) {
      this.router.navigate([subTopic.buttonInternalLink])
    } else if (subTopic.buttonExternalLink) {
      this.router.navigate([]).then(() => {
        window.open(subTopic.buttonExternalLink, '_blank');
      });
    }
  }
}
