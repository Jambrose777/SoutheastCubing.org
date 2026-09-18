import { Injectable } from '@angular/core';
import { createClient, Entry, EntryCollection, EntrySkeletonType } from 'contentful';
import { from, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ContentfulContentType, ContentfulEntryId } from '../models/Contentful';

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

  // retrieves all Contentful "Entries" pertaining to a "Content Type". Callers
  // provide the specific `EntrySkeletonType` for the content type being
  // queried so the response is typed against that content type's real fields.
  // The `Modifiers` type argument is pinned to `undefined` (rather than left to
  // default to the full `ChainModifiers` union) to match what `createClient()`
  // actually returns here, since no chain modifiers (e.g. `withAllLocales()`)
  // are ever applied - leaving it as the union default would widen every field
  // to also include its locale-keyed shape.
  getContentfulGroup<Skeleton extends EntrySkeletonType>(
    contentTypeKey: ContentfulContentType,
  ): Observable<EntryCollection<Skeleton, undefined>> {
    return from(
      this.cdaClient.getEntries<Skeleton>(Object.assign({ content_type: contentTypeKey })),
    );
  }

  // retrieves a specfic Contentful "Entry" based on a key for it. See
  // see getContentfulGroup() for the same `Skeleton`/`Modifiers` type
  // argument explanation.
  getContentfulEntry<Skeleton extends EntrySkeletonType>(
    entryId: ContentfulEntryId,
  ): Observable<Entry<Skeleton, undefined>> {
    // `include: 2` resolves two levels of linked entries (e.g. page -> subTopic ->
    // subTopic's own nested subTopics) - the CDA API's default `include` is 1, which
    // only resolves the page's direct links and leaves any second-level links
    // (like Get Involved's nested Organizers subtopics) as unresolved link stubs.
    return from(this.cdaClient.getEntry<Skeleton>(entryId, { include: 2 }));
  }
}
