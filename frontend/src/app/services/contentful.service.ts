import { Injectable } from '@angular/core';
import { createClient, Entry, EntryCollection } from 'contentful';
import { from, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ContentfulContentType, ContentfulEntryId } from '../models/Contentful';

// The `contentful` SDK types `.fields` against a per-content-type generic; these
// aliases widen it back to `any` at a single choke point
export type ContentfulEntry = Entry<any> & { fields: any };
export type ContentfulEntryCollection = Omit<EntryCollection<any>, 'items'> & {
  items: ContentfulEntry[];
};

@Injectable({
  providedIn: 'root',
})

// Contentful is a Service to connect to the Contentful Content Management system for SoutheastCubing.org
export class ContentfulService {
  private cdaClient = createClient({
    space: environment.contentful.space,
    accessToken: environment.contentful.accessToken,
  });

  constructor() {}

  // retrieves all Contentful "Entries" pertaining to a "Content Type".
  getContentfulGroup(contentTypeKey: ContentfulContentType): Observable<ContentfulEntryCollection> {
    return from(this.cdaClient.getEntries(Object.assign({ content_type: contentTypeKey })));
  }

  // retrieves a specfic Contentful "Entry" based on a key for it.
  getContentfulEntry(entryId: ContentfulEntryId): Observable<ContentfulEntry> {
    return from(this.cdaClient.getEntry(entryId));
  }
}
