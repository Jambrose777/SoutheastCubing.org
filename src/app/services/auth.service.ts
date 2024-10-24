import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { map, Observable, of } from 'rxjs';
import { LocalStorageService } from './local-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient, private localstorage: LocalStorageService) { }

  getIpAddress(): Observable<string> {
    // checks if ip is stored in local storage for the same day (psudo-cache) to not spam the geolocation with too many requests.
    const localStorageData = this.localstorage.getIp();
    if (localStorageData?.timestamp === moment().format('YYYY-MM-DD')) {
      return of(localStorageData.ip);
    }

    return this.http.get<any>('https://geolocation-db.com/json/')
      .pipe(
        map(res => res.IPv4),
        map(res => {
          this.localstorage.setIP(res);
          return res;
        })
      );
  }
}
