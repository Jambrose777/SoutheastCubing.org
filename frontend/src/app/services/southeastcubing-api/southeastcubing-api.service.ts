import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { EmailRequestBody } from '../../models/EmailRequestBody';
import { Observable, map } from 'rxjs';
import { Competition } from '../../models/Competition';
import { CurrentUser } from '../../models/CurrentUser';
import { getRegistrationStatus, getReadableRegistrationOpen } from '../../shared/competition.utils';

// Shape of a competition as returned by the backend's /competitions endpoint,
// before `registration_status`/`readable_registration_open` are derived.
type CompetitionResponse = Omit<Competition, 'registration_status' | 'readable_registration_open'>;

@Injectable({
  providedIn: 'root',
})
export class SoutheastcubingApiService {
  private http = inject(HttpClient);

  contactSubmission(body: EmailRequestBody) {
    return this.http.post(`${environment.links.southeastCubingApi}/email`, body);
  }

  getUpcomingCompetitions(): Observable<Competition[]> {
    return this.http
      .get<CompetitionResponse[]>(`${environment.links.southeastCubingApi}/competitions`)
      .pipe(
        map((res) =>
          res.map(
            (competition) =>
              ({
                ...competition,
                registration_status: getRegistrationStatus(competition),
                readable_registration_open: getReadableRegistrationOpen(competition),
              }) as Competition,
          ),
        ),
      );
  }

  // The competitions in the response body aren't consumed by callers (only
  // discordPostFailures is), so that part is typed as `unknown` rather than
  // a full shape of the WCA payload.
  updateCompetitions(): Observable<{
    competitions: unknown;
    discordPostFailures: { id: string; name: string }[];
  }> {
    return this.http.post<{
      competitions: unknown;
      discordPostFailures: { id: string; name: string }[];
    }>(`${environment.links.southeastCubingApi}/update-competitions`, null);
  }

  // Checks whether the session cookie still resolves to a signed-in user.
  getCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.links.southeastCubingApi}/auth/me`);
  }

  // Deletes the session's server-side row and clears the cookie.
  signOut(): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${environment.links.southeastCubingApi}/auth/logout`,
      null,
    );
  }
}
