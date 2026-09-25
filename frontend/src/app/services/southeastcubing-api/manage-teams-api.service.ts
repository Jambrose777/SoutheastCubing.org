import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ManageTeam,
  PersonSearchResult,
  TeamLeaderStint,
  TeamMembership,
  WcaPersonLookupResult,
} from '../../models/ManageTeam';

// Backs the Manage Teams dashboard
@Injectable({
  providedIn: 'root',
})
export class ManageTeamsApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard`;

  getTeams(): Observable<ManageTeam[]> {
    return this.http.get<ManageTeam[]>(`${this.base}/teams`);
  }

  createTeam(body: {
    name: string;
    description?: string | null;
    email?: string | null;
    hidden?: boolean;
  }): Observable<ManageTeam> {
    return this.http.post<ManageTeam>(`${this.base}/teams`, body);
  }

  updateTeam(
    teamId: string,
    body: { name?: string; description?: string | null; email?: string | null; hidden?: boolean },
  ): Observable<ManageTeam> {
    return this.http.put<ManageTeam>(`${this.base}/teams/${teamId}`, body);
  }

  archiveTeam(teamId: string): Observable<ManageTeam> {
    return this.http.post<ManageTeam>(`${this.base}/teams/${teamId}/archive`, null);
  }

  unarchiveTeam(teamId: string): Observable<ManageTeam> {
    return this.http.post<ManageTeam>(`${this.base}/teams/${teamId}/unarchive`, null);
  }

  hardDeleteTeam(teamId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/teams/${teamId}`);
  }

  addMember(
    teamId: string,
    body: {
      peopleId?: string;
      wcaId?: string;
      specialRole?: string | null;
      color?: string | null;
      startDate?: string;
      endDate?: string | null;
    },
  ): Observable<TeamMembership> {
    return this.http.post<TeamMembership>(`${this.base}/teams/${teamId}/members`, body);
  }

  updateMembership(
    membershipId: string,
    body: {
      startDate: string;
      endDate?: string | null;
      specialRole?: string | null;
      color?: string | null;
    },
  ): Observable<TeamMembership> {
    return this.http.put<TeamMembership>(`${this.base}/team-memberships/${membershipId}`, body);
  }

  removeMember(membershipId: string): Observable<TeamMembership> {
    return this.http.post<TeamMembership>(
      `${this.base}/team-memberships/${membershipId}/remove`,
      null,
    );
  }

  hardDeleteMembership(membershipId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/team-memberships/${membershipId}`);
  }

  setLeader(teamId: string, peopleId: string): Observable<TeamLeaderStint> {
    return this.http.post<TeamLeaderStint>(`${this.base}/teams/${teamId}/leader`, { peopleId });
  }

  removeLeader(teamId: string): Observable<TeamLeaderStint> {
    return this.http.delete<TeamLeaderStint>(`${this.base}/teams/${teamId}/leader`);
  }

  updateLeadershipStint(
    leaderId: string,
    body: { startDate: string; endDate?: string | null },
  ): Observable<TeamLeaderStint> {
    return this.http.put<TeamLeaderStint>(`${this.base}/team-leaders/${leaderId}`, body);
  }

  hardDeleteLeadershipRow(leaderId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/team-leaders/${leaderId}`);
  }

  searchPeople(query: string): Observable<PersonSearchResult[]> {
    return this.http.get<PersonSearchResult[]>(`${this.base}/people/search`, {
      params: { q: query },
    });
  }

  lookupWcaId(wcaId: string): Observable<WcaPersonLookupResult> {
    return this.http.get<WcaPersonLookupResult>(`${this.base}/people/wca-lookup/${wcaId}`);
  }
}
