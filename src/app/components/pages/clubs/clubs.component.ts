import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';

@Component({
  selector: 'app-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.scss']
})
export class ClubsComponent implements OnInit {
  title: string = '';
  description: string = '';
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('clubs').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    });
  }

}
