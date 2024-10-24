import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { Competition } from '../models/Competition';

@Injectable({
  providedIn: 'root'
})

// Local Storage Serivce is used to connect to the local storage
export class LocalStorageService {

  constructor() { }

  // Retrieves the competition from local storage
  getIp(): { ip: string, timestamp: string } {
    return JSON.parse(localStorage.getItem('ip'));
  }

  // Sets the competition object into local storage
  setIP(ip: string) {
    localStorage.setItem('ip', JSON.stringify({ ip, timestamp: moment().format('YYYY-MM-DD') }));
  }
}
