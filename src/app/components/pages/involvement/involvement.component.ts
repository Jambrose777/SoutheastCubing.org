import { Component, OnInit } from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { NavService } from 'src/app/services/nav.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'se-involvement',
  templateUrl: './involvement.component.html',
  styleUrls: ['./involvement.component.scss']
})
export class InvolvementComponent implements OnInit {
  isMobile = isMobile();
  title: string = 'Get Involved';
  description: string = '';
  loadingContent: boolean = true;
  subTopics: SubTopic[];
  selectedSubTopic: SubTopic;

  constructor(private contentful: ContentfulService, private themeService: ThemeService, private navService: NavService) { }

  ngOnInit(): void {
    // sets up main color for the Involvement page
    this.themeService.setMainPaneColor(Colors.red);

    // retireve formats data from the CMS Involvement Page
    this.contentful.getContentfulEntry(ContentfulEntryId.involvement).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics.map(subTopic => ({ ...subTopic.fields, photo: subTopic.fields['photo']?.fields.file.url, color: Colors[subTopic.fields.color] }))
      this.loadingContent = false;
    });
  }

  // sets a sub topic as the selected sub topic to drill details
  selectSubTopic(subTopic: SubTopic) {
    // close Nav
    this.navService.closeNav();

    // deselect a sub topic if it is already selected
    if (this.selectedSubTopic?.title === subTopic.title) {
      this.selectedSubTopic = undefined;
      this.themeService.setMainPaneColor(Colors.red);
    } else {
      this.selectedSubTopic = subTopic;
      if (!this.isMobile) {
        // sets the left pane color based on state value
        this.themeService.setMainPaneColor(subTopic.color);
      } else {
        setTimeout(() => {
          document.getElementById(this.selectedSubTopic.title)?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
    }
  }

}
