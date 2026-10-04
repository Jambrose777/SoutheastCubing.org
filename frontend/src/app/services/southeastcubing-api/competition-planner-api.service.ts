import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PlannerCompetition } from '../../models/PlannerCompetition';

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
}
