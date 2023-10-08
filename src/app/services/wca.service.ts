import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, of } from 'rxjs';
import { Competition } from '../models/Competition';
import * as moment from 'moment';
import { LocalStorageService } from './local-storage.service';
import { RegistrationStatus } from '../shared/types';

@Injectable({
  providedIn: 'root'
})
export class WcaService {

  constructor(private http: HttpClient, private localstorage: LocalStorageService) { }

  getUpcomingCompetitions(): Observable<Competition[]> {
    if(this.localstorage.getCompetitionsTTL() === moment().format('YYYY-MM-DD')) {
      return of(this.localstorage.getCompetitions());
    }

    return forkJoin([
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=1000&page=1&start=" + moment().add(-1, 'day').format('YYYY-MM-DD')),
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=1000&page=2&start=" + moment().add(-1, 'day').format('YYYY-MM-DD')),
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=1000&page=3&start=" + moment().add(-1, 'day').format('YYYY-MM-DD'))
    ])
      .pipe(
        map(res => (res[0] as Array<Competition>).concat(res[1] as Array<Competition>).concat(res[2] as Array<Competition>)
          .filter(comp => 
            comp.city.includes(', Georgia') || 
            comp.city.includes(', Tennessee') || 
            comp.city.includes(', North Carolina') || 
            comp.city.includes(', South Carolina') || 
            comp.city.includes(', Alabama') || 
            comp.city.includes(', Florida'))
          .sort((a, b) => moment(a.start_date).isBefore(b.start_date) ? -1 : 1)
          .map(competition => ({
              ...competition,
              state: competition.city.substring(competition.city.lastIndexOf(",") + 1).trim(),
              full_date: this.getFullCompetitionDate(competition.start_date, competition.end_date),
              registration_status: this.getRegistrationStatus(competition),
              readable_registration_open: this.getReadableRegistrationOpen(competition)
          }))
        ),
        map(res => {
          this.saveCompetitionstoLocalStorage(res);
          return res;
        })
      );
  }

  getActiveRegistrations(competitionId: string): Observable<number> {
    return this.http.get(`https://www.worldcubeassociation.org//api/v0/competitions/${competitionId}/registrations`)
      .pipe(map((res: any[]) => res?.length));
  }

  saveCompetitionstoLocalStorage(competitions) {
    this.localstorage.setCompetitions(competitions);
  }

  getFullCompetitionDate(start: string, end: string): string {
    if (start === end) return moment(start).format("MMM D, YYYY");
    let mstart = moment(start);
    let mend = moment(end);

    if (mstart.year === mend.year) {
      if (mstart.month === mend.month) {
        return mstart.format("MMM D") + " - " + mend.format("D, YYYY");
      } else {
        return mstart.format("MMM D") + " - " + mend.format("MMM D, YYYY");
      }
    } else {
      return mstart.format("MMM D, YYYY") + " - " + mend.format("MMM D, YYYY");
    }

  }

  getRegistrationStatus(competition: Competition): RegistrationStatus {
    if (moment.utc(competition.registration_close).isBefore(moment.now())) {
      return RegistrationStatus.closed;
    } else if (moment.utc(competition.registration_open).isAfter(moment.now())) {
      return RegistrationStatus.preLaunch;
    } else {
      return RegistrationStatus.open;
    }
  }

  getReadableRegistrationOpen(competition: Competition): string {
    return moment.utc(competition.registration_open).local().format("MMM D, YYYY [at] h:mm A");
  }
}
