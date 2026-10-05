import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersonSearchResult, SelectedPerson, WcaPersonLookupResult } from '../../models/Person';

@Injectable({
  providedIn: 'root',
})
export class PeopleApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard`;

  // Search-as-you-type combobox - our own people/users data only.
  searchPeople(query: string): Observable<PersonSearchResult[]> {
    return this.http.get<PersonSearchResult[]>(`${this.base}/people/search`, {
      params: { q: query },
    });
  }

  // "Add by WCA ID" fallback - proxies WCA's public GET /api/v0/persons/:wca_id.
  lookupWcaId(wcaId: string): Observable<WcaPersonLookupResult> {
    return this.http.get<WcaPersonLookupResult>(`${this.base}/people/wca-lookup/${wcaId}`);
  }

  // Resolves a se-person-search selection (either an existing peopleId or a
  // WCA-ID fallback with no people row yet) into a display-ready person -
  // used by multi-select comboboxes that need the resolved person.
  resolvePerson(person: { peopleId?: string; wcaId?: string }): Observable<SelectedPerson> {
    return this.http.post<SelectedPerson>(`${this.base}/people/resolve`, person);
  }
}
