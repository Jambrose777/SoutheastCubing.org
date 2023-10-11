import { Component, OnInit } from '@angular/core';
import { ContentfulEntryId } from 'src/app/models/Contentful';
import { ContentfulService } from 'src/app/services/contentful.service';

@Component({
  selector: 'app-involvement',
  templateUrl: './involvement.component.html',
  styleUrls: ['./involvement.component.scss']
})
export class InvolvementComponent implements OnInit {
  title: string = '';
  description: string = '';
  loadingContent: boolean = true;
  subTopics: { title: string, description: string, photo: any }[];
  selectedTopic: string = '';

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry(ContentfulEntryId.involvement).subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.subTopics = res.fields.subTopic.map(subTopic => subTopic.fields);
      this.loadingContent = false;
    });
  }

  openTopic(subTopic: string): void {
    if (this.selectedTopic === subTopic) {
      this.selectedTopic = '';
    } else {
      this.selectedTopic = subTopic;
    }
  }

}
