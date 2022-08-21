import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Competition } from '../models/Competition';

@Injectable({
  providedIn: 'root'
})
export class WcaService {

  constructor(private http: HttpClient) { }

  getUpcomingCompetitions(): Observable<Competition[]> {
    return this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US")
      .pipe(
        map(res => res as Array<Competition>)
      );
  }
}
