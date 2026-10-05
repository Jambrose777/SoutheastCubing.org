import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PlannerCompetition, PlannerCompetitionSaveRequest } from '../../models/PlannerCompetition';

// Backs the Competition Planner dashboard.
@Injectable({
  providedIn: 'root',
})
export class CompetitionPlannerApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard/competition-planner`;

  // Every upcoming competition regardless of status, for the planner's list view.
  getCompetitions(): Observable<PlannerCompetition[]> {
    return this.http.get<PlannerCompetition[]>(`${this.base}/competitions`);
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

  // Deletes a Planner competition - only ever possible while Potential/Planning.
  deleteCompetition(competitionId: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/competitions/${competitionId}`);
  }
}
