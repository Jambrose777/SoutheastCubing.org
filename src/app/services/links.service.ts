import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ContentfulService } from './contentful.service';
import { ContentfulEntryId } from '../models/Contentful';
import { take } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LinksService {
  discord: string = environment.links.discord;
  facebook: string = environment.links.facebook;
  instagram: string = environment.links.instagram;
  youtube: string = environment.links.youtube;

  constructor(
    private contentful: ContentfulService
  ) { }

  pullLinksFromContentful() {
    // retireve links data from the CMS to overwrite links
    this.contentful.getContentfulEntry(ContentfulEntryId.linksConfiguration).pipe(take(1)).subscribe(res => {
      if (res.fields.discord) {
        this.discord = res.fields.discord;
      }
      if (res.fields.facebook) {
        this.facebook = res.fields.facebook;
      }
      if (res.fields.instagram) {
        this.instagram = res.fields.instagram;
      }
      if (res.fields.youtube) {
        this.youtube = res.fields.youtube;
      }
    });
  }
}
