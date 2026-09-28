import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MyInfo } from '../../models/MyInfo';

// Backs the user dashboard's My Info tab.
@Injectable({
  providedIn: 'root',
})
export class MyInfoService {
  private http = inject(HttpClient);
  private base = `${environment.links.southeastCubingApi}/dashboard`;

  getMyInfo(): Observable<MyInfo> {
    return this.http.get<MyInfo>(`${this.base}/my-info`);
  }

  // Enables or disables WCA sync for the signed-in user's managed photo.
  // Enabling re-mirrors from WCA if their avatar has changed; disabling
  // freezes the current managed photo/crop in place.
  setSyncEnabled(enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/my-info/photo/sync`, { enabled });
  }

  // Replaces the signed-in user's managed photo with an uploaded file.
  uploadPhoto(file: File): Observable<void> {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<void>(`${this.base}/my-info/photo/upload`, formData);
  }

  // Updates the signed-in user's managed photo's thumbnail crop.
  updateCrop(crop: {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  }): Observable<void> {
    return this.http.put<void>(`${this.base}/my-info/photo/crop`, crop);
  }

  // Sets the signed-in Delegate's own bio - returns the refreshed My Info
  // payload, same shape as getMyInfo, so the caller can update in one round
  // trip.
  updateBio(bio: string): Observable<MyInfo> {
    return this.http.put<MyInfo>(`${this.base}/my-info/bio`, { bio });
  }
}
