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
}
