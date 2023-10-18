import { Component, OnInit } from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {
  isMobile = isMobile();
  title: string = 'Get Involved';
  description: string = '';
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve formats data from the CMS Involvement Page
    this.contentful.getContentfulEntry(ContentfulEntryId.contact).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    });
  }

}
