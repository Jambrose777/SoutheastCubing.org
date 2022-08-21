import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';

@Component({
  selector: 'app-involvement',
  templateUrl: './involvement.component.html',
  styleUrls: ['./involvement.component.scss']
})
export class InvolvementComponent implements OnInit {
  title: string = '';
  description: string = '';

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('involvement').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
    });
  }

}
