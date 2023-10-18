import { Component, OnInit } from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { SubTopic } from 'src/app/models/SubTopic';
import { ContentfulService } from 'src/app/services/contentful.service';
import { ThemeService } from 'src/app/services/theme.service';
import { isMobile } from 'src/app/shared/functions';
import { Colors } from 'src/app/shared/types';

@Component({
  selector: 'se-organizers',
  templateUrl: './organizers.component.html',
  styleUrls: ['./organizers.component.scss']
})
export class OrganizersComponent implements OnInit {
  isMobile = isMobile();
  title: string = 'Organizer Guidelines';
  description: string = '';
  loadingContent: boolean = true;
  subTopics: SubTopic[];
  selectedSubTopic: SubTopic;
  subText: string;

  constructor(private contentful: ContentfulService, private themeService: ThemeService) { }

  ngOnInit(): void {
    // sets up main color for the Organizers page
    this.themeService.setMainPaneColor(Colors.yellow);

    // retireve formats data from the CMS Organizers Page
    this.contentful.getContentfulEntry(ContentfulEntryId.organizers).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopics?.map(subTopic => ({ ...subTopic.fields, photo: subTopic.fields['photo']?.fields.file.url, color: Colors[subTopic.fields.color] }))
      this.subText = res.fields.subText1;
      this.loadingContent = false;
    });
  }

  // sets a sub topic as the selected sub topic to drill details
  selectSubTopic(subTopic: SubTopic) {
    // deselect a sub topic if it is already selected
    if (this.selectedSubTopic?.title === subTopic.title) {
      this.selectedSubTopic = undefined;
      this.themeService.setMainPaneColor(Colors.yellow);
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