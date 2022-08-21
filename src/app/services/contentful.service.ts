import { Injectable } from '@angular/core';
import { createClient, Entry, EntryCollection } from 'contentful';
import { from, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { contentfulKeys } from '../models/contentful/contentfulKeys';

@Injectable({
  providedIn: 'root'
})

export class ContentfulService {
  private cdaClient = createClient({
    space: environment.contentful.space,
    accessToken: environment.contentful.accessToken
  });

  constructor() { }

  getContentfulGroup(contentTypeKey: string): Observable<EntryCollection<any>>{
    return from(this.cdaClient.getEntries(Object.assign({content_type: contentfulKeys.contentTypeIds[contentTypeKey as keyof typeof contentfulKeys.contentTypeIds]})));
  }

  getContentfulEntry(key: string): Observable<Entry<any>> {
    return from(this.cdaClient.getEntry(contentfulKeys.entryIds[key as keyof typeof contentfulKeys.entryIds]));
  }

}
