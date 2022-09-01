import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  title: string = '';
  description: string = '';
  photo: string = '';
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('home').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.photo = res.fields.photo.fields.file.url;
      this.loadingContent = false;
    });
  }

}
