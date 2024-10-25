import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { EmailRequestBody } from '../models/EmailRequestBody';
import { Observable, map } from 'rxjs';
import { Competition } from '../models/Competition';
import { getRegistrationStatus, getReadableRegistrationOpen } from '../shared/competition.utils';

@Injectable({
  providedIn: 'root'
})
export class SouteastcubingApiService {

  constructor(private http: HttpClient) { }

  contactSubmission(body: EmailRequestBody) {
    return this.http.post(`${environment.links.southeastCubingApi}/email`, body);
  }

  getUpcomingCompetitions(): Observable<Competition[]> {
    return this.http.get(`${environment.links.southeastCubingApi}/competitions`)
      .pipe(map((res: any[]) => res.map(competition => ({
        ...competition,
        registration_status: getRegistrationStatus(competition),
        readable_registration_open: getReadableRegistrationOpen(competition)
      } as Competition))));
  }

  updateCompetitions(): Observable<any> {
    return this.http.get(`${environment.links.southeastCubingApi}/update-competitions`)
  }
}
