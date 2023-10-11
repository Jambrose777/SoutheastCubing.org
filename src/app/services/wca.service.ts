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

  // Retrieves all upcoming competitions in the US (maxes at 300) with all their competition data and filters those to SE Competitions.
  getUpcomingCompetitions(): Observable<Competition[]> {
    // checks if competitions are stored in local storage for the same day (psudo-cache) to not spam the WCA with too many requests.
    if (this.localstorage.getCompetitionsTTL() === moment().format('YYYY-MM-DD')) {
      return of(this.localstorage.getCompetitions());
    }

    return forkJoin([
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=100&page=1&start=" + moment().add(-1, 'day').format('YYYY-MM-DD')),
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=100&page=2&start=" + moment().add(-1, 'day').format('YYYY-MM-DD')),
      this.http.get("https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=100&page=3&start=" + moment().add(-1, 'day').format('YYYY-MM-DD'))
    ])
      .pipe(
        map(res => (res[0] as Array<Competition>).concat(res[1] as Array<Competition>).concat(res[2] as Array<Competition>)
          // Only include SE States
          .filter(comp =>
            comp.city.includes(', Georgia') ||
            comp.city.includes(', Tennessee') ||
            comp.city.includes(', North Carolina') ||
            comp.city.includes(', South Carolina') ||
            comp.city.includes(', Alabama') ||
            comp.city.includes(', Florida'))
          //  Sort by date
          .sort((a, b) => moment(a.start_date).isBefore(b.start_date) ? -1 : 1)
          // Create extra fields for competititon data
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

  // Retrieves all accepted registrations for a single competition
  getAcceptedRegistrations(competitionId: string): Observable<number> {
    return this.http.get(`https://www.worldcubeassociation.org//api/v0/competitions/${competitionId}/registrations`)
      .pipe(map((res: any[]) => res?.length));
  }

  // Calls service to save competition to local storage
  saveCompetitionstoLocalStorage(competitions) {
    this.localstorage.setCompetitions(competitions);
  }

  // Formats a date from WCA with appropriate multi day Logic
  getFullCompetitionDate(start: string, end: string): string {
    // 1 day competition has no special logic. Output example: "Jan 1, 2023"
    if (start === end) {
      return moment(start).format("MMM D, YYYY");
    }

    let mstart = moment(start);
    let mend = moment(end);

    // Check that year matches
    if (mstart.year === mend.year) {
      // Check that month matches
      if (mstart.month === mend.month) {
        // Multi day competition with a few days difference. Output example: Jan 1 - 2, 2023
        return mstart.format("MMM D") + " - " + mend.format("D, YYYY");
      } else {
        // Multi day competitiion with a month difference included. Output example: Jan 31 - Feb 2, 2023
        return mstart.format("MMM D") + " - " + mend.format("MMM D, YYYY");
      }
    } else {
      // Multi day competitiion with a year difference included. Output example: Dec 31, 2022 - Jan 1, 2023
      return mstart.format("MMM D, YYYY") + " - " + mend.format("MMM D, YYYY");
    }

  }

  // Calculates the current registration status based on when registration is opened and closed
  getRegistrationStatus(competition: Competition): RegistrationStatus {
    if (moment.utc(competition.registration_close).isBefore(moment.now())) {
      return RegistrationStatus.closed;
    } else if (moment.utc(competition.registration_open).isAfter(moment.now())) {
      return RegistrationStatus.preLaunch;
    } else {
      return RegistrationStatus.open;
    }
  }

  // Provides a string that is easy to read in a specific format
  getReadableRegistrationOpen(competition: Competition): string {
    return moment.utc(competition.registration_open).local().format("MMM D, YYYY [at] h:mm A");
  }
}
