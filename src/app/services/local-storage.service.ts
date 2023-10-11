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
  getCompetitions(): Competition[] {
    return JSON.parse(localStorage.getItem('competitions'));
  }

  // Sets the competition object into local storage
  setCompetitions(competitions: Competition[]) {
    localStorage.setItem('competitions', JSON.stringify(competitions));
    // Save Time To Live for how long the local storage can be utilized before the data is stale
    localStorage.setItem('competitionsTTL', moment().format('YYYY-MM-DD'));
  }

  // retrieves the Time To Live for the competition data
  getCompetitionsTTL(): string {
    return localStorage.getItem('competitionsTTL');
  }
}
