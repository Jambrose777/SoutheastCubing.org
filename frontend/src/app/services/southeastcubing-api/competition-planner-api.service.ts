import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  PlannerCompetition,
  PlannerBulkRefreshResponse,
  PlannerCompetitionRefreshResponse,
  PlannerCompetitionsResponse,
  PlannerCompetitionSaveRequest,
  PlannerWcaCompetitionOption,
  PlannerMultiCityCreateRequest,
  PlannerWcaDriveFolderResponse,
  PlannerWcaLinkRequest,
} from '../../models/PlannerCompetition';

// Backs the Competition Planner dashboard.
@Injectable({
  providedIn: 'root',
})
export class CompetitionPlannerApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard/competition-planner`;

  // Every upcoming competition regardless of status, for the planner's list view.
  getCompetitions(): Observable<PlannerCompetitionsResponse> {
    return this.http.get<PlannerCompetitionsResponse>(`${this.base}/competitions`);
  }

  // Refreshes upcoming competitions, subject to the global cooldown and single-flight guard.
  refreshCompetitions(): Observable<PlannerBulkRefreshResponse> {
    return this.http.post<PlannerBulkRefreshResponse>(`${this.base}/competitions/refresh`, null);
  }

  // Refreshes one WCA-linked Planner row.
  refreshCompetition(competitionId: string): Observable<PlannerCompetitionRefreshResponse> {
    return this.http.post<PlannerCompetitionRefreshResponse>(
      `${this.base}/competitions/${encodeURIComponent(competitionId)}/refresh`,
      null,
    );
  }

  // WCA competitions eligible for an automatic banner, excluding permanent dismissals.
  getUnannouncedCompetitionBanners(): Observable<PlannerWcaCompetitionOption[]> {
    return this.http.get<PlannerWcaCompetitionOption[]>(`${this.base}/unannounced-competitions`);
  }

  // WCA competitions eligible for the standalone link sheet, including dismissed banners.
  getWcaLinkOptions(): Observable<PlannerWcaCompetitionOption[]> {
    return this.http.get<PlannerWcaCompetitionOption[]>(`${this.base}/wca-link-options`);
  }

  // Permanently hides one WCA competition's automatic banner for this user.
  dismissUnannouncedCompetition(wcaCompetitionId: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.base}/unannounced-competitions/${encodeURIComponent(wcaCompetitionId)}/dismiss`,
      {},
    );
  }

  // Links a WCA competition to a Potential Planner row or creates a linked row.
  linkWcaCompetition(body: PlannerWcaLinkRequest): Observable<PlannerCompetition> {
    return this.http.post<PlannerCompetition>(`${this.base}/competitions/link-wca`, body);
  }

  // Creates one linked Planner row for each supplied multi-city location.
  createMultiCityCompetition(
    body: PlannerMultiCityCreateRequest,
  ): Observable<PlannerCompetition[]> {
    return this.http.post<PlannerCompetition[]>(
      `${this.base}/competitions/create-multi-city`,
      body,
    );
  }

  // Creates a new Planner competition (always Potential) - open to any
  // Admin/Board/Delegate.
  createCompetition(body: PlannerCompetitionSaveRequest): Observable<PlannerCompetition> {
    return this.http.post<PlannerCompetition>(`${this.base}/competitions`, body);
  }

  // Edits an existing Planner competition - restricted server-side to
  // Admin/Board/Regional Delegate or a Delegate already assigned to it.
  updateCompetition(
    competitionId: string,
    body: PlannerCompetitionSaveRequest,
  ): Observable<PlannerCompetition> {
    return this.http.put<PlannerCompetition>(`${this.base}/competitions/${competitionId}`, body);
  }

  // Creates and links a new WCA Drive folder for an existing Planner competition.
  createWcaDriveFolder(competitionId: string): Observable<PlannerWcaDriveFolderResponse> {
    return this.http.post<PlannerWcaDriveFolderResponse>(
      `${this.base}/competitions/${encodeURIComponent(competitionId)}/wca-drive-folder`,
      null,
    );
  }

  // Deletes a Planner competition - only ever possible while Potential/Planning.
  deleteCompetition(competitionId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/competitions/${competitionId}`);
  }
}
