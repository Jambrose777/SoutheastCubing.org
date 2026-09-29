import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DelegateSyncSummary,
  ManageDelegateHistoryEntry,
  ManageDelegatesResponse,
} from '../../models/ManageDelegate';

// Backs the Manage Delegates dashboard.
@Injectable({
  providedIn: 'root',
})
export class ManageDelegatesApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard`;

  // Manage Delegates dashboard's own full-roster listing (current + full history).
  getDelegates(): Observable<ManageDelegatesResponse> {
    return this.http.get<ManageDelegatesResponse>(`${this.base}/delegates`);
  }

  // Manually triggers the same nightly WCA Delegate roster sync, on demand.
  syncDelegates(): Observable<DelegateSyncSummary> {
    return this.http.post<DelegateSyncSummary>(`${this.base}/delegates/sync`, null);
  }

  // POST /dashboard/delegate-rank-history - backfills a past rank stint,
  // creating the person/delegate row too if needed. End date is required.
  createRankRow(body: {
    peopleId?: string;
    wcaId?: string;
    rank: string;
    startDate: string;
    endDate: string;
  }): Observable<ManageDelegateHistoryEntry> {
    return this.http.post<ManageDelegateHistoryEntry>(`${this.base}/delegate-rank-history`, body);
  }

  // PUT /dashboard/delegate-rank-history/:id - corrects a rank history
  // row's dates (and, once closed, its rank). A currently-open row can only
  // have its start date changed.
  updateRankRow(
    id: string,
    body: { rank?: string; startDate: string; endDate?: string | null },
  ): Observable<ManageDelegateHistoryEntry> {
    return this.http.put<ManageDelegateHistoryEntry>(
      `${this.base}/delegate-rank-history/${id}`,
      body,
    );
  }

  // DELETE /dashboard/delegate-rank-history/:id - Admin-only, irreversible.
  hardDeleteRankRow(id: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/delegate-rank-history/${id}`);
  }

  // POST /dashboard/delegate-state-history - backfills a past state stint,
  // creating the person/delegate row too if needed. End date is required.
  createStateRow(body: {
    peopleId?: string;
    wcaId?: string;
    state: string;
    startDate: string;
    endDate: string;
  }): Observable<ManageDelegateHistoryEntry> {
    return this.http.post<ManageDelegateHistoryEntry>(`${this.base}/delegate-state-history`, body);
  }

  // PUT /dashboard/delegate-state-history/:id - corrects a state history
  // row's dates (and, once closed, its state). A currently-open row can only
  // have its start date changed.
  updateStateRow(
    id: string,
    body: { state?: string; startDate: string; endDate?: string | null },
  ): Observable<ManageDelegateHistoryEntry> {
    return this.http.put<ManageDelegateHistoryEntry>(
      `${this.base}/delegate-state-history/${id}`,
      body,
    );
  }

  // DELETE /dashboard/delegate-state-history/:id - Admin-only, irreversible.
  hardDeleteStateRow(id: string): Observable<{ status: string }> {
    return this.http.delete<{ status: string }>(`${this.base}/delegate-state-history/${id}`);
  }
}
