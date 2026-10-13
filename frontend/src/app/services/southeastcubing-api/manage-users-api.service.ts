import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ManageUser } from '../../models/ManageUser';

// Backs the Manage Users dashboard.
@Injectable({
  providedIn: 'root',
})
export class ManageUsersApiService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard`;

  // Manage Users dashboard's own full-roster listing.
  getUsers(): Observable<ManageUser[]> {
    return this.http.get<ManageUser[]>(`${this.base}/manage-users`);
  }

  // Sets a Delegate's bio on their behalf - returns the refreshed
  // `delegates` row, not a full ManageUser row.
  updateBio(peopleId: string, bio: string): Observable<{ bio: string }> {
    return this.http.put<{ bio: string }>(`${this.base}/manage-users/${peopleId}/bio`, { bio });
  }

  // Sets a Delegate's Discord user ID on their behalf.
  updateDiscordUserId(peopleId: string, discordUserId: string | null): Observable<unknown> {
    return this.http.put<unknown>(`${this.base}/manage-users/${peopleId}/discord-user-id`, {
      discordUserId,
    });
  }

  // Enables or disables WCA sync for another person's managed photo on
  // their behalf. Enabling re-mirrors from WCA if their avatar has changed;
  // disabling freezes the current managed photo/crop in place.
  setSyncEnabled(peopleId: string, enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/manage-users/${peopleId}/photo/sync`, { enabled });
  }

  // Replaces another person's managed photo with an uploaded file.
  uploadPhoto(peopleId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<void>(`${this.base}/manage-users/${peopleId}/photo/upload`, formData);
  }

  // Updates another person's managed photo's thumbnail crop.
  updateCrop(
    peopleId: string,
    crop: { cropX: number; cropY: number; cropW: number; cropH: number },
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/manage-users/${peopleId}/photo/crop`, crop);
  }
}
