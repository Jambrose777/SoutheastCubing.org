import { Component, HostListener, OnInit } from '@angular/core';
import { ContentfulService } from 'src/app/services/contentful.service';

@Component({
  selector: 'app-delegates',
  templateUrl: './delegates.component.html',
  styleUrls: ['./delegates.component.scss']
})
export class DelegatesComponent implements OnInit {
  delegates: any;
  title: string = '';
  description: string = '';
  loadingContent: boolean = true;
  loadingDelegates: boolean = true;
  public innerWidth: any;

  constructor(private contentful: ContentfulService) { }

  ngOnInit(): void {
    this.contentful.getContentfulGroup('delegates').subscribe(res => {
      this.delegates = res.items.sort((a, b) => a['fields']['order'] - b.fields['order']).map(delegate => delegate.fields);
      this.loadingDelegates = false;
    });

    this.contentful.getContentfulEntry('delegates').subscribe(res => {
      this.title = res.fields.title;
      this.description = res.fields.description;
      this.loadingContent = false;
    });

    this.innerWidth = window.innerWidth;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.innerWidth = window.innerWidth;
  }

}
