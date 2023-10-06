import { Component, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';
import { isMobile } from 'src/app/shared/functions';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  isMobile = isMobile;
  title: string = '';
  description: string = '';
  photo: string = '';
  photos: string[] = [];
  loadingContent: boolean = true;

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulEntry('home').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.photo = res.fields.photo.fields.file.url;
      this.photos = res.fields.photos.map(photo => ({path: photo.fields.file.url}));
      console.log(this.photos);
      this.loadingContent = false;
    });
  }

}
